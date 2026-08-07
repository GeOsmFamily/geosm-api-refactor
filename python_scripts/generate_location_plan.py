#!/usr/bin/env python3
"""Génère un plan de localisation professionnel (PDF) avec QGIS : carte principale à
échelle maîtrisée, carte de situation, grille de coordonnées, flèche du nord, échelle
graphique, légende et cartouche. Remplace la capture d'écran côté client.

Usage: generate_location_plan.py <lon> <lat> <output_pdf_path> <options_json>

options_json: {
  "title": str, "description": str, "landmark": str,
  "scale": int | null,               # dénominateur d'échelle (ex. 5000 pour 1:5000), auto si null
  "paperSize": "a4" | "a3",
  "orientation": "portrait" | "landscape",
  "includeLegend": bool,              # défaut true - constructeur de mise en page personnalisée
  "includeScale": bool,               # défaut true
  "includeGrid": bool,                # défaut true
  "includeNorthArrow": bool,          # défaut true
  "instanceBbox": [minLon, minLat, maxLon, maxLat] | null,   # pour la carte de situation
  "logoPath": str,
}

La connexion PostGIS est lue depuis la variable d'environnement DATABASE_URL (héritée du
process Node parent) - mêmes données OSM que celles utilisées par le reste de l'application
(schéma "osm", tables osm2pgsql classiques planet_osm_line/polygon/point).
"""
import sys
import os
import json
import math
from urllib.parse import urlparse

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsPrintLayout, QgsLayoutItemMap, QgsLayoutItemLegend,
    QgsLayoutItemScaleBar, QgsLayoutItemPicture, QgsLayoutItemLabel, QgsLayoutSize,
    QgsLayoutPoint, QgsUnitTypes, QgsLayoutExporter, QgsRectangle, QgsPointXY,
    QgsVectorLayer, QgsFeature, QgsGeometry, QgsMarkerSymbol, QgsSingleSymbolRenderer,
    QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsFillSymbol, QgsLineSymbol,
    QgsDataSourceUri, QgsLayoutItemMapGrid, QgsSimpleFillSymbolLayer, QgsLegendStyle,
    QgsPalLayerSettings, QgsVectorLayerSimpleLabeling, QgsTextFormat, QgsTextBufferSettings,
    QgsProperty, QgsPropertyCollection, QgsArrowSymbolLayer,
)
from qgis.PyQt.QtCore import QRectF
from qgis.PyQt.QtGui import QColor, QFont

NORTH_ARROW_SVG = '/usr/share/qgis/svg/arrows/NorthArrow_02.svg'
STANDARD_SCALES = [1000, 2000, 5000, 10000, 25000, 50000]
GEOSM_PRIMARY = QColor(2, 63, 95)
GEOSM_ACCENT = QColor(0, 173, 167)


def utm_epsg_for(lon: float, lat: float) -> int:
    zone = int((lon + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


def pg_layer(db: dict, table: str, sql: str, display_name: str = None, geom_col: str = 'way') -> QgsVectorLayer:
    uri = QgsDataSourceUri()
    uri.setConnection(db['host'], db['port'], db['dbname'], db['user'], db['password'])
    uri.setDataSource('osm', table, geom_col, sql)
    layer = QgsVectorLayer(uri.uri(False), display_name or table, 'postgres')
    return layer


def style_fill(layer: QgsVectorLayer, color: str, border: str, width: float = 0.15):
    symbol = QgsFillSymbol.createSimple({
        'color': color, 'outline_color': border, 'outline_width': str(width),
    })
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))


def style_line(layer: QgsVectorLayer, color: str, width: float, style: str = 'solid'):
    symbol = QgsLineSymbol.createSimple({'line_color': color, 'line_width': str(width), 'line_style': style})
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))


def add_labels(layer: QgsVectorLayer, expression: str, priority_expr: str, size_expr: str, color: str = '#2b2b2b'):
    """Active l'étiquetage PAL avec halo blanc (lisible sur n'importe quel fond) et taille/
    priorité pilotées par expression QGIS - permet au moteur de placement de ne montrer que
    les lieux-dits/repères les plus importants quand la place manque, sans limite fixe."""
    settings = QgsPalLayerSettings()
    settings.fieldName = expression
    settings.isExpression = True
    settings.placement = QgsPalLayerSettings.OverPoint

    text_format = QgsTextFormat()
    text_format.setColor(QColor(color))
    text_format.setSize(8)
    buffer = QgsTextBufferSettings()
    buffer.setEnabled(True)
    buffer.setSize(0.8)
    buffer.setColor(QColor('#ffffff'))
    text_format.setBuffer(buffer)
    settings.setFormat(text_format)

    props = QgsPropertyCollection()
    props.setProperty(QgsPalLayerSettings.Priority, QgsProperty.fromExpression(priority_expr))
    props.setProperty(QgsPalLayerSettings.Size, QgsProperty.fromExpression(size_expr))
    settings.setDataDefinedProperties(props)

    layer.setLabeling(QgsVectorLayerSimpleLabeling(settings))
    layer.setLabelsEnabled(True)


def build_place_labels_layer(db: dict) -> QgsVectorLayer:
    """Lieux-dits (tag OSM place=*) : villes/quartiers/villages/hameaux nommés - essentiels
    pour se repérer, absents du fond bâti/routes seul.
    `place` n'existe pas comme colonne propre sur planet_osm_point dans ce dépôt (import
    --hstore, voir build_backdrop_layers) - accès via la colonne hstore `tags`."""
    layer = pg_layer(db, 'planet_osm_point', "tags -> 'place' IS NOT NULL AND name IS NOT NULL", 'Lieux-dits')
    if not layer.isValid():
        return layer
    symbol = QgsMarkerSymbol.createSimple({'name': 'circle', 'color': '#4a4a4a', 'size': '1.2', 'outline_width': '0'})
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    priority_expr = "CASE WHEN \"tags\" -> 'place' IN ('city','town') THEN 9 WHEN \"tags\" -> 'place' IN ('suburb','village') THEN 6 ELSE 3 END"
    size_expr = "CASE WHEN \"tags\" -> 'place' IN ('city','town') THEN 10 WHEN \"tags\" -> 'place' IN ('suburb','village') THEN 8 ELSE 7 END"
    add_labels(layer, '"name"', priority_expr, size_expr, '#2b2b2b')
    return layer


def build_landmark_labels_layer(db: dict) -> QgsVectorLayer:
    """Repères notables nommés (marchés, lieux de culte, mairies, monuments) - aident au
    repérage visuel en complément des lieux-dits, sans surcharger d'un fond thématique complet.
    `historic` n'existe pas comme colonne propre sur planet_osm_point (import --hstore) -
    accès via `tags`, contrairement à `amenity`/`tourism` qui restent des colonnes réelles."""
    where = (
        "((\"amenity\" IN ('place_of_worship','marketplace','townhall')) "
        "OR (\"tags\" -> 'historic' IN ('monument','memorial')) "
        "OR (\"tourism\" = 'attraction')) AND \"name\" IS NOT NULL"
    )
    layer = pg_layer(db, 'planet_osm_point', where, 'Repères notables')
    if not layer.isValid():
        return layer
    symbol = QgsMarkerSymbol.createSimple({'name': 'star', 'color': '#e67e22', 'size': '2.4', 'outline_color': '#ffffff', 'outline_width': '0.2'})
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    add_labels(layer, '"name"', '7', '7.5', '#7a3b0e')
    return layer


def build_backdrop_layers(db: dict) -> list:
    """Fond topographique neutre : bâti, hydrographie, routes, limites administratives.
    `natural`/`waterway`(sur polygon)/`building`/`boundary` n'existent pas comme colonnes
    propres dans ce dépôt (import osm2pgsql --hstore, voir docs/deploiement.md §5) - seuls
    `highway`/`waterway` restent des colonnes réelles sur planet_osm_line. Accès aux autres
    via la colonne hstore `tags` (`tags -> 'clé'`), sans quoi ces requêtes échouent
    silencieusement (QgsVectorLayer invalide) et le fond de carte reste vide."""
    layers = []

    water_poly = pg_layer(db, 'planet_osm_polygon', "tags -> 'natural' = 'water' OR tags -> 'waterway' IS NOT NULL", 'Plans d’eau')
    if water_poly.isValid():
        style_fill(water_poly, '#c9e3f5', '#a9cbe8')
        layers.append(water_poly)

    water_line = pg_layer(db, 'planet_osm_line', 'waterway IS NOT NULL', 'Cours d’eau')
    if water_line.isValid():
        style_line(water_line, '#a9cbe8', 0.4)
        layers.append(water_line)

    buildings = pg_layer(db, 'planet_osm_polygon', "tags -> 'building' IS NOT NULL", 'Bâtiments')
    if buildings.isValid():
        style_fill(buildings, '#e4e0d8', '#c9c2b3', 0.1)
        layers.append(buildings)

    roads = pg_layer(db, 'planet_osm_line', 'highway IS NOT NULL', 'Routes')
    if roads.isValid():
        style_line(roads, '#9a9a9a', 0.5)
        layers.append(roads)

    admin = pg_layer(db, 'planet_osm_line', "tags -> 'boundary' = 'administrative'", 'Limites administratives')
    if admin.isValid():
        style_line(admin, '#7a4fb5', 0.6, 'dash')
        layers.append(admin)

    return layers


def build_overview_layers(db: dict) -> list:
    """Fond très léger pour la carte de situation (emprise pays entier) : uniquement les
    limites administratives de niveau pays/région, jamais le bâti/routes en détail - sinon
    le PDF exporté embarque des centaines de milliers de géométries vectorielles (~100+ Mo).
    `boundary`/`admin_level` via `tags` - voir la note de build_backdrop_layers()."""
    layers = []
    country = pg_layer(
        db, 'planet_osm_line',
        "tags -> 'boundary' = 'administrative' AND tags -> 'admin_level' IN ('2', '4')",
        'Limites administratives',
    )
    if country.isValid():
        style_line(country, '#7a4fb5', 0.5, 'dash')
        layers.append(country)
    return layers


def build_marker_layer(lon: float, lat: float) -> QgsVectorLayer:
    layer = QgsVectorLayer('Point?crs=EPSG:4326', 'Point sélectionné', 'memory')
    provider = layer.dataProvider()
    feature = QgsFeature()
    feature.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(lon, lat)))
    provider.addFeature(feature)
    layer.updateExtents()

    symbol = QgsMarkerSymbol.createSimple({
        'name': 'circle', 'color': '#e74c3c', 'outline_color': '#ffffff',
        'outline_width': '1', 'size': '4',
    })
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    return layer


def build_origin_marker_layer(lon: float, lat: float) -> QgsVectorLayer:
    """Point de départ de l'itinéraire d'accès - vert et distinct du point de destination
    (rouge, voir build_marker_layer) pour ne jamais les confondre sur le plan."""
    layer = QgsVectorLayer('Point?crs=EPSG:4326', 'Point de départ', 'memory')
    provider = layer.dataProvider()
    feature = QgsFeature()
    feature.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(lon, lat)))
    provider.addFeature(feature)
    layer.updateExtents()

    symbol = QgsMarkerSymbol.createSimple({
        'name': 'circle', 'color': '#27ae60', 'outline_color': '#ffffff',
        'outline_width': '1', 'size': '4',
    })
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    return layer


# Un tronçon "véhicule" et un tronçon "à pied" (voir CreateLocationPlanUseCase.computeRouteLegs
# côté backend) doivent rester visuellement distincts sans dépendre du texte de la légende seul.
ROUTE_LEG_STYLE = {
    'driving': {'color': '#1a73e8', 'width': '1.1', 'name': "Itinéraire (véhicule)"},
    'walking': {'color': '#e67e22', 'width': '0.9', 'name': "Dernier tronçon (à pied)"},
}

# La pointe de la flèche coïncide exactement avec le marqueur de destination (même coordonnée)
# - sans ce raccourci, le marqueur (dessiné par-dessus, voir main()) avale entièrement la pointe.
ARROW_END_TRIM_METERS = 6.0


def trim_line_end(coords: list, trim_meters: float) -> list:
    """Raccourcit l'extrémité finale d'une ligne d'une distance réelle donnée (mètres),
    approximation planaire simple (suffisante à cette échelle très locale) - garde le reste du
    tracé intact, ne recalcule que le dernier segment impacté."""
    if len(coords) < 2 or trim_meters <= 0:
        return coords
    result = [list(c) for c in coords]
    remaining = trim_meters
    while len(result) >= 2 and remaining > 0:
        a, b = result[-2], result[-1]
        lat_mid = math.radians((a[1] + b[1]) / 2)
        dx = (b[0] - a[0]) * 111320 * math.cos(lat_mid)
        dy = (b[1] - a[1]) * 111320
        seg_len = math.hypot(dx, dy)
        if seg_len <= 1e-9:
            result.pop()
            continue
        if seg_len <= remaining:
            remaining -= seg_len
            result.pop()
        else:
            frac = 1 - (remaining / seg_len)
            result[-1] = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
            remaining = 0
    return result if len(result) >= 2 else coords


def build_route_leg_layer(leg: dict) -> QgsVectorLayer:
    """Dessine un tronçon d'itinéraire comme UNE flèche unique (pas une ligne simple) pointant
    vers la destination - QgsArrowSymbolLayer avec isRepeated=False dessine une seule tête de
    flèche à l'extrémité finale de la géométrie, qui est toujours orientée vers la destination
    (voir l'ordre des coordonnées produit par OSRMService.route() côté backend)."""
    style = ROUTE_LEG_STYLE.get(leg.get('mode'), ROUTE_LEG_STYLE['driving'])
    coords = trim_line_end(leg['geometry']['coordinates'], ARROW_END_TRIM_METERS)
    layer = QgsVectorLayer('LineString?crs=EPSG:4326', style['name'], 'memory')
    provider = layer.dataProvider()
    feature = QgsFeature()
    feature.setGeometry(QgsGeometry.fromPolylineXY([QgsPointXY(c[0], c[1]) for c in coords]))
    provider.addFeature(feature)
    layer.updateExtents()

    arrow = QgsArrowSymbolLayer()
    arrow.setColor(QColor(style['color']))
    arrow.setArrowWidth(float(style['width']))
    arrow.setArrowStartWidth(float(style['width']))
    arrow.setHeadLength(2.4)
    arrow.setHeadThickness(1.8)
    arrow.setIsCurved(False)
    arrow.setIsRepeated(False)
    symbol = QgsLineSymbol()
    symbol.changeSymbolLayer(0, arrow)
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    return layer


def bbox_from_coords(coord_lists: list, pad_ratio: float = 0.15) -> QgsRectangle:
    """Emprise englobant plusieurs listes de [lon, lat], avec une marge proportionnelle - sert
    à cadrer la carte de situation sur l'itinéraire d'accès complet plutôt que sur un point."""
    lons = [c[0] for coords in coord_lists for c in coords]
    lats = [c[1] for coords in coord_lists for c in coords]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    pad_x = max((max_lon - min_lon) * pad_ratio, 0.01)
    pad_y = max((max_lat - min_lat) * pad_ratio, 0.01)
    return QgsRectangle(min_lon - pad_x, min_lat - pad_y, max_lon + pad_x, max_lat + pad_y)


def add_label(layout: QgsPrintLayout, text: str, x: float, y: float, w: float, h: float,
              size: float = 9, bold: bool = False, color: QColor = None, html: bool = False) -> QgsLayoutItemLabel:
    label = QgsLayoutItemLabel(layout)
    if html:
        label.setMode(QgsLayoutItemLabel.ModeHtml)
    label.setText(text)
    font = QFont('Helvetica', int(size))
    font.setBold(bold)
    label.setFont(font)
    if color:
        label.setFontColor(color)
    layout.addLayoutItem(label)
    label.attemptSetSceneRect(QRectF(x, y, w, h))
    return label


def main():
    if len(sys.argv) < 5:
        print(json.dumps({'success': False, 'error': 'Usage: generate_location_plan.py <lon> <lat> <output_pdf_path> <options_json>'}))
        sys.exit(1)

    lon = float(sys.argv[1])
    lat = float(sys.argv[2])
    output_path = sys.argv[3]
    options = json.loads(sys.argv[4])

    title = options.get('title') or 'Plan de localisation'
    description = options.get('description') or ''
    landmark = options.get('landmark') or ''
    scale = options.get('scale')
    paper_size = (options.get('paperSize') or 'a4').lower()
    orientation = (options.get('orientation') or 'portrait').lower()
    include_legend = options.get('includeLegend', True)
    include_scale = options.get('includeScale', True)
    include_grid = options.get('includeGrid', True)
    include_north_arrow = options.get('includeNorthArrow', True)
    instance_bbox = options.get('instanceBbox')
    logo_path = options.get('logoPath')
    origin_lon = options.get('originLon')
    origin_lat = options.get('originLat')
    route_legs = options.get('routeLegs') or []
    elevation_summary = options.get('elevationSummary')
    access_instructions = options.get('accessInstructions') or ''
    has_route = origin_lon is not None and origin_lat is not None and len(route_legs) > 0

    db_url = urlparse(os.environ['DATABASE_URL'])
    db = {
        'host': db_url.hostname, 'port': str(db_url.port or 5432),
        'dbname': db_url.path.lstrip('/').split('?')[0],
        'user': db_url.username, 'password': db_url.password,
    }

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()

        backdrop_layers = build_backdrop_layers(db)
        overview_backdrop_layers = build_overview_layers(db)
        marker_layer = build_marker_layer(lon, lat)

        label_layers = []
        landmark_layer = build_landmark_labels_layer(db)
        if landmark_layer.isValid():
            label_layers.append(landmark_layer)
        place_layer = build_place_labels_layer(db)
        if place_layer.isValid():
            label_layers.append(place_layer)

        # Itinéraire d'accès (voir CreateLocationPlanUseCase.computeRouteLegs côté backend) :
        # le tronçon à pied (local, court) est affiché sur la carte principale ET la carte de
        # situation ; le tronçon véhicule (potentiellement long) n'a de sens qu'à l'échelle de
        # la carte de situation, sinon il ne rentrerait jamais dans l'emprise locale fixe de la
        # carte principale.
        walk_leg_layers = []
        drive_leg_layers = []
        origin_marker = build_origin_marker_layer(origin_lon, origin_lat) if has_route else None
        if has_route:
            for leg in route_legs:
                leg_layer = build_route_leg_layer(leg)
                if leg.get('mode') == 'walking':
                    walk_leg_layers.append(leg_layer)
                else:
                    drive_leg_layers.append(leg_layer)

        # QGIS empile les couches dans l'ORDRE de la liste : l'élément 0 est dessiné en DERNIER
        # (au-dessus de tout le reste), le dernier élément de la liste en PREMIER (donc en
        # dessous). Le tronçon à pied doit impérativement passer AVANT backdrop_layers (bâtiments/
        # plans d'eau ont un remplissage opaque) sous peine d'être invisible, entièrement masqué
        # par ces polygones - bug réel observé (trait présent en légende mais invisible sur la
        # carte principale) avant ce correctif. Les tronçons passent aussi AVANT les marqueurs
        # (élément 0) : sinon la pointe de la flèche, qui coïncide avec la coordonnée exacte du
        # marqueur, se retrouve entièrement recouverte par son disque plein - autre bug réel
        # observé (voir aussi trim_line_end/ARROW_END_TRIM_METERS pour le même problème).
        all_layers = walk_leg_layers + [marker_layer] + label_layers + backdrop_layers
        overview_layers = (
            drive_leg_layers + walk_leg_layers
            + ([origin_marker] if origin_marker else []) + [marker_layer] + overview_backdrop_layers
        )
        # Les couches de la carte de situation ne sont ajoutées qu'au projet (pour être
        # utilisables par overview.setLayers()), pas à l'arbre des couches - sinon elles
        # apparaissent en double dans la légende (qui reflète tout l'arbre, pas seulement
        # les couches liées à la carte principale). Le tronçon à pied est déjà dans all_layers
        # (True) : ne pas le réajouter ici sous peine de doublon dans la légende.
        project.addMapLayers(all_layers, True)
        overview_only_layers = drive_leg_layers + ([origin_marker] if origin_marker else [])
        project.addMapLayers(overview_backdrop_layers + overview_only_layers, False)

        page_w, page_h = (210.0, 297.0) if paper_size == 'a3' else (210.0, 297.0)
        if paper_size == 'a3':
            page_w, page_h = 297.0, 420.0
        if orientation == 'landscape':
            page_w, page_h = page_h, page_w

        layout = QgsPrintLayout(project)
        layout.initializeDefaults()
        layout.setName('LocationPlan')
        page = layout.pageCollection().pages()[0]
        page.setPageSize(QgsLayoutSize(page_w, page_h, QgsUnitTypes.LayoutMillimeters))

        margin = page_w * 0.06
        header_h = page_h * 0.06
        footer_h = page_h * 0.035

        # --- Bandeau d'en-tête GeOSM ---
        header_bg = QgsLayoutItemLabel(layout)
        header_bg.setMode(QgsLayoutItemLabel.ModeHtml)
        header_bg.setText(f'<div style="background:#023f5f;width:100%;height:100%;"></div>')
        layout.addLayoutItem(header_bg)
        header_bg.attemptSetSceneRect(QRectF(0, 0, page_w, header_h))

        add_label(layout, 'GeOSM', margin, header_h * 0.12, 60, header_h * 0.5,
                  size=16, bold=True, color=QColor(255, 255, 255))
        add_label(layout, 'PLAN DE LOCALISATION', margin, header_h * 0.58, 100, header_h * 0.35,
                  size=8, color=GEOSM_ACCENT)

        if logo_path and os.path.exists(logo_path):
            logo = QgsLayoutItemPicture(layout)
            logo.setPicturePath(logo_path)
            layout.addLayoutItem(logo)
            logo_size = header_h * 0.6
            logo.attemptSetSceneRect(QRectF(page_w - margin - logo_size, header_h * 0.2, logo_size, logo_size))

        # --- Carte principale ---
        # 0.54 (au lieu de 0.58 à l'origine) : réduit pour dégager de la marge verticale sous la
        # carte - avec un itinéraire d'accès (légende +1 ligne, cartouche +1 ligne de texte), le
        # budget vertical restant avant le pied de page devenait insuffisant et provoquait un
        # chevauchement réel entre le cartouche et le pied de page (bug observé en conditions
        # réelles : le texte "UTM :" recouvrait la ligne "Date :"). La carte reste très grande
        # (environ 160mm de haut sur A4 portrait) - perte de lisibilité négligeable.
        map_y = header_h + page_h * 0.03
        map_h = page_h * 0.54
        map_w = page_w - margin * 2

        main_map = QgsLayoutItemMap(layout)
        main_map.attemptSetSceneRect(QRectF(margin, map_y, map_w, map_h))
        main_map.setFrameEnabled(True)
        layout.addLayoutItem(main_map)

        center = QgsPointXY(lon, lat)
        rough_span = 0.02
        main_map.setExtent(QgsRectangle(lon - rough_span, lat - rough_span, lon + rough_span, lat + rough_span))
        main_map.setCrs(QgsCoordinateReferenceSystem('EPSG:4326'))
        main_map.setLayers(all_layers)

        used_scale = scale if scale else min(STANDARD_SCALES, key=lambda s: abs(s - 5000))
        main_map.setScale(used_scale)
        # setScale conserve le centre courant de l'étendue, pas nécessairement le point choisi :
        # on recentre explicitement après application de l'échelle.
        extent = main_map.extent()
        half_w = extent.width() / 2
        half_h = extent.height() / 2
        main_map.setExtent(QgsRectangle(lon - half_w, lat - half_h, lon + half_w, lat + half_h))

        grid = main_map.grid()
        if include_grid:
            grid.setEnabled(True)
            grid.setStyle(QgsLayoutItemMapGrid.Solid)
            interval = extent.width() / 4
            grid.setIntervalX(interval)
            grid.setIntervalY(interval)
            grid.setAnnotationEnabled(True)
            grid.setAnnotationPrecision(3)
            grid.setAnnotationFont(QFont('Helvetica', 6))
            grid.setFrameStyle(QgsLayoutItemMapGrid.Zebra)
            grid.setLineSymbol(QgsLineSymbol.createSimple({'line_color': '#cccccc', 'line_width': '0.1'}))
        else:
            grid.setEnabled(False)

        # --- Flèche du nord ---
        if include_north_arrow and os.path.exists(NORTH_ARROW_SVG):
            north = QgsLayoutItemPicture(layout)
            north.setPicturePath(NORTH_ARROW_SVG)
            layout.addLayoutItem(north)
            arrow_size = page_w * 0.05
            north.attemptSetSceneRect(QRectF(margin + 3, map_y + 3, arrow_size, arrow_size * 1.6))

        # --- Carte de situation (vicinity map) ---
        # Agrandie quand un itinéraire d'accès est affiché : le tracé complet (potentiellement
        # plusieurs km) a besoin de plus de place que la simple pastille de contexte habituelle.
        overview_size = page_w * (0.30 if has_route else 0.22)
        overview = QgsLayoutItemMap(layout)
        overview.attemptSetSceneRect(QRectF(
            margin + map_w - overview_size - 2, map_y + map_h - overview_size - 2,
            overview_size, overview_size,
        ))
        overview.setFrameEnabled(True)
        layout.addLayoutItem(overview)
        overview.setLayers(overview_layers)
        overview.setCrs(QgsCoordinateReferenceSystem('EPSG:4326'))
        if has_route:
            route_coords = [leg['geometry']['coordinates'] for leg in route_legs]
            route_coords.append([[origin_lon, origin_lat], [lon, lat]])
            overview.setExtent(bbox_from_coords(route_coords))
        elif instance_bbox and len(instance_bbox) == 4:
            overview.setExtent(QgsRectangle(*instance_bbox))
        else:
            overview.setExtent(QgsRectangle(lon - 1, lat - 1, lon + 1, lat + 1))
        ov_overview = overview.overview()
        ov_overview.setLinkedMap(main_map)
        ov_overview.setFrameSymbol(QgsFillSymbol.createSimple({'color': '255,0,0,40', 'outline_color': '#e74c3c', 'outline_width': '0.4'}))

        # --- Échelle graphique, légende : positionnées via un curseur vertical courant
        # (current_y) qui avance uniquement après un élément réellement dessiné - évite un
        # trou vide dans la mise en page quand l'un des deux est masqué par l'utilisateur.
        # Le premier écart (sous la carte) doit tenir compte de l'annotation de coordonnées de
        # la grille, qui déborde du cadre de la carte sur une hauteur notable (comportement
        # QGIS) - un écart trop faible ici faisait apparaître la légende comme collée/en
        # chevauchement visuel avec le bas de la carte (bug remonté en conditions réelles).
        # 0.045 (pas 0.1) : un écart plus généreux repoussait la légende trop bas et faisait
        # ressurgir un chevauchement cartouche/pied de page (autre bug remonté) - la marge de
        # sécurité de info_h plus bas absorbe le reste.
        current_y = map_y + map_h + page_h * (0.045 if include_grid else 0.015)

        if include_scale:
            scalebar_y = current_y
            scalebar = QgsLayoutItemScaleBar(layout)
            scalebar.setStyle('Line Ticks Up')
            scalebar.setLinkedMap(main_map)
            scalebar.applyDefaultSize()
            layout.addLayoutItem(scalebar)
            scalebar.attemptSetSceneRect(QRectF(margin, scalebar_y, page_w * 0.35, page_h * 0.02))

            add_label(layout, f"Échelle : 1:{used_scale:,}".replace(',', ' '), margin + page_w * 0.4, scalebar_y,
                      page_w * 0.3, page_h * 0.02, size=8, bold=True)
            current_y = scalebar_y + page_h * 0.03

        # Calculé tôt : le cartouche (plus bas) a besoin de connaître l'espace RÉELLEMENT
        # disponible avant le pied de page, plutôt qu'une hauteur devinée à l'avance - ancienne
        # source de chevauchements réels (cartouche/pied de page qui se recouvraient) quand le
        # contenu au-dessus (légende notamment) était plus grand que prévu.
        footer_y = page_h - footer_h

        if include_legend:
            legend_y = current_y
            legend = QgsLayoutItemLegend(layout)
            legend.setLinkedMap(main_map)
            legend.setTitle('Légende')
            small_font = QFont('Helvetica', 7)
            title_font = QFont('Helvetica', 8)
            title_font.setBold(True)
            legend.setStyleFont(QgsLegendStyle.Title, title_font)
            legend.setStyleFont(QgsLegendStyle.SymbolLabel, small_font)
            legend.setSymbolWidth(4)
            legend.setSymbolHeight(3)
            # Sur 2 colonnes plutôt qu'une seule : une liste de 8-9 entrées en une colonne
            # devient inutilement haute (c'est ce qui provoquait le débordement réel observé
            # avec le tronçon à pied ajoutant une entrée) - étalée sur 2 colonnes et une largeur
            # proche de la pleine page, la hauteur nécessaire est environ divisée par deux.
            legend.setColumnCount(2)
            layout.addLayoutItem(legend)
            legend.attemptSetSceneRect(QRectF(margin, legend_y, page_w - margin * 2, page_h * 0.16))
            # adjustBoxSize() redimensionne l'item à sa taille RÉELLEMENT nécessaire pour son
            # contenu (ancre haut-gauche conservée) - remplace toute estimation manuelle de
            # hauteur, qui était systématiquement approximative et donc source de chevauchement
            # dès que le nombre d'entrées changeait (ex. itinéraire d'accès affiché ou non).
            legend.adjustBoxSize()
            legend_h = legend.rect().height()
            current_y = legend_y + legend_h + page_h * 0.015
        else:
            current_y = current_y + page_h * 0.015

        # Dégagement minimum sous la carte : la grille de coordonnées (si activée) déborde du
        # cadre de la carte sur une hauteur notable (comportement QGIS, pas une valeur fixe
        # documentée) - garantit qu'aucun élément qui suit ne s'y superpose, même quand
        # échelle ET légende sont toutes deux masquées.
        min_gap_after_map = page_h * (0.1 if include_grid else 0.015)
        current_y = max(current_y, map_y + map_h + min_gap_after_map)

        # --- Cartouche (coordonnées, titre, description) ---
        try:
            utm_crs = QgsCoordinateReferenceSystem(f'EPSG:{utm_epsg_for(lon, lat)}')
            transform = QgsCoordinateTransform(QgsCoordinateReferenceSystem('EPSG:4326'), utm_crs, project)
            utm_point = transform.transform(QgsPointXY(lon, lat))
            utm_text = f"UTM : {utm_point.x():.1f} E, {utm_point.y():.1f} N ({utm_crs.authid()})"
        except Exception:
            utm_text = ''

        info_y = current_y
        info_html = (
            f"<b style='color:#023f5f;font-size:13px'>{title}</b><br>"
            f"{description}<br>"
            + (f"<i>Point de repère : {landmark}</i><br>" if landmark else '')
            + f"Latitude / Longitude : {lat:.6f}, {lon:.6f} (WGS84)<br>"
            + utm_text
            + (
                f"<br><b style='color:#023f5f;font-size:10px'>Accès :</b> "
                f"<span style='font-size:9px'>{access_instructions}</span>"
                if access_instructions else ''
            )
        )
        # Occupe tout l'espace RÉELLEMENT disponible jusqu'au pied de page (jamais plus) - le
        # plancher est volontairement bas (juste de quoi éviter une hauteur nulle/négative), pas
        # une hauteur "confortable" garantie : si le contenu au-dessus (légende) est
        # exceptionnellement haut, mieux vaut un cartouche compressé qu'un chevauchement forcé
        # avec le pied de page (bug réel observé avec un plancher trop haut, 0.06).
        info_h = max(page_h * 0.02, footer_y - info_y - page_h * 0.01)
        add_label(layout, info_html, margin, info_y, page_w - margin * 2, info_h, html=True)

        # --- Pied de page ---
        now = __import__('datetime').datetime.now().strftime('%d/%m/%Y %H:%M')
        add_label(layout, f'Date : {now}', margin, footer_y, page_w * 0.4, footer_h, size=7,
                  color=QColor(148, 163, 184))
        add_label(layout, 'Données © OpenStreetMap contributors | Généré par GeOSM',
                  page_w - margin - page_w * 0.5, footer_y, page_w * 0.5, footer_h, size=7,
                  color=QColor(148, 163, 184))

        exporter = QgsLayoutExporter(layout)
        settings = QgsLayoutExporter.PdfExportSettings()
        result = exporter.exportToPdf(output_path, settings)

        if result != QgsLayoutExporter.Success:
            print(json.dumps({'success': False, 'error': f'Export PDF échoué (code {result})'}))
            sys.exit(1)

        print(json.dumps({
            'success': True, 'outputPath': output_path, 'scale': used_scale,
            'pageWidthMm': page_w, 'pageHeightMm': page_h,
        }))

    except Exception as e:
        import traceback
        print(json.dumps({'success': False, 'error': str(e), 'trace': traceback.format_exc()}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

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
    QgsProperty, QgsPropertyCollection,
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
    pour se repérer, absents du fond bâti/routes seul."""
    layer = pg_layer(db, 'planet_osm_point', 'place IS NOT NULL AND name IS NOT NULL', 'Lieux-dits')
    if not layer.isValid():
        return layer
    symbol = QgsMarkerSymbol.createSimple({'name': 'circle', 'color': '#4a4a4a', 'size': '1.2', 'outline_width': '0'})
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    priority_expr = "CASE WHEN \"place\" IN ('city','town') THEN 9 WHEN \"place\" IN ('suburb','village') THEN 6 ELSE 3 END"
    size_expr = "CASE WHEN \"place\" IN ('city','town') THEN 10 WHEN \"place\" IN ('suburb','village') THEN 8 ELSE 7 END"
    add_labels(layer, '"name"', priority_expr, size_expr, '#2b2b2b')
    return layer


def build_landmark_labels_layer(db: dict) -> QgsVectorLayer:
    """Repères notables nommés (marchés, lieux de culte, mairies, monuments) - aident au
    repérage visuel en complément des lieux-dits, sans surcharger d'un fond thématique complet."""
    where = (
        "((\"amenity\" IN ('place_of_worship','marketplace','townhall')) "
        "OR (\"historic\" IN ('monument','memorial')) "
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
    """Fond topographique neutre : bâti, hydrographie, routes, limites administratives."""
    layers = []

    water_poly = pg_layer(db, 'planet_osm_polygon', "\"natural\" = 'water' OR waterway IS NOT NULL", 'Plans d’eau')
    if water_poly.isValid():
        style_fill(water_poly, '#c9e3f5', '#a9cbe8')
        layers.append(water_poly)

    water_line = pg_layer(db, 'planet_osm_line', 'waterway IS NOT NULL', 'Cours d’eau')
    if water_line.isValid():
        style_line(water_line, '#a9cbe8', 0.4)
        layers.append(water_line)

    buildings = pg_layer(db, 'planet_osm_polygon', 'building IS NOT NULL', 'Bâtiments')
    if buildings.isValid():
        style_fill(buildings, '#e4e0d8', '#c9c2b3', 0.1)
        layers.append(buildings)

    roads = pg_layer(db, 'planet_osm_line', 'highway IS NOT NULL', 'Routes')
    if roads.isValid():
        style_line(roads, '#9a9a9a', 0.5)
        layers.append(roads)

    admin = pg_layer(db, 'planet_osm_line', "boundary = 'administrative'", 'Limites administratives')
    if admin.isValid():
        style_line(admin, '#7a4fb5', 0.6, 'dash')
        layers.append(admin)

    return layers


def build_overview_layers(db: dict) -> list:
    """Fond très léger pour la carte de situation (emprise pays entier) : uniquement les
    limites administratives de niveau pays/région, jamais le bâti/routes en détail - sinon
    le PDF exporté embarque des centaines de milliers de géométries vectorielles (~100+ Mo)."""
    layers = []
    country = pg_layer(db, 'planet_osm_line', "boundary = 'administrative' AND admin_level IN ('2', '4')", 'Limites administratives')
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
    instance_bbox = options.get('instanceBbox')
    logo_path = options.get('logoPath')

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

        all_layers = [marker_layer] + label_layers + backdrop_layers
        overview_layers = [marker_layer] + overview_backdrop_layers
        # Les couches de la carte de situation ne sont ajoutées qu'au projet (pour être
        # utilisables par overview.setLayers()), pas à l'arbre des couches - sinon elles
        # apparaissent en double dans la légende (qui reflète tout l'arbre, pas seulement
        # les couches liées à la carte principale).
        project.addMapLayers(all_layers, True)
        project.addMapLayers(overview_backdrop_layers, False)

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
        map_y = header_h + page_h * 0.03
        map_h = page_h * 0.58
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

        # --- Flèche du nord ---
        if os.path.exists(NORTH_ARROW_SVG):
            north = QgsLayoutItemPicture(layout)
            north.setPicturePath(NORTH_ARROW_SVG)
            layout.addLayoutItem(north)
            arrow_size = page_w * 0.05
            north.attemptSetSceneRect(QRectF(margin + 3, map_y + 3, arrow_size, arrow_size * 1.6))

        # --- Carte de situation (vicinity map) ---
        overview_size = page_w * 0.22
        overview = QgsLayoutItemMap(layout)
        overview.attemptSetSceneRect(QRectF(
            margin + map_w - overview_size - 2, map_y + map_h - overview_size - 2,
            overview_size, overview_size,
        ))
        overview.setFrameEnabled(True)
        layout.addLayoutItem(overview)
        overview.setLayers(overview_layers)
        overview.setCrs(QgsCoordinateReferenceSystem('EPSG:4326'))
        if instance_bbox and len(instance_bbox) == 4:
            overview.setExtent(QgsRectangle(*instance_bbox))
        else:
            overview.setExtent(QgsRectangle(lon - 1, lat - 1, lon + 1, lat + 1))
        ov_overview = overview.overview()
        ov_overview.setLinkedMap(main_map)
        ov_overview.setFrameSymbol(QgsFillSymbol.createSimple({'color': '255,0,0,40', 'outline_color': '#e74c3c', 'outline_width': '0.4'}))

        # --- Échelle graphique ---
        scalebar_y = map_y + map_h + page_h * 0.015
        scalebar = QgsLayoutItemScaleBar(layout)
        scalebar.setStyle('Line Ticks Up')
        scalebar.setLinkedMap(main_map)
        scalebar.applyDefaultSize()
        layout.addLayoutItem(scalebar)
        scalebar.attemptSetSceneRect(QRectF(margin, scalebar_y, page_w * 0.35, page_h * 0.02))

        add_label(layout, f"Échelle : 1:{used_scale:,}".replace(',', ' '), margin + page_w * 0.4, scalebar_y,
                  page_w * 0.3, page_h * 0.02, size=8, bold=True)

        # --- Légende ---
        legend_y = scalebar_y + page_h * 0.03
        legend_h = page_h * 0.16
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
        layout.addLayoutItem(legend)
        legend.attemptSetSceneRect(QRectF(margin, legend_y, page_w * 0.45, legend_h))

        # --- Cartouche (coordonnées, titre, description) ---
        try:
            utm_crs = QgsCoordinateReferenceSystem(f'EPSG:{utm_epsg_for(lon, lat)}')
            transform = QgsCoordinateTransform(QgsCoordinateReferenceSystem('EPSG:4326'), utm_crs, project)
            utm_point = transform.transform(QgsPointXY(lon, lat))
            utm_text = f"UTM : {utm_point.x():.1f} E, {utm_point.y():.1f} N ({utm_crs.authid()})"
        except Exception:
            utm_text = ''

        info_y = legend_y + legend_h + page_h * 0.015
        info_html = (
            f"<b style='color:#023f5f;font-size:13px'>{title}</b><br>"
            f"{description}<br>"
            + (f"<i>Point de repère : {landmark}</i><br>" if landmark else '')
            + f"Latitude / Longitude : {lat:.6f}, {lon:.6f} (WGS84)<br>"
            + utm_text
        )
        add_label(layout, info_html, margin, info_y, page_w - margin * 2, page_h * 0.1, html=True)

        # --- Pied de page ---
        footer_y = page_h - footer_h
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

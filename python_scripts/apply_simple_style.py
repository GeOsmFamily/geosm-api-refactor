#!/usr/bin/env python3
"""Apply a simple color+shape symbol (point/line/polygon) to a layer in a QGIS project.
Used to make ReviewPersonalLayerPublicationUseCase reuse the color/shape the user already chose
in the client-side preview (PersonalLayer.style) when publishing a FILE-sourced personal layer -
without this, the promoted catalog layer would render with QGIS's random default style instead
of what the user configured. Only used when no native QML style was uploaded (see set_style.py,
which takes priority when present)."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsMarkerSymbol, QgsLineSymbol, QgsFillSymbol,
    QgsSingleSymbolRenderer,
)

# Sous-ensemble des noms de forme SimpleMarker de QGIS - le "pin" de l'app n'a pas d'équivalent
# natif simple, on retombe sur un cercle (seule la couleur compte vraiment pour la cohérence
# visuelle avec l'aperçu client, la forme exacte est un détail mineur pour ce cas).
SHAPE_TO_QGIS_NAME = {
    'circle': 'circle',
    'square': 'square',
    'triangle': 'triangle',
    'star': 'star',
    'pin': 'circle',
}


def main():
    if len(sys.argv) < 6:
        print(json.dumps({
            "success": False,
            "error": "Usage: apply_simple_style.py <project_path> <layer_name> <geometry_type> <color> <shape>",
        }))
        sys.exit(1)

    project_path, layer_name, geometry_type, color, shape = sys.argv[1:6]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()
        project.read(project_path)

        layers = project.mapLayersByName(layer_name)
        if not layers:
            print(json.dumps({"success": False, "error": f"Layer not found: {layer_name}"}))
            sys.exit(1)

        layer = layers[0]
        gt = geometry_type.upper()

        if gt in ('LINESTRING', 'MULTILINESTRING'):
            symbol = QgsLineSymbol.createSimple({'color': color, 'width': '0.9'})
        elif gt in ('POLYGON', 'MULTIPOLYGON'):
            symbol = QgsFillSymbol.createSimple({
                'color': color, 'style': 'solid', 'outline_color': color,
                'outline_width': '0.6',
            })
            symbol.setOpacity(0.5)
        else:
            symbol = QgsMarkerSymbol.createSimple({
                'name': SHAPE_TO_QGIS_NAME.get(shape, 'circle'),
                'color': color,
                'outline_color': '#ffffff',
                'outline_width': '0.6',
                'size': '3.5',
            })

        layer.setRenderer(QgsSingleSymbolRenderer(symbol))
        layer.triggerRepaint()
        project.write(project_path)
        print(json.dumps({"success": True, "layer": layer_name}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

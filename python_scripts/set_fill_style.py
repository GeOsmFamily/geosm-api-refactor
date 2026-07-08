#!/usr/bin/env python3
"""Apply a solid fill/line color style to a polygon or line layer (points use
set_icon_on_layer.py instead, since they render as a marker, not a fill)."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsFillSymbol, QgsLineSymbol,
    QgsSingleSymbolRenderer, QgsWkbTypes
)


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: set_fill_style.py <project_path> <layer_name> <color> [strokeColor]"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    color = sys.argv[3]
    stroke_color = sys.argv[4] if len(sys.argv) > 4 else '#ffffff'

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()

        if not os.path.exists(project_path):
            print(json.dumps({"success": False, "error": f"Project not found: {project_path}"}))
            sys.exit(1)

        project.read(project_path)

        layers = project.mapLayersByName(layer_name)
        if not layers:
            print(json.dumps({"success": False, "error": f"Layer not found: {layer_name}"}))
            sys.exit(1)

        layer = layers[0]
        geom_type = layer.geometryType()

        if geom_type == QgsWkbTypes.GeometryType.PolygonGeometry:
            symbol = QgsFillSymbol.createSimple({'color': color, 'outline_color': stroke_color, 'outline_width': '0.4'})
        elif geom_type == QgsWkbTypes.GeometryType.LineGeometry:
            symbol = QgsLineSymbol.createSimple({'line_color': color, 'line_width': '0.8'})
        else:
            print(json.dumps({"success": False, "error": "Layer is not a polygon or line layer"}))
            sys.exit(1)

        layer.setRenderer(QgsSingleSymbolRenderer(symbol))
        project.write(project_path)

        result = {
            "success": True,
            "layerName": layer_name,
            "color": color,
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

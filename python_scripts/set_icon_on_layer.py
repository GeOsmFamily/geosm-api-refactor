#!/usr/bin/env python3
"""Set SVG icon on a point layer with cluster renderer."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsMarkerSymbol,
    QgsSvgMarkerSymbolLayer, QgsPointClusterRenderer,
    QgsSingleSymbolRenderer
)


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: set_icon_on_layer.py <project_path> <layer_name> <icon_path> [icon_size] [icon_color]"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    icon_path = sys.argv[3]
    icon_size = float(sys.argv[4]) if len(sys.argv) > 4 else 8
    icon_color = sys.argv[5] if len(sys.argv) > 5 else '#2196F3'

    # Initialize QGIS
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

        if layer.geometryType() != 0:  # Not a point layer
            print(json.dumps({"success": False, "error": "Layer is not a point layer"}))
            sys.exit(1)

        if not os.path.exists(icon_path):
            print(json.dumps({"success": False, "error": f"Icon file not found: {icon_path}"}))
            sys.exit(1)

        # Create marker symbol with SVG icon
        symbol = QgsMarkerSymbol.createSimple({})
        svg_layer = QgsSvgMarkerSymbolLayer(icon_path)
        svg_layer.setSize(icon_size)
        symbol.changeSymbolLayer(0, svg_layer)

        # Create cluster renderer
        renderer = QgsPointClusterRenderer()
        renderer.setClusterSymbol(QgsMarkerSymbol.createSimple({'color': icon_color, 'size': '12'}))
        renderer.setTolerance(40)

        # Set the embedded renderer
        embedded = QgsSingleSymbolRenderer(symbol)
        renderer.setEmbeddedRenderer(embedded)

        layer.setRenderer(renderer)

        project.write(project_path)

        result = {
            "success": True,
            "layerName": layer_name,
            "iconPath": icon_path,
            "iconSize": icon_size,
            "iconColor": icon_color
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

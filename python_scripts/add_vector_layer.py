#!/usr/bin/env python3
"""Add a vector layer to a QGIS project file."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsVectorLayer,
    QgsPointClusterRenderer, QgsMarkerSymbol,
    QgsSvgMarkerSymbolLayer, QgsSingleSymbolRenderer
)


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: add_vector_layer.py <project_path> <layer_path> <layer_name> [style_path] [icon_path] [icon_color]"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_path = sys.argv[2]
    layer_name = sys.argv[3]
    style_path = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != 'none' else None
    icon_path = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != 'none' else None
    icon_color = sys.argv[6] if len(sys.argv) > 6 else '#2196F3'

    # Initialize QGIS
    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()

        # Load existing project or create new
        if os.path.exists(project_path):
            project.read(project_path)

        # Add vector layer
        layer = QgsVectorLayer(layer_path, layer_name, 'ogr')
        if not layer.isValid():
            print(json.dumps({"success": False, "error": f"Invalid layer: {layer_path}"}))
            sys.exit(1)

        project.addMapLayer(layer)

        # Apply style
        if style_path and os.path.exists(style_path):
            layer.loadNamedStyle(style_path)
        elif icon_path and os.path.exists(icon_path) and layer.geometryType() == 0:  # Point
            apply_cluster_style(layer, icon_path, icon_color)

        # Enable WFS
        wfs_layers = project.readListEntry('WFSLayers', '/')[0]
        if layer.id() not in wfs_layers:
            wfs_layers.append(layer.id())
            project.writeEntry('WFSLayers', '/', wfs_layers)

        # Save project
        project.write(project_path)

        # Get info
        extent = layer.extent()
        result = {
            "success": True,
            "featureCount": layer.featureCount(),
            "crs": layer.crs().authid(),
            "bbox": [extent.xMinimum(), extent.yMinimum(), extent.xMaximum(), extent.yMaximum()],
            "geometryType": layer.geometryType(),
            "layerId": layer.id()
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


def apply_cluster_style(layer, icon_path, color):
    """Apply point cluster renderer with SVG icon."""
    # Create marker symbol with SVG icon
    symbol = QgsMarkerSymbol.createSimple({})
    svg_layer = QgsSvgMarkerSymbolLayer(icon_path)
    svg_layer.setSize(8)
    symbol.changeSymbolLayer(0, svg_layer)

    # Create cluster renderer
    renderer = QgsPointClusterRenderer()
    renderer.setClusterSymbol(QgsMarkerSymbol.createSimple({'color': color, 'size': '12'}))
    renderer.setTolerance(40)

    # Set the embedded renderer
    embedded = QgsSingleSymbolRenderer(symbol)
    renderer.setEmbeddedRenderer(embedded)

    layer.setRenderer(renderer)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Add a raster layer (GeoTIFF) to a QGIS project file."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsRasterLayer


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: add_raster_layer.py <project_path> <raster_path> <layer_name> [style_path]"}))
        sys.exit(1)

    project_path = sys.argv[1]
    raster_path = sys.argv[2]
    layer_name = sys.argv[3]
    style_path = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != 'none' else None

    # Initialize QGIS
    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()

        if os.path.exists(project_path):
            project.read(project_path)

        layer = QgsRasterLayer(raster_path, layer_name)
        if not layer.isValid():
            print(json.dumps({"success": False, "error": f"Invalid raster layer: {raster_path}"}))
            sys.exit(1)

        project.addMapLayer(layer)

        if style_path and os.path.exists(style_path):
            layer.loadNamedStyle(style_path)

        project.write(project_path)

        extent = layer.extent()
        result = {
            "success": True,
            "layerId": layer.id(),
            "crs": layer.crs().authid(),
            "bbox": [extent.xMinimum(), extent.yMinimum(), extent.xMaximum(), extent.yMaximum()]
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

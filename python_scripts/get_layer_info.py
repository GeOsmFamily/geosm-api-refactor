#!/usr/bin/env python3
"""Get detailed layer info from a QGIS project file."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: get_layer_info.py <project_path> <layer_name>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]

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
        extent = layer.extent()

        result = {
            "success": True,
            "name": layer.name(),
            "id": layer.id(),
            "crs": layer.crs().authid(),
            "extent": [extent.xMinimum(), extent.yMinimum(), extent.xMaximum(), extent.yMaximum()],
            "featureCount": layer.featureCount(),
            "geometryType": layer.geometryType(),
            "fields": [{"name": f.name(), "type": f.typeName()} for f in layer.fields()],
            "rendererType": layer.renderer().type() if layer.renderer() else None
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

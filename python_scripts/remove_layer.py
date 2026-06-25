#!/usr/bin/env python3
"""Remove a layer from a QGIS project."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: remove_layer.py <project_path> <layer_name>"}))
        sys.exit(1)

    project_path, layer_name = sys.argv[1], sys.argv[2]

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

        for layer in layers:
            project.removeMapLayer(layer.id())

        project.write(project_path)
        print(json.dumps({"success": True, "removed": layer_name}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Reload all layers in a QGIS project."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: reload_project.py <project_path>"}))
        sys.exit(1)

    project_path = sys.argv[1]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()
        if not os.path.exists(project_path):
            print(json.dumps({"success": False, "error": f"Project not found: {project_path}"}))
            sys.exit(1)

        project.read(project_path)

        # Reload all layers
        for layer in project.mapLayers().values():
            layer.reload()

        project.write(project_path)
        print(json.dumps({"success": True, "layerCount": len(project.mapLayers())}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

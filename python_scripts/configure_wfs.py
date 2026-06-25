#!/usr/bin/env python3
"""Configure WFS on specific layers in a QGIS project."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: configure_wfs.py <project_path> <layer_names_json>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_names = json.loads(sys.argv[2])

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

        wfs_layers = project.readListEntry('WFSLayers', '/')[0]
        configured = []

        for name in layer_names:
            layers = project.mapLayersByName(name)
            if not layers:
                print(json.dumps({"success": False, "error": f"Layer not found: {name}"}))
                sys.exit(1)
            layer = layers[0]
            if layer.id() not in wfs_layers:
                wfs_layers.append(layer.id())
            configured.append(name)

        project.writeEntry('WFSLayers', '/', wfs_layers)
        project.write(project_path)

        result = {
            "success": True,
            "configuredLayers": len(configured)
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

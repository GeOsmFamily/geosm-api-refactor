#!/usr/bin/env python3
"""Apply a QML style to a layer in a QGIS project."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: set_style.py <project_path> <layer_name> <qml_path>"}))
        sys.exit(1)

    project_path, layer_name, qml_path = sys.argv[1], sys.argv[2], sys.argv[3]

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
        msg, success = layer.loadNamedStyle(qml_path)
        if not success:
            print(json.dumps({"success": False, "error": f"Failed to load style: {msg}"}))
            sys.exit(1)

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

#!/usr/bin/env python3
"""Apply the native symbology embedded in a KML file (OGR_STYLE) to an existing layer of a
QGIS project - lets an admin who already has a styled KML skip the color/icon picker."""
import sys
import os
import json
import tempfile

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsVectorLayer


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: import_kml_style.py <project_path> <layer_name> <kml_path>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    kml_path = sys.argv[3]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        if not os.path.exists(kml_path):
            print(json.dumps({"success": False, "error": f"KML file not found: {kml_path}"}))
            sys.exit(1)

        # Le KML porte son propre style OGR (IconStyle/LineStyle/PolyStyle) - QGIS le
        # restitue automatiquement sur la couche source, il suffit de l'exporter en QML.
        kml_layer = QgsVectorLayer(kml_path, 'kml_style_source', 'ogr')
        if not kml_layer.isValid():
            print(json.dumps({"success": False, "error": f"Invalid KML file: {kml_path}"}))
            sys.exit(1)

        with tempfile.NamedTemporaryFile(suffix='.qml', delete=False) as tmp:
            tmp_qml_path = tmp.name
        kml_layer.saveNamedStyle(tmp_qml_path)

        project = QgsProject.instance()
        if not os.path.exists(project_path):
            print(json.dumps({"success": False, "error": f"Project not found: {project_path}"}))
            sys.exit(1)
        project.read(project_path)

        layers = project.mapLayersByName(layer_name)
        if not layers:
            print(json.dumps({"success": False, "error": f"Layer not found: {layer_name}"}))
            sys.exit(1)

        target_layer = layers[0]
        target_layer.loadNamedStyle(tmp_qml_path)
        project.write(project_path)

        os.unlink(tmp_qml_path)

        result = {"success": True, "layerName": layer_name}
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

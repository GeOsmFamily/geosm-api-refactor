#!/usr/bin/env python3
"""Edit layer properties in a QGIS project file."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsCoordinateReferenceSystem


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: edit_layer_properties.py <project_path> <layer_name> <properties_json>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    properties = json.loads(sys.argv[3])

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
        applied = []

        if 'opacity' in properties:
            layer.setOpacity(float(properties['opacity']))
            applied.append('opacity')

        if 'visible' in properties:
            layer.setVisible(bool(properties['visible']))
            applied.append('visible')

        if 'minZoom' in properties:
            layer.setMinimumScale(int(properties['minZoom']))
            layer.setScaleBasedVisibility(True)
            applied.append('minZoom')

        if 'maxZoom' in properties:
            layer.setMaximumScale(int(properties['maxZoom']))
            layer.setScaleBasedVisibility(True)
            applied.append('maxZoom')

        if 'crs' in properties:
            crs = QgsCoordinateReferenceSystem(properties['crs'])
            if crs.isValid():
                layer.setCrs(crs)
                applied.append('crs')
            else:
                print(json.dumps({"success": False, "error": f"Invalid CRS: {properties['crs']}"}))
                sys.exit(1)

        project.write(project_path)

        result = {
            "success": True,
            "layerName": layer_name,
            "appliedProperties": applied
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

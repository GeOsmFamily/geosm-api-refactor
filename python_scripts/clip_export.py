#!/usr/bin/env python3
"""Clip a layer by a boundary and export to file."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsVectorLayer
import processing
from processing.core.Processing import Processing


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: clip_export.py <project_path> <layer_name> <boundary_geojson_path> <output_path>"}))
        sys.exit(1)

    project_path, layer_name, boundary_path, output_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()
    Processing.initialize()

    try:
        project = QgsProject.instance()
        project.read(project_path)

        layers = project.mapLayersByName(layer_name)
        if not layers:
            print(json.dumps({"success": False, "error": f"Layer not found: {layer_name}"}))
            sys.exit(1)

        input_layer = layers[0]
        overlay = QgsVectorLayer(boundary_path, 'boundary', 'ogr')

        if not overlay.isValid():
            print(json.dumps({"success": False, "error": "Invalid boundary file"}))
            sys.exit(1)

        result = processing.run('native:clip', {
            'INPUT': input_layer,
            'OVERLAY': overlay,
            'OUTPUT': output_path
        })

        output_layer = QgsVectorLayer(result['OUTPUT'], 'output', 'ogr')
        print(json.dumps({
            "success": True,
            "outputPath": output_path,
            "featureCount": output_layer.featureCount() if output_layer.isValid() else 0
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

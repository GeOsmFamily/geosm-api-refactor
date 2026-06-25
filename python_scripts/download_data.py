#!/usr/bin/env python3
"""Clip layer data using native:clip processing algorithm."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsVectorLayer,
    QgsVectorFileWriter, QgsCoordinateTransformContext
)
import processing


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: download_data.py <project_path> <layer_name> <clip_layer_path> <output_path>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    clip_layer_path = sys.argv[3]
    output_path = sys.argv[4]

    # Initialize QGIS
    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    # Initialize processing
    from processing.core.Processing import Processing
    Processing.initialize()

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

        clip_layer = QgsVectorLayer(clip_layer_path, 'clip', 'ogr')
        if not clip_layer.isValid():
            print(json.dumps({"success": False, "error": f"Invalid clip layer: {clip_layer_path}"}))
            sys.exit(1)

        # Run clip
        clip_result = processing.run('native:clip', {
            'INPUT': layer,
            'OVERLAY': clip_layer,
            'OUTPUT': 'memory:'
        })

        result_layer = clip_result['OUTPUT']

        # Write output
        options = QgsVectorFileWriter.SaveVectorOptions()
        options.driverName = 'GeoJSON'
        options.fileEncoding = 'UTF-8'

        context = QgsCoordinateTransformContext()
        error = QgsVectorFileWriter.writeAsVectorFormatV3(
            result_layer, output_path, context, options
        )

        if error[0] != QgsVectorFileWriter.NoError:
            print(json.dumps({"success": False, "error": f"Write failed: {error[1]}"}))
            sys.exit(1)

        result = {
            "success": True,
            "outputPath": output_path,
            "featureCount": result_layer.featureCount()
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

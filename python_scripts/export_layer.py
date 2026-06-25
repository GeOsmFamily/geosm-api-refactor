#!/usr/bin/env python3
"""Export a layer from a QGIS project to a file format."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import (
    QgsApplication, QgsProject, QgsVectorFileWriter,
    QgsCoordinateTransformContext
)


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: export_layer.py <project_path> <layer_name> <output_path> <format>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    layer_name = sys.argv[2]
    output_path = sys.argv[3]
    output_format = sys.argv[4]

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

        options = QgsVectorFileWriter.SaveVectorOptions()
        options.driverName = output_format
        options.fileEncoding = 'UTF-8'

        context = QgsCoordinateTransformContext()
        error = QgsVectorFileWriter.writeAsVectorFormatV3(
            layer, output_path, context, options
        )

        if error[0] != QgsVectorFileWriter.NoError:
            print(json.dumps({"success": False, "error": f"Export failed: {error[1]}"}))
            sys.exit(1)

        result = {
            "success": True,
            "outputPath": output_path,
            "featureCount": layer.featureCount()
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

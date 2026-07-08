#!/usr/bin/env python3
"""Package a live (PostGIS-backed) QGIS project into a fully offline, portable bundle: every
layer's current data is copied into a single GeoPackage, styles are preserved (QgsOfflineEditing
repoints each layer's data source without touching its renderer), and the rewritten project uses
relative paths so it can be opened directly in QGIS Desktop after being unzipped anywhere."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsOfflineEditing


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: export_offline_bundle.py <project_path> <output_dir>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    output_dir = sys.argv[2]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        if not os.path.exists(project_path):
            print(json.dumps({"success": False, "error": f"Project not found: {project_path}"}))
            sys.exit(1)

        os.makedirs(output_dir, exist_ok=True)

        project = QgsProject.instance()
        if not project.read(project_path):
            print(json.dumps({"success": False, "error": "Failed to read project"}))
            sys.exit(1)

        layers = project.mapLayers()
        # QgsOfflineEditing ne sait convertir que les couches vecteur avec un provider distant
        # (postgres) - les couches déjà locales/fichier (rasters importés, etc.) sont laissées
        # telles quelles, leurs fichiers sources sont copiés à part par le use-case appelant.
        convertible_ids = [
            lid for lid, layer in layers.items()
            if layer.type() == layer.LayerType.VectorLayer and layer.providerType() == 'postgres'
        ]

        gpkg_name = 'data.gpkg'
        if convertible_ids:
            offline_editing = QgsOfflineEditing()
            ok = offline_editing.convertToOfflineProject(output_dir, gpkg_name, convertible_ids, False, QgsOfflineEditing.GPKG)
            if not ok:
                print(json.dumps({"success": False, "error": "convertToOfflineProject failed"}))
                sys.exit(1)

        out_project_path = os.path.join(output_dir, 'project.qgs')
        project.write(out_project_path)

        result = {
            "success": True,
            "projectFile": out_project_path,
            "gpkgFile": os.path.join(output_dir, gpkg_name) if convertible_ids else None,
            "convertedLayerCount": len(convertible_ids),
            "totalLayerCount": len(layers),
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

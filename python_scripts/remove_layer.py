#!/usr/bin/env python3
"""Remove a layer from a QGIS project by name, and scrub any now-stale references left in the
project's WFSLayers/WMSRestrictedLayers property lists.

QgsProject.removeMapLayer() only detaches the layer node itself - it does NOT clean up these
separate custom property lists (each just a flat list of layer ids, written independently by
add_vector_layer.py when a layer is first added for WFS). A stale id left behind here makes QGIS
Server's strict layer validation reject EVERY request against the whole project (not just the
removed layer) with "Invalid layers for project ... - strict mode on" - this exact scenario broke
a live instance project during development when layers were deleted without this scrubbing step,
so it is not optional cleanup, it is required for the project to keep loading at all."""
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

        # Collecte d'abord les ids dans une liste Python simple, PUIS supprime par id - itérer sur
        # les objets QgsMapLayer eux-mêmes pendant qu'on les retire peut lever "wrapped C/C++
        # object ... has been deleted" (le wrapper SIP de l'objet retiré devient invalide en cours
        # d'itération).
        matching_ids = [layer.id() for layer in project.mapLayersByName(layer_name)]
        if not matching_ids:
            print(json.dumps({"success": False, "error": f"Layer not found: {layer_name}"}))
            sys.exit(1)

        for layer_id in matching_ids:
            project.removeMapLayer(layer_id)

        real_ids = set(project.mapLayers().keys())
        wfs_layers, _ = project.readListEntry('WFSLayers', '/')
        project.writeEntry('WFSLayers', '/', [v for v in wfs_layers if v in real_ids])
        restricted, _ = project.readListEntry('WMSRestrictedLayers', '/')
        project.writeEntry('WMSRestrictedLayers', '/', [v for v in restricted if v in real_ids])

        project.write(project_path)
        print(json.dumps({"success": True, "removed": layer_name, "removedIds": matching_ids}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

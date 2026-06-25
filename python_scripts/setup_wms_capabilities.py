#!/usr/bin/env python3
"""Configure WMS/WFS capabilities on a QGIS project."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: setup_wms_capabilities.py <project_path> <config_json>"}))
        sys.exit(1)

    project_path = sys.argv[1]
    config = json.loads(sys.argv[2])

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        project = QgsProject.instance()
        if os.path.exists(project_path):
            project.read(project_path)

        # Set WMS service capabilities
        project.writeEntry('WMSServiceTitle', '/', config.get('title', 'GeOSM WMS'))
        project.writeEntry('WMSServiceAbstract', '/', config.get('abstract', ''))
        project.writeEntry('WMSContactMail', '/', config.get('contactEmail', ''))
        project.writeEntry('WMSContactOrganization', '/', config.get('organization', 'GeOSM'))
        project.writeEntry('WMSAddWktGeometry', '/', True)

        # Set CRS list
        crs_list = config.get('crsList', ['EPSG:4326', 'EPSG:3857'])
        project.writeEntry('WMSCrsList', '/', crs_list)

        # Set extent if provided
        if 'extent' in config:
            ext = config['extent']
            project.writeEntry('WMSExtent', '/', [str(ext[0]), str(ext[1]), str(ext[2]), str(ext[3])])

        # Enable all layers for WFS
        wfs_layers = []
        for layer_id in project.mapLayers():
            wfs_layers.append(layer_id)
        project.writeEntry('WFSLayers', '/', wfs_layers)

        project.write(project_path)
        print(json.dumps({"success": True, "layerCount": len(project.mapLayers())}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

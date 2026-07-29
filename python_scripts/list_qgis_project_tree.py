#!/usr/bin/env python3
"""Walk a QGIS project's layer tree (groups/sub-groups/layers) and return it as nested JSON.
Used to auto-recreate a project's thematic organization (Group/SubGroup) in GeOSM's catalog on
import, instead of requiring an admin to manually pick one subgroup for every layer. The
WMS-GetCapabilities-based listing (list_qgis_project_layers, see
ListQgisProjectLayersUseCase) is flat by design and doesn't carry this structure - this script
reads the project's real layer tree directly via PyQGIS instead."""
import sys
import os
import json

os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from qgis.core import QgsApplication, QgsProject, QgsLayerTreeGroup, QgsLayerTreeLayer, QgsWkbTypes


def geometry_type_name(layer):
    try:
        geom_type = layer.geometryType()
        if geom_type == QgsWkbTypes.PointGeometry:
            return 'POINT'
        if geom_type == QgsWkbTypes.LineGeometry:
            return 'LINESTRING'
        if geom_type == QgsWkbTypes.PolygonGeometry:
            return 'POLYGON'
    except Exception:
        pass
    return 'POINT'


def walk(node):
    children = []
    for child in node.children():
        if isinstance(child, QgsLayerTreeGroup):
            children.append({
                "type": "group",
                "name": child.name(),
                "children": walk(child),
            })
        elif isinstance(child, QgsLayerTreeLayer):
            layer = child.layer()
            if layer is None:
                continue
            children.append({
                "type": "layer",
                "name": layer.name(),
                "geometryType": geometry_type_name(layer),
            })
    return children


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: list_qgis_project_tree.py <project_path>"}))
        sys.exit(1)

    project_path = sys.argv[1]

    QgsApplication.setPrefixPath('/usr', True)
    qgs = QgsApplication([], False)
    qgs.initQgis()

    try:
        if not os.path.exists(project_path):
            print(json.dumps({"success": False, "error": f"Project not found: {project_path}"}))
            sys.exit(1)

        project = QgsProject.instance()
        project.read(project_path)

        tree = walk(project.layerTreeRoot())
        print(json.dumps({"success": True, "tree": tree}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        qgs.exitQgis()


if __name__ == '__main__':
    main()

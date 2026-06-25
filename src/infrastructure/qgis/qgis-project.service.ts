import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { logger } from '../observability/logger.js';
import { config } from '../../config/env.config.js';

const execAsync = promisify(exec);

interface PyQGISResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export class QGISProjectService {
  private readonly scriptsDir: string;
  private readonly projectsDir: string;
  private readonly stylesDir: string;
  private readonly qgisServerUrl: string;

  constructor() {
    this.scriptsDir = path.resolve(process.cwd(), 'python_scripts');
    this.projectsDir = config.QGIS_PROJECTS_DIR;
    this.stylesDir = config.QGIS_STYLES_DIR;
    this.qgisServerUrl = config.QGIS_SERVER_URL;
  }

  private async runPythonScript(scriptName: string, args: string[]): Promise<PyQGISResult> {
    const scriptPath = path.join(this.scriptsDir, scriptName);
    const escapedArgs = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    const cmd = `python3 "${scriptPath}" ${escapedArgs}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 });
      if (stderr) logger.warn('PyQGIS stderr', { script: scriptName, stderr: stderr.trim() });

      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      return JSON.parse(lastLine) as PyQGISResult;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('PyQGIS script failed', { script: scriptName, error: msg });
      return { success: false, error: msg };
    }
  }

  getProjectPath(instanceSlug: string, thematicId?: string): string {
    const dir = path.join(this.projectsDir, instanceSlug);
    if (thematicId) {
      return path.join(dir, `${instanceSlug}_${thematicId}.qgs`);
    }
    return path.join(dir, `${instanceSlug}.qgs`);
  }

  async ensureProjectDir(instanceSlug: string): Promise<string> {
    const dir = path.join(this.projectsDir, instanceSlug);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    return dir;
  }

  async addVectorLayer(
    projectPath: string,
    layerPath: string,
    layerName: string,
    options?: { stylePath?: string; iconPath?: string; iconColor?: string },
  ): Promise<PyQGISResult> {
    const dir = path.dirname(projectPath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    return this.runPythonScript('add_vector_layer.py', [
      projectPath,
      layerPath,
      layerName,
      options?.stylePath || 'none',
      options?.iconPath || 'none',
      options?.iconColor || '#2196F3',
    ]);
  }

  async reloadProject(projectPath: string): Promise<PyQGISResult> {
    return this.runPythonScript('reload_project.py', [projectPath]);
  }

  async setLayerStyle(projectPath: string, layerName: string, qmlPath: string): Promise<PyQGISResult> {
    return this.runPythonScript('set_style.py', [projectPath, layerName, qmlPath]);
  }

  async saveLayerStyle(projectPath: string, layerName: string, outputPath: string): Promise<PyQGISResult> {
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    return this.runPythonScript('save_style.py', [projectPath, layerName, outputPath]);
  }

  async removeLayer(projectPath: string, layerName: string): Promise<PyQGISResult> {
    return this.runPythonScript('remove_layer.py', [projectPath, layerName]);
  }

  async setupWMSCapabilities(projectPath: string, wmsConfig: {
    title?: string;
    abstract?: string;
    contactEmail?: string;
    organization?: string;
    crsList?: string[];
    extent?: [number, number, number, number];
  }): Promise<PyQGISResult> {
    return this.runPythonScript('setup_wms_capabilities.py', [projectPath, JSON.stringify(wmsConfig)]);
  }

  async clipExport(projectPath: string, layerName: string, boundaryPath: string, outputPath: string): Promise<PyQGISResult> {
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    return this.runPythonScript('clip_export.py', [projectPath, layerName, boundaryPath, outputPath]);
  }

  getWMSUrl(instanceSlug: string, thematicId?: string): string {
    const projectPath = this.getProjectPath(instanceSlug, thematicId);
    return `${this.qgisServerUrl}?map=${projectPath}`;
  }
}

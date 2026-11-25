import type { FacebookWorkflowConfig } from '../facebook-import/FacebookWorkflowCanvas';

export interface WorkflowBundleFile {
  format: 'bolthaven-workflow-bundle';
  version: 1;
  exportedAt: string;
  name: string;
  includes: {
    workflow: boolean;
    promptTemplates: boolean;
    cropFormats: boolean;
  };
  workflow?: {
    name: string;
    description?: string;
    config: FacebookWorkflowConfig;
  };
  promptTemplates?: any[];
  cropFormats?: any[];
}

export interface ExportBundleOptions {
  fileName: string;
  workflowName: string;
  workflowDescription?: string;
  workflowConfig?: FacebookWorkflowConfig;
  includeWorkflow: boolean;
  includePromptTemplates: boolean;
  includeCropFormats: boolean;
}

export interface ImportBundleOptions {
  importWorkflow: boolean;
  importPromptTemplates: boolean;
  importCropFormats: boolean;
  workflowImportMode: 'new' | 'replace';
}

export interface ImportBundleResult {
  workflowApplied: boolean;
  promptTemplatesCount: number;
  cropFormatsCount: number;
}

/**
 * Strip runtime/extracted listing data from a workflow config so the exported
 * file contains only the clean workflow graph, node settings, and line colors.
 */
export function sanitizeWorkflowConfigForExport(config: FacebookWorkflowConfig): FacebookWorkflowConfig {
  const clone: FacebookWorkflowConfig = JSON.parse(JSON.stringify(config));

  if (clone.trigger) {
    delete clone.trigger.extractedPost;
    delete clone.trigger.rawUrl;
    delete clone.trigger.manualImages;
  }

  if (Array.isArray(clone.aiBoxes)) {
    clone.aiBoxes = clone.aiBoxes.map((box: any) => {
      const cleaned = { ...box };
      delete cleaned._liveGroupTabs;
      delete cleaned.lastResult;
      delete cleaned.lastOutput;
      return cleaned;
    });
  }

  return clone;
}

export async function fetchPromptTemplatesForBundle(): Promise<any[]> {
  try {
    const res = await fetch('/api/prompt-templates');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.templates)) return data.templates;
    }
  } catch {}
  try {
    const raw = localStorage.getItem('ea_prompt_templates');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export async function fetchCropFormatsForBundle(): Promise<any[]> {
  try {
    const res = await fetch('/api/crop-formats');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.formats)) return data.formats;
    }
  } catch {}
  try {
    const raw = localStorage.getItem('ea_crop_formats');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export async function buildWorkflowBundle(options: ExportBundleOptions): Promise<WorkflowBundleFile> {
  const [promptTemplates, cropFormats] = await Promise.all([
    options.includePromptTemplates ? fetchPromptTemplatesForBundle() : Promise.resolve(undefined),
    options.includeCropFormats ? fetchCropFormatsForBundle() : Promise.resolve(undefined),
  ]);

  const bundle: WorkflowBundleFile = {
    format: 'bolthaven-workflow-bundle',
    version: 1,
    exportedAt: new Date().toISOString(),
    name: options.workflowName || 'BoltHaven Workflow',
    includes: {
      workflow: Boolean(options.includeWorkflow && options.workflowConfig),
      promptTemplates: Boolean(options.includePromptTemplates),
      cropFormats: Boolean(options.includeCropFormats),
    },
  };

  if (options.includeWorkflow && options.workflowConfig) {
    bundle.workflow = {
      name: options.workflowName || 'Imported Workflow',
      description: options.workflowDescription || '',
      config: sanitizeWorkflowConfigForExport(options.workflowConfig),
    };
  }

  if (options.includePromptTemplates) {
    bundle.promptTemplates = promptTemplates || [];
  }

  if (options.includeCropFormats) {
    bundle.cropFormats = cropFormats || [];
  }

  return bundle;
}

export function downloadBundleFile(bundle: WorkflowBundleFile, fileName: string): void {
  const safeBase = (fileName || bundle.name || 'workflow-bundle')
    .trim()
    .replace(/\.bolthaven\.json$/i, '')
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workflow-bundle';

  const finalName = `${safeBase}.bolthaven.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseWorkflowBundle(jsonText: string): WorkflowBundleFile {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON file.');
  }

  // Standard BoltHaven bundle
  if (parsed.format === 'bolthaven-workflow-bundle') {
    return parsed as WorkflowBundleFile;
  }

  // Fallback: raw FacebookWorkflowConfig object
  if (parsed.trigger && parsed.getContent && parsed.getImages && Array.isArray(parsed.aiBoxes)) {
    return {
      format: 'bolthaven-workflow-bundle',
      version: 1,
      exportedAt: new Date().toISOString(),
      name: 'Imported Workflow',
      includes: { workflow: true, promptTemplates: false, cropFormats: false },
      workflow: {
        name: 'Imported Workflow',
        config: parsed as FacebookWorkflowConfig,
      },
    };
  }

  throw new Error('Unsupported file format. Please select a .bolthaven.json export file.');
}

function mergeByIdOrName(existing: any[], incoming: any[]): any[] {
  const result = [...existing];
  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue;
    const idx = result.findIndex(
      (e) => (item.id && e.id === item.id) || (item.name && e.name && e.name.toLowerCase() === item.name.toLowerCase())
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...item, id: result[idx].id || item.id };
    } else {
      result.push(item);
    }
  }
  return result;
}

export async function applyWorkflowBundleImport(
  bundle: WorkflowBundleFile,
  options: ImportBundleOptions,
  onApplyWorkflow?: (name: string, config: FacebookWorkflowConfig, mode: 'new' | 'replace', description?: string) => void
): Promise<ImportBundleResult> {
  let promptTemplatesCount = 0;
  let cropFormatsCount = 0;
  let workflowApplied = false;

  if (options.importPromptTemplates && Array.isArray(bundle.promptTemplates) && bundle.promptTemplates.length > 0) {
    const existing = await fetchPromptTemplatesForBundle();
    const merged = mergeByIdOrName(existing, bundle.promptTemplates);
    const res = await fetch('/api/prompt-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: merged }),
    });
    if (!res.ok) {
      throw new Error(`Failed to save imported prompt templates (HTTP ${res.status})`);
    }
    try {
      localStorage.setItem('ea_prompt_templates', JSON.stringify(merged));
    } catch {}
    promptTemplatesCount = bundle.promptTemplates.length;
  }

  if (options.importCropFormats && Array.isArray(bundle.cropFormats) && bundle.cropFormats.length > 0) {
    const existing = await fetchCropFormatsForBundle();
    const merged = mergeByIdOrName(existing, bundle.cropFormats);
    const res = await fetch('/api/crop-formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formats: merged }),
    });
    if (!res.ok) {
      throw new Error(`Failed to save imported crop formats (HTTP ${res.status})`);
    }
    try {
      localStorage.setItem('ea_crop_formats', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('cropFormatsUpdated'));
    } catch {}
    cropFormatsCount = bundle.cropFormats.length;
  }

  if (options.importWorkflow && bundle.workflow?.config && onApplyWorkflow) {
    const cleanConfig = sanitizeWorkflowConfigForExport(bundle.workflow.config);
    onApplyWorkflow(
      bundle.workflow.name || bundle.name || 'Imported Workflow',
      cleanConfig,
      options.workflowImportMode,
      bundle.workflow.description
    );
    workflowApplied = true;
  }

  return {
    workflowApplied,
    promptTemplatesCount,
    cropFormatsCount,
  };
}

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ModuleConfig } from './types';
import { Syslog } from './syslog';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Scans the modules/ directory and dynamically imports every subfolder
 * that contains an index.ts exporting a default ModuleConfig.
 *
 * Convention for module authors:
 *   modules/<your-module>/index.ts  →  export default { name, description, ... }
 *
 * No changes to any other file are needed to register a new module.
 */
export async function loadModules(): Promise<ModuleConfig[]> {
    const modulesDir = join(__dirname, '..', 'modules');
    const modules: ModuleConfig[] = [];

    let entries: ReturnType<typeof readdirSync>;
    try {
        entries = readdirSync(modulesDir, { withFileTypes: true });
    } catch {
        Syslog.error('module_loader', `Could not read modules directory: ${modulesDir}`);
        return [];
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const indexPath = join(modulesDir, entry.name, 'index.ts');
        if (!existsSync(indexPath)) continue;

        try {
            // Dynamic import via file:// URL — works with tsx's native TS loader
            const imported = await import(pathToFileURL(indexPath).href);
            const config = resolveConfig(imported);

            if (config) {
                modules.push(config);
                Syslog.info('module_loader', `Discovered module: [${config.name}] — ${config.description}`);
            } else {
                Syslog.warn(
                    'module_loader',
                    `Skipping modules/${entry.name}/index.ts — no default ModuleConfig export found.`
                );
            }
        } catch (err) {
            Syslog.error('module_loader', `Failed to load modules/${entry.name}/index.ts`, err);
        }
    }

    return modules;
}

/**
 * Resolves a ModuleConfig from an ES module's exports.
 * Checks `default` first, then falls back to any named export that looks like a ModuleConfig.
 */
function resolveConfig(imported: Record<string, unknown>): ModuleConfig | null {
    if (isModuleConfig(imported.default)) return imported.default as ModuleConfig;

    for (const key of Object.keys(imported)) {
        if (isModuleConfig(imported[key])) return imported[key] as ModuleConfig;
    }

    return null;
}

function isModuleConfig(obj: unknown): obj is ModuleConfig {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof (obj as ModuleConfig).name === 'string' &&
        typeof (obj as ModuleConfig).description === 'string'
    );
}

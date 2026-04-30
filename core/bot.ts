import { Kernel } from './kernel';
import { loadModules } from './moduleLoader';

// Auto-discovers every modules/<folder>/index.ts that exports a default ModuleConfig.
// To add a new module: create the folder and its index.ts — nothing else needed.
const modules = await loadModules();
const system = new Kernel(modules);
system.boot();
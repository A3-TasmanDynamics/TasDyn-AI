import { Kernel } from './kernel';
import { loadModules } from './moduleLoader';
import { startApiServer } from './apiServer';

// Auto-discovers every modules/<folder>/index.ts that exports a default ModuleConfig.
// To add a new module: create the folder and its index.ts — nothing else needed.
const modules = await loadModules();
const system = new Kernel(modules);
system.boot();

// Opt-in HTTP API for TasDyn-Web's admin panel — no-op unless API_PORT/API_TOKEN are set.
startApiServer();
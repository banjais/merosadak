import module from 'node:module';
import path from 'node:path';
import url from 'node:url';

const require = module.createRequire(import.meta.url);

globalThis.require = require;
globalThis.__filename = url.fileURLToPath(import.meta.url);
globalThis.__dirname = path.dirname(globalThis.__filename);
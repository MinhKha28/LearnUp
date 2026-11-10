import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Await server readiness and suite registration before Node begins execution.
await require('./harness.ts').ready;

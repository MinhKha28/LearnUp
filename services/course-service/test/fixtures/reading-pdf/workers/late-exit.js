// Test worker: answers at once, then blocks in native code for ~1 s so
// terminate() (and the worker's exit) can only finish after that.
const { spawnSync } = require('node:child_process');
const { parentPort } = require('node:worker_threads');

parentPort.postMessage({ ok: true, text: 'late exit' });
spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)']);

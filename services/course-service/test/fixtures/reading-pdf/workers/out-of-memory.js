// Test worker: grows the heap until resourceLimits stops it.
const retained = [];
for (;;) {
  retained.push(new Array(100_000).fill({ value: retained.length }));
}

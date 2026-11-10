const fs = require("node:fs"),
  path = require("node:path");
const directory = path.join(__dirname, "results", "completion-paired");
const median = (a) => [...a].sort((a, b) => a - b)[1];
const summaries = [];
for (const vus of [1, 2, 100, 200, 1000, 2000]) {
  const read = (side) =>
    [1, 2, 3].map((run) => {
      const file = path.join(directory, `${side}-${vus}-${run}-report.json`);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
    });
  const baseline = read("baseline"),
    branch = read("branch");
  if ([...baseline, ...branch].some((x) => !x)) break;
  const phases = ["coverage", "trigger"].map((phase) => {
    const values = (rows) =>
      ["med", "p(95)", "p(99)"].map((k) =>
        median(rows.map((r) => r.phases[phase][k])),
      );
    const a = values(baseline),
      b = values(branch),
      threshold = Math.max(500, 1.5 * a[2]);
    return {
      phase,
      baseline: a,
      branch: b,
      changePercent: (b[2] / a[2] - 1) * 100,
      threshold,
      breaches: branch.filter((r) => r.phases[phase]["p(99)"] > threshold)
        .length,
    };
  });
  const result = {
    vus,
    phases,
    completionP95: branch.map((r) => r.total.p95),
    queueP95: branch.map((r) => r.queue.p95),
    assessmentP95: branch.map((r) => r.assessment.p95),
    transactionP95: branch.map((r) => r.transaction.p95),
    errors: [...baseline, ...branch].map((r) => r.failureRate),
    counts: branch.map((r) => [r.completed, r.events]),
  };
  summaries.push(result);
  console.log(JSON.stringify(result));
  if (
    phases.some((p) => p.breaches >= 2) ||
    [...baseline, ...branch].some((r) => r.failureRate > 0.01) ||
    branch.some((r) => r.completed !== vus || r.events !== vus)
  )
    break;
}
fs.writeFileSync(
  path.join(__dirname, "results", "completion-paired-analysis.json"),
  JSON.stringify(summaries, null, 2),
);

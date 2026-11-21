# Performance measurement guide

## Scripts and evidence

Keep shared workload scripts and runners under perf/<service>/ using the existing
file conventions (.js, .cjs or .ps1). Service-local probes may remain under that
service's test/perf/. Keep machine-specific results private in an ignored
perf/<service>/results/ directory or an explicitly configured directory outside
the checkout. Verify ignore coverage before writing results; do not commit them.
The Achievement read harness requires its output outside the repository.

## Workload selection and reporting

Choose levels for the workload and the available resources before running, and increase load step by step until the benchmark's own stop conditions are reached. No level is a mandatory capacity target.
Record throughput, p50/p95/p99 latency, error rate, correctness counts, machine
topology, resource limits, source revisions and worker/relay settings. Report
which dependencies are real or substituted and whether traffic includes the
gateway. Keep private infrastructure details out of published evidence.

## Existing benchmark procedures

- For Learning completion comparisons, use the baseline, interleaving, correctness
  checks and stop conditions in [the Learning service guide](../services/learning-service/README.md).
- For the older enrollment arrival-rate procedure, use [the Learning benchmark
  guide](learning/README.md#workloads). Its arrival rates and acceptance criteria
  apply to that workload; do not combine them with the completion VU procedure.
- For Achievement issuance and reads, use [the service guide](../services/achievement-reporting-service/README.md).
  These synthetic harnesses have their own dependencies and output requirements.

Use each benchmark's declared topology consistently for comparisons. For the
Learning Docker HTTP benchmark, run k6 in the deployment network and address
containerized services by service name; exclude host-bridge HTTP measurements.
Other harnesses may use different topologies and must report them explicitly.

import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";

const rate = Number(__ENV.RATE || 10);
if (![10, 30, 60, 100].includes(rate))
  throw new Error("RATE must be 10/30/60/100.");
const id = (kind, n) =>
  `2720${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const options = {
  scenarios: {
    progress: {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  summaryTrendStats: ["min", "med", "p(95)", "p(99)", "max"],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate==0"],
    checks: ["rate==1"],
    dropped_iterations: ["count==0"],
  },
};
export default function () {
  const iteration = exec.scenario.iterationInTest;
  const slots = rate * 15 + 1;
  const n = (iteration % slots) + 1;
  const end = (Math.floor(iteration / slots) + 1) * 15;
  const response = http.post(
    `${__ENV.BASE_URL}/api/v1/enrollments/${id("0001", n)}/materials/${id("0004", (n - 1) * 4 + 1)}/progress`,
    JSON.stringify({ ranges: [[0, end]], positionSeconds: end, reportedAt: new Date().toISOString() }),
    {
      headers: {
        "content-type": "application/json",
        "x-internal-key": __ENV.INTERNAL_SERVICE_KEY,
        "x-user-role": "LEARNER",
        "x-user-id": id("0002", n),
        "x-organization-id": "27200000-0000-4000-8000-000000000010",
      },
      tags: { name: "UC27.2 progress" },
    },
  );
  check(response, {
    "200 and saved media range": (r) =>
      r.status === 200 && r.json("data.watchedSeconds") >= end,
  });
}
export function handleSummary(data) {
  return {
    [`/results/uc27.2-${rate}-summary.json`]: JSON.stringify(data, null, 2),
  };
}

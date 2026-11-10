import http from "k6/http";
import { SharedArray } from "k6/data";
import { check } from "k6";
import exec from "k6/execution";
import { Rate } from "k6/metrics";
const fixtures = new SharedArray("enrollments", () =>
  JSON.parse(open(__ENV.FIXTURES)),
);
const timeouts = new Rate("access_timeouts");
export const options = {
  scenarios: {
    access: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: Number(__ENV.VUS) },
        { duration: "60s", target: Number(__ENV.VUS) },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    "http_req_duration{phase:steady}": [],
    "http_reqs{phase:steady}": [],
    "http_req_failed{phase:steady}": [],
    "checks{phase:steady}": [],
    "access_timeouts{phase:steady}": [],
  },
  summaryTrendStats: ["med", "p(95)", "p(99)", "max"],
};
export default function () {
  const row = fixtures[exec.scenario.iterationInTest % fixtures.length];
  const steady = exec.instance.currentTestRunDuration >= 15000;
  const r = http.get(
    `${__ENV.BASE_URL}/api/v1/internal/enrollments/assessment-access?learnerId=${row.learnerId}&courseId=${row.courseId}`,
    {
      headers: {
        "x-internal-key": __ENV.INTERNAL_SERVICE_KEY,
        "x-user-id": row.learnerId,
        "x-organization-id": row.organizationId,
        "x-user-role": "LEARNER",
      },
      tags: {
        phase: steady ? "steady" : "warmup",
        name: "L17 assessment access",
      },
      timeout: "10s",
    },
  );
  check(
    r,
    {
      "correct access": (res) => {
        if (res.status !== 200) return false;
        const data = res.json("data");
        return (
          data.enrollmentId === row.enrollmentId &&
          data.status === row.status &&
          data.access === row.access
        );
      },
    },
    { phase: steady ? "steady" : "warmup" },
  );
  timeouts.add(r.error_code === 1050, { phase: steady ? "steady" : "warmup" });
}
export function handleSummary(data) {
  return { [__ENV.SUMMARY]: JSON.stringify(data, null, 2) };
}

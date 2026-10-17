import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const mode = __ENV.MODE || "B";
const vus = Number(__ENV.VUS || 2);
const base = __ENV.BASE_URL || "http://host.docker.internal:8085";
const org = "25030000-0000-4000-8000-000000000001";
const courseId = "25030001-0000-4000-8000-000000000001";
const success = new Counter("enrolled_201");
const conflicts = new Counter("already_enrolled_409");
const limited = new Counter("rate_limited_429");
const others = new Counter("other_user_201");
const serverErrors = new Counter("server_errors");
const timeouts = new Counter("timeouts");
const failures = new Rate("unexpected_responses");
const latency = new Trend("enrollment_duration", true);
const statuses = new Counter("http_status");
const target = mode === "A" ? 6 : vus;
// SQL verification also requires zero duplicate enrollments, one snapshot set, and zero orphans.
// The proposed p95 target for 200 VU is 500 ms; failure requires reporting, not tuning.
const thresholds = {
  checks: ["rate==1"],
  server_errors: ["count==0"],
  timeouts: ["count==0"],
  unexpected_responses: ["rate==0"],
  enrolled_201: [`count==${target}`],
};
if (mode === "A") {
  thresholds.already_enrolled_409 = ["count==9"];
  thresholds.rate_limited_429 = ["count==5"];
  thresholds.other_user_201 = ["count==5"];
} else if (vus === 200) thresholds.enrollment_duration = ["p(95)<500"];
export const options = {
  scenarios:
    mode === "A"
      ? {
          main_user: {
            executor: "per-vu-iterations",
            exec: "mainUser",
            vus: 1,
            iterations: 1,
            maxDuration: "30s",
          },
          other_users: {
            executor: "per-vu-iterations",
            exec: "otherUser",
            vus: 5,
            iterations: 1,
            maxDuration: "30s",
          },
        }
      : {
          hot_course: {
            executor: "per-vu-iterations",
            exec: "hotCourse",
            vus,
            iterations: 1,
            maxDuration: "60s",
          },
        },
  thresholds,
  summaryTrendStats: ["med", "p(95)", "p(99)", "max"],
};

function request(user, expected) {
  user += Number(__ENV.USER_OFFSET || 0);
  if (!Number.isInteger(user) || user < 1 || user > 2000)
    throw new Error("Perf learner must be between 1 and 2000");
  const response = http.post(
    `${base}/api/v1/enrollments`,
    JSON.stringify({ courseId }),
    {
      headers: {
        "content-type": "application/json",
        "x-internal-key": __ENV.INTERNAL_SERVICE_KEY,
        "x-user-id": `25031000-0000-4000-8000-${String(user).padStart(12, "0")}`,
        "x-organization-id": org,
        "x-user-role": "LEARNER",
      },
      timeout: "30s",
      tags: { expected_status: String(expected) },
      responseCallback: http.expectedStatuses(expected),
    },
  );
  latency.add(response.timings.duration);
  statuses.add(1, { status: String(response.status) });
  serverErrors.add(response.status >= 500 ? 1 : 0);
  timeouts.add(response.error_code === 1050 ? 1 : 0);
  let error;
  try {
    error = response.json("error");
  } catch (_) {
    error = null;
  }
  const valid =
    response.status === expected &&
    (expected !== 409 || error?.code === "ALREADY_ENROLLED") &&
    (expected !== 429 ||
      (error?.code === "RATE_LIMITED" &&
        Number.isInteger(error.retryAfterSeconds) &&
        error.retryAfterSeconds > 0 &&
        Number(response.headers["Retry-After"]) === error.retryAfterSeconds));
  check(response, { "expected status and business error": () => valid });
  failures.add(!valid);
  success.add(response.status === 201 ? 1 : 0);
  conflicts.add(
    response.status === 409 && error?.code === "ALREADY_ENROLLED" ? 1 : 0,
  );
  limited.add(response.status === 429 ? 1 : 0);
  return response;
}
export function mainUser() {
  for (let n = 0; n < 15; n++) {
    request(1, n === 0 ? 201 : n < 10 ? 409 : 429);
    if (n < 14) sleep(10 / 15);
  }
}
export function otherUser() {
  const result = request(__VU + 1, 201);
  others.add(result.status === 201 ? 1 : 0);
}
export function hotCourse() {
  request(__VU, 201);
}
export function handleSummary(data) {
  return {
    [`/results/${__ENV.LABEL || mode}-summary.json`]: JSON.stringify(
      data,
      null,
      2,
    ),
  };
}

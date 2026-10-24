import http from 'k6/http';
import { check } from 'k6';
const fixtures = JSON.parse(open(__ENV.FIXTURES));
const iterations = Number(__ENV.ITERATIONS || 5);
export const options = {
  scenarios: { progress: { executor: 'per-vu-iterations', vus: Number(__ENV.VUS), iterations, maxDuration: '120s' } },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<=0.01'], checks: ['rate==1'],
    'http_req_duration{phase:first}': ['p(99)<120000'],
    'http_req_duration{phase:duplicate}': ['p(99)<120000'],
  },
};
export default function () {
  const f = fixtures[(__VU - 1) * iterations + __ITER];
  const reading = __ENV.MATERIAL_TYPE === 'Reading';
  const path = `${__ENV.BASE_URL}/api/v1/enrollments/${f.id}/materials/${f.material}/${reading ? 'complete-reading' : 'progress'}`;
  let completedAt;
  for (const duplicate of [false, true]) {
    const response = http.post(path, reading ? null : JSON.stringify({ ranges: [[0, 80]], positionSeconds: 80, reportedAt: new Date().toISOString() }), {
      headers: { 'content-type': 'application/json', 'x-internal-key': __ENV.INTERNAL_SERVICE_KEY,
        'x-organization-id': f.org, 'x-user-id': f.learner, 'x-user-role': 'LEARNER' },
      tags: { phase: duplicate ? 'duplicate' : 'first' },
    });
    let data;
    try { data = response.json().data; } catch { /* check records the invalid response */ }
    check(response, {
      'completion saved': (r) => r.status === 200 && Boolean(data?.completedAt),
      'duplicate is immutable': () => !duplicate || data?.completedAt === completedAt,
      'Reading transition flag': () => !reading || data?.alreadyCompleted === duplicate,
    });
    completedAt = data?.completedAt;
  }
}
export function handleSummary(data) { return { [__ENV.SUMMARY]: JSON.stringify(data, null, 2) }; }

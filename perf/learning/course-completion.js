import http from 'k6/http';
import { check } from 'k6';
const fixtures=JSON.parse(open(__ENV.FIXTURES));
export const options={ scenarios: { completion: { executor: 'per-vu-iterations',vus: Number(__ENV.VUS),iterations: 1,maxDuration: '120s' } },
  summaryTrendStats: ['med','p(95)','p(99)','max'], thresholds: { http_req_failed: ['rate<=0.01'],checks: ['rate==1'],
    'http_req_duration{phase:trigger}': ['p(99)<120000'],'http_req_duration{phase:coverage}': ['p(99)<120000'] } };
export default function() {
  const f=fixtures[__VU-1];
  for (const trigger of [false,true]) {
    const response=http.post(`${__ENV.BASE_URL}/api/v1/enrollments/${f.id}/materials/${f.material}/progress`,
      JSON.stringify({ ranges: [[0,trigger ? 80 : 10]],positionSeconds: trigger ? 80 : 10,reportedAt: new Date().toISOString() }),
      { headers: { 'content-type': 'application/json','x-internal-key': __ENV.INTERNAL_SERVICE_KEY,'x-organization-id': f.org,'x-user-id': f.learner,'x-user-role': 'LEARNER' },tags: { phase: trigger ? 'trigger' : 'coverage' } });
    check(response,{ 'Video progress saved': r => r.status===200 });
  }
}
export function handleSummary(data) { return { [__ENV.SUMMARY]: JSON.stringify(data,null,2) }; }

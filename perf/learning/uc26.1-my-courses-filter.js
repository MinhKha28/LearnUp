import { check } from 'k6';
import http from 'k6/http';

const size = Number(__ENV.ENROLLMENTS);
const path = __ENV.FILTER_PATH;
const learners = {
  20: '01900000-0000-7000-8000-00000000a201',
  100: '01900000-0000-7000-8000-00000000a202',
  500: '01900000-0000-7000-8000-00000000a203',
  1000: '01900000-0000-7000-8000-00000000a206',
};
if (!learners[size] || !['P', 'K'].includes(path) || !__ENV.INTERNAL_SERVICE_KEY) {
  throw new Error('Set ENROLLMENTS, FILTER_PATH and INTERNAL_SERVICE_KEY.');
}

export const options = {
  scenarios: {
    myCourses: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '2s',
      duration: '45s',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)'],
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] },
};

export default function () {
  const keyword = path === 'K' ? '&q=lap%20trinh%20benchmark' : '';
  const response = http.get(
    `http://learning-service:8085/api/v1/enrollments/me?page=1${keyword}`,
    {
      headers: {
        'x-internal-key': __ENV.INTERNAL_SERVICE_KEY,
        'x-user-id': learners[size],
        'x-user-role': 'LEARNER',
        'x-organization-id': '01900000-0000-7000-8000-00000000a001',
      },
      tags: { name: 'GET /enrollments/me' },
    },
  );
  let page;
  try {
    page = response.json()?.data;
  } catch {
    page = undefined;
  }
  check(response, {
    'HTTP 200': (result) => result.status === 200,
    'total equals enrollment count': () => page?.meta?.total === size,
    'page has expected length': () => page?.items?.length === Math.min(size, 20),
  });
}

import http from "k6/http";
import { check } from "k6";
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1"] },
};
export default function () {
  const response = http.get(
    `${__ENV.BASE_URL || "http://learning-service:8085"}/api/v1/enrollments/me`,
  );
  check(response, {
    "Docker service name reaches learning authentication": (r) =>
      r.status === 401,
  });
}

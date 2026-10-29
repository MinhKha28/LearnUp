import { GATEWAY } from "./config.mjs";
import { assert, expectStatus } from "./harness.mjs";
import { data, request } from "./http.mjs";

const PAGE_SIZE = 100; // course-service maximum for /courses/organization

/** IDs of every course of the caller's organization, read page by page through the gateway. */
export async function organizationCourseIds(token, label = "/api/v1/courses/organization") {
  const ids = new Set();
  let total = 0;
  for (let current = 1, pages = 1; current <= pages; current++) {
    const res = expectStatus(
      await request("GET", `${GATEWAY}/api/v1/courses/organization?current=${current}&pageSize=${PAGE_SIZE}`, { token, label }),
      200,
      `${label} page ${current}`,
    );
    const page = data(res);
    for (const c of page.result ?? []) ids.add(c.id);
    pages = page.meta?.pages ?? 0;
    total = page.meta?.total ?? 0;
  }
  assert.equal(ids.size, total, `${label}: collected ${ids.size} distinct courses, meta.total is ${total}`);
  return ids;
}

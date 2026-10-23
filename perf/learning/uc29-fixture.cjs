// Synthetic fixture scoped to one reserved test organization; never production.
const { Client } = require("../../services/learning-service/node_modules/pg");
const fs = require("node:fs");
const org = "29170000-0000-4000-8000-000000000001";
const course = "29170000-0000-4000-8000-000000000002";
(async () => {
  if (process.env.NODE_ENV === "production") throw Error("Refusing production");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    if (process.argv[2] === "cleanup") {
      await db.query("DELETE FROM enrollments WHERE organization_id=$1", [org]);
      await db.query(
        "DELETE FROM course_version_snapshots WHERE organization_id=$1",
        [org],
      );
      return;
    }
    await db.query(
      `INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES($1,$2,$1,now(),now()) ON CONFLICT DO NOTHING`,
      [course, org],
    );
    await db.query(
      `INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent)
 SELECT gen_random_uuid(),$1,gen_random_uuid(),$2,'Optional','NotStarted',80 FROM generate_series(1,50000)
 WHERE NOT EXISTS(SELECT 1 FROM enrollments WHERE organization_id=$1)`,
      [org, course],
    );
    await db.query("ANALYZE enrollments");
    const rows = (
      await db.query(
        `SELECT id AS "enrollmentId",learner_id AS "learnerId",course_id AS "courseId",organization_id AS "organizationId",status,'Full' AS access FROM enrollments WHERE organization_id=$1`,
        [org],
      )
    ).rows;
    fs.writeFileSync(
      "perf/learning/results/uc29-fixtures.json",
      JSON.stringify(rows),
    );
    const plan = (
      await db.query(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,status FROM enrollments WHERE learner_id=$1 AND course_id=$2 AND organization_id=$3 LIMIT 1",
        [rows[0].learnerId, course, org],
      )
    ).rows;
    fs.writeFileSync(
      "perf/learning/results/uc29-explain.json",
      JSON.stringify(plan, null, 2),
    );
    console.log(JSON.stringify({ fixtureRows: rows.length }));
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

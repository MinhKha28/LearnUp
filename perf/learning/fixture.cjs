const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const serviceRequire = createRequire(
  path.resolve(__dirname, "../../services/learning-service/package.json"),
);
serviceRequire("dotenv").config({
  path: path.resolve(__dirname, "../../services/learning-service/.env"),
  quiet: true,
});
const { Client } = serviceRequire("pg");
if (process.env.NODE_ENV === "production")
  throw new Error("Refusing perf fixtures: NODE_ENV=production.");
const ORG = "25030000-0000-4000-8000-000000000001";
const id = (kind, n = 1) =>
  `2503${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COURSE = id("0001");
// Title Case values per D71, valid on current develop and after D71 merges.
const COURSE_VALUES = { status: "Published", courseType: "Public" };
const backgrounds = Array.from({ length: 100 }, (_, n) => id("0002", n + 1));
const courses = [COURSE, ...backgrounds];
const url = new URL(process.env.DATABASE_URL);
url.search = "";
if (process.env.PERF_DB_PORT) url.port = process.env.PERF_DB_PORT;
const learning = new Client({
  connectionString: url.href,
  application_name: "uc25_perf_fixture",
});
url.pathname = "/course_db";
const course = new Client({
  connectionString: process.env.COURSE_DATABASE_URL || url.href,
  application_name: "uc25_perf_fixture",
});
const write = (name, data) => {
  const dir = path.join(__dirname, "results");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, name),
    typeof data === "string" ? data : JSON.stringify(data, null, 2),
  );
};

async function ownership() {
  const { rows } = await course.query(
    "SELECT id FROM courses WHERE id = ANY($1::uuid[]) AND organization_id <> $2",
    [courses, ORG],
  );
  const { rows: snapshots } = await learning.query(
    "SELECT course_id FROM course_version_snapshots WHERE course_id = ANY($1::uuid[]) AND organization_id <> $2",
    [courses, ORG],
  );
  if (rows.length || snapshots.length)
    throw new Error(
      "Perf IDs belong to another organization; refusing writes.",
    );
}

async function reset(all = false, snapshots = false) {
  await ownership();
  const ids = all ? courses : [COURSE];
  const params = [ids, ORG];
  await learning.query("BEGIN");
  try {
    for (const table of ["material_progress", "enrollment_status_intervals"]) {
      await learning.query(
        `DELETE FROM ${table} t USING enrollments e WHERE t.enrollment_id=e.id AND t.organization_id=$2 AND e.organization_id=$2 AND e.course_id=ANY($1::uuid[])`,
        params,
      );
    }
    await learning.query(
      "DELETE FROM enrollments WHERE organization_id=$2 AND course_id=ANY($1::uuid[])",
      params,
    );
    if (snapshots || all) {
      for (const table of [
        "material_snapshots",
        "lesson_snapshots",
        "course_version_snapshots",
      ]) {
        await learning.query(
          `DELETE FROM ${table} WHERE organization_id=$2 AND course_id=ANY($1::uuid[])`,
          params,
        );
      }
    }
    await learning.query("COMMIT");
  } catch (error) {
    await learning.query("ROLLBACK");
    throw error;
  }
  if (snapshots || all)
    await course.query(
      "UPDATE courses SET locked_at=NULL WHERE organization_id=$2 AND id=ANY($1::uuid[])",
      params,
    );
}

async function seed() {
  await reset(true, true);
  const chainIds = courses.map((_, n) => id("0003", n + 1));
  await course.query(
    `INSERT INTO course_chains (id,organization_id,instructor_id,created_at,updated_at)
    SELECT x,$2,$3,now(),now() FROM unnest($1::uuid[]) x ON CONFLICT (id) DO NOTHING`,
    [chainIds, ORG, id("0004")],
  );
  await course.query(
    `INSERT INTO courses (id,organization_id,chain_id,version_number,name,learning_outcomes,expected_completion_days,course_type,status,published_at,created_at,updated_at)
    SELECT c,$3,ch,1,'UC25.3 perf ' || c,ARRAY['Perf outcome'],30,$4,$5,now(),now(),now()
    FROM unnest($1::uuid[],$2::uuid[]) x(c,ch) ON CONFLICT (id) DO NOTHING`,
    [courses, chainIds, ORG, COURSE_VALUES.courseType, COURSE_VALUES.status],
  );
  await course.query(
    `INSERT INTO modules (id,organization_id,course_id,title,position,created_at,updated_at)
    VALUES ($1,$2,$3,'Perf module',1,now(),now()) ON CONFLICT (id) DO NOTHING`,
    [id("0005"), ORG, COURSE],
  );
  await course.query(
    `INSERT INTO lessons (id,organization_id,module_id,title,content,position,created_at,updated_at)
    VALUES ($1,$2,$3,'Perf lesson','Perf reading content',1,now(),now()) ON CONFLICT (id) DO NOTHING`,
    [id("0006"), ORG, id("0005")],
  );
  await course.query(
    `INSERT INTO media_files (id,organization_id,purpose,status,storage_key,original_filename,mime_type,size_bytes,word_count,ready_at,created_at,updated_at)
    VALUES ($1,$2,'Material','Ready','perf/uc25.3/reading.pdf','reading.pdf','application/pdf',1024,500,now(),now(),now()) ON CONFLICT (id) DO NOTHING`,
    [id("0007"), ORG],
  );
  await course.query(
    `INSERT INTO materials (id,organization_id,lesson_id,material_type,title,is_required,file_id,position,created_at,updated_at)
    VALUES ($1,$2,$3,'Reading','Perf reading',true,$4,1,now(),now()) ON CONFLICT (id) DO NOTHING`,
    [id("0008"), ORG, id("0006"), id("0007")],
  );
  await learning.query(
    `INSERT INTO course_version_snapshots (course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of,created_at,updated_at)
    SELECT c,$3,ch,now(),now(),now(),now() FROM unnest($1::uuid[],$2::uuid[]) x(c,ch)`,
    [backgrounds, chainIds.slice(1), ORG],
  );
  await learning.query(
    `INSERT INTO enrollments (id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent,enrolled_at,created_at,updated_at)
    SELECT gen_random_uuid(),$1,('2503b000-0000-4000-8000-' || lpad(u::text,12,'0'))::uuid,c,'Optional','NotStarted',80,now(),now(),now()
    FROM unnest($2::uuid[]) c CROSS JOIN generate_series(1,500) u`,
    [ORG, backgrounds],
  );
  await learning.query("ANALYZE enrollments");
  console.log(
    JSON.stringify({
      organization: ORG,
      targetCourse: COURSE,
      backgroundCourses: 100,
      backgroundEnrollments: 50000,
      learners: 5000,
    }),
  );
}

async function verify(label, expected) {
  const { rows } = await learning.query(
    `SELECT
    (SELECT count(*)::int FROM enrollments WHERE organization_id=$1 AND course_id=$2) AS enrollments,
    (SELECT count(*)::int FROM (SELECT learner_id,course_id FROM enrollments WHERE organization_id=$1 AND course_id=$2 GROUP BY learner_id,course_id HAVING count(*)>1) d) AS duplicates,
    (SELECT count(*)::int FROM course_version_snapshots WHERE organization_id=$1 AND course_id=$2) AS snapshots,
    (SELECT count(*)::int FROM lesson_snapshots WHERE organization_id=$1 AND course_id=$2) AS lessons,
    (SELECT count(*)::int FROM material_snapshots WHERE organization_id=$1 AND course_id=$2) AS materials,
    (SELECT count(*)::int FROM enrollments e LEFT JOIN course_version_snapshots s ON s.course_id=e.course_id AND s.organization_id=e.organization_id WHERE e.organization_id=$1 AND e.course_id=$2 AND s.course_id IS NULL)
    + (SELECT count(*)::int FROM material_progress p LEFT JOIN enrollments e ON e.id=p.enrollment_id AND e.organization_id=p.organization_id LEFT JOIN material_snapshots m ON m.material_id=p.material_id AND m.organization_id=p.organization_id WHERE p.organization_id=$1 AND (e.id IS NULL OR m.material_id IS NULL) AND (e.course_id=$2 OR e.id IS NULL))
    + (SELECT count(*)::int FROM enrollment_status_intervals i LEFT JOIN enrollments e ON e.id=i.enrollment_id AND e.organization_id=i.organization_id WHERE i.organization_id=$1 AND e.id IS NULL) AS orphans,
    (SELECT count(*)::int FROM enrollments) AS total_enrollments`,
    [ORG, COURSE],
  );
  write(`${label}-sql.json`, rows[0]);
  console.log(JSON.stringify(rows[0]));
  const row = rows[0];
  if (
    row.enrollments !== expected ||
    row.duplicates ||
    row.snapshots !== 1 ||
    row.lessons !== 0 ||
    row.materials !== 1 ||
    row.orphans
  )
    throw new Error("SQL verification failed.");
}

async function explain() {
  await learning.query("ANALYZE enrollments");
  const { rows: size } = await learning.query(
    "SELECT count(*)::int AS n FROM enrollments",
  );
  if (size[0].n < 50000)
    throw new Error("EXPLAIN requires at least 50,000 enrollments.");
  const plans = [];
  const read = await learning.query(
    "EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM enrollments WHERE learner_id=$1 AND course_id=$2 LIMIT 1",
    [id("1000"), COURSE],
  );
  plans.push("BR-298", ...read.rows.map((r) => r["QUERY PLAN"]));
  await learning.query("BEGIN");
  try {
    const insert = await learning.query(
      `EXPLAIN (ANALYZE, BUFFERS) INSERT INTO enrollments
      (id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent,enrolled_at,created_at,updated_at)
      VALUES (gen_random_uuid(),$1,$2,$3,'Optional','NotStarted',80,now(),now(),now())`,
      [ORG, id("ffff"), COURSE],
    );
    plans.push(
      "INSERT (rolled back)",
      ...insert.rows.map((r) => r["QUERY PLAN"]),
    );
  } finally {
    await learning.query("ROLLBACK");
  }
  write("explain.txt", plans.join("\n"));
  console.log(plans.join("\n"));
  if (read.rows.some((r) => r["QUERY PLAN"].includes("Seq Scan")))
    throw new Error(
      "CẦN QUYẾT ĐỊNH: BR-298 still uses Seq Scan with >=50,000 rows.",
    );
}

async function monitor(label) {
  let stopped = false;
  process.on("SIGINT", () => {
    stopped = true;
  });
  process.on("SIGTERM", () => {
    stopped = true;
  });
  const samples = [];
  while (!stopped) {
    const { rows } =
      await learning.query(`SELECT datname,state,wait_event_type,wait_event,count(*)::int AS connections,
      max(EXTRACT(epoch FROM (clock_timestamp()-query_start))*1000)::float AS oldest_query_ms
      FROM pg_stat_activity WHERE datname IN ('learning_db','course_db') AND application_name <> 'uc25_perf_fixture'
      GROUP BY datname,state,wait_event_type,wait_event`);
    samples.push({ at: new Date().toISOString(), activity: rows });
    write(`${label}-pg-activity.json`, samples);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

(async () => {
  await learning.connect();
  await course.connect();
  try {
    const [command, label = "run", value] = process.argv.slice(2);
    if (command === "seed") await seed();
    else if (command === "reset")
      await reset(false, process.argv.includes("--snapshot"));
    else if (command === "verify") await verify(label, Number(value));
    else if (command === "explain") await explain();
    else if (command === "monitor") await monitor(label);
    else if (command === "cleanup") {
      await reset(true, true);
      await course.query(
        "DELETE FROM courses WHERE organization_id=$2 AND id=ANY($1::uuid[])",
        [courses, ORG],
      );
      await course.query(
        "DELETE FROM course_chains WHERE organization_id=$2 AND id=ANY($1::uuid[])",
        [courses.map((_, n) => id("0003", n + 1)), ORG],
      );
      await course.query(
        "DELETE FROM media_files WHERE organization_id=$1 AND id=$2",
        [ORG, id("0007")],
      );
    } else
      throw new Error(
        "Use seed | reset [--snapshot] | verify LABEL EXPECTED | explain | monitor LABEL | cleanup",
      );
  } finally {
    await learning.end();
    await course.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  completionMaterialsSql,
  claimCompletionSql,
} from '../../src/modules/course-completion/completion.repository';
class RollbackPlans extends Error {
  constructor(readonly plans: unknown) {
    super('ROLLBACK_EXPLAIN_FIXTURES');
  }
}
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing production');
  const db = new PrismaService(new ConfigService());
  const reports: unknown[] = [];
  try {
    for (const size of [1, 2000]) {
      const org = randomUUID(),
        course = randomUUID(),
        enrollment = randomUUID();
      try {
        await db.$transaction(
          async (tx) => {
            await tx.$executeRaw`INSERT INTO course_version_snapshots(course_id,organization_id,chain_id,tree_fetched_at,disabled_as_of) VALUES (${course}::uuid,${org}::uuid,${course}::uuid,now(),now())`;
            await tx.$executeRaw`INSERT INTO enrollments(id,organization_id,learner_id,course_id,enrollment_type,status,video_completion_percent)
            SELECT CASE WHEN i=1 THEN ${enrollment}::uuid ELSE gen_random_uuid() END,${org}::uuid,gen_random_uuid(),${course}::uuid,'Optional','NotStarted',80 FROM generate_series(1,${size}) i`;
            await tx.$executeRaw`INSERT INTO material_snapshots(material_id,organization_id,course_id,lesson_id,material_type,is_required,disabled_as_of)
            SELECT gen_random_uuid(),${org}::uuid,${course}::uuid,gen_random_uuid(),'Reading',true,now() FROM generate_series(1,${size})`;
            await tx.$executeRaw`INSERT INTO completion_evaluation_requests(id,organization_id,enrollment_id,source)
            SELECT gen_random_uuid(),organization_id,id,'OPTIONAL_RESTORE' FROM enrollments WHERE organization_id=${org}::uuid`;
            await tx.$executeRaw`ANALYZE material_snapshots`;
            await tx.$executeRaw`ANALYZE completion_evaluation_requests`;
            const explain = async (
              sql: ReturnType<typeof claimCompletionSql>,
            ) =>
              tx.$queryRawUnsafe(
                `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.text}`,
                ...sql.values,
              );
            const materialBefore = await explain(
              completionMaterialsSql(org, course, enrollment),
            );
            // Claim EXPLAIN executes UPDATE; reset the disposable rows before comparing.
            await tx.$executeRawUnsafe(
              'DROP INDEX completion_evaluation_requests_due_idx',
            );
            const queueBefore = await explain(claimCompletionSql(5, 30000));
            await tx.$executeRaw`UPDATE completion_evaluation_requests SET next_attempt_at=now(),last_error=NULL WHERE organization_id=${org}::uuid`;
            await tx.$executeRawUnsafe(
              'CREATE INDEX completion_evaluation_requests_due_idx ON completion_evaluation_requests(next_attempt_at,id)',
            );
            await tx.$executeRawUnsafe(
              'CREATE INDEX completion_material_candidate_experiment ON material_snapshots(organization_id,course_id,material_id) INCLUDE(lesson_id) WHERE is_required AND disabled_at IS NULL',
            );
            const materialAfter = await explain(
              completionMaterialsSql(org, course, enrollment),
            );
            const queueAfter = await explain(claimCompletionSql(5, 30000));
            throw new RollbackPlans({
              size,
              materialBefore,
              materialAfter,
              queueBefore,
              queueAfter,
              queueIndex:
                'Before without due index; after recreated due index. All DDL rolled back with fixtures.',
              candidateIndex:
                'Rolled back with fixtures; no deployment index added',
            });
          },
          { timeout: 30000 },
        );
      } catch (error) {
        if (error instanceof RollbackPlans) reports.push(error.plans);
        else throw error;
      }
    }
    mkdirSync('../../perf/learning/results', { recursive: true });
    writeFileSync(
      '../../perf/learning/results/course-completion-explain.json',
      JSON.stringify(reports, null, 2),
    );
    console.log(
      'EXPLAIN small/large and candidate index experiment completed; fixtures/index rolled back',
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

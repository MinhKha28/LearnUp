import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const learningDirectory = resolve(__dirname, '../../learning-service');
const testFile = resolve(__dirname, 'course-values.learning-test.ts');
const resolveFromLearning = (name: string) =>
  require.resolve(name, { paths: [learningDirectory] });
const result = spawnSync(
  process.execPath,
  [
    '-r',
    resolveFromLearning('ts-node/register'),
    '-r',
    resolveFromLearning('tsconfig-paths/register'),
    testFile,
  ],
  {
    cwd: learningDirectory,
    env: {
      ...process.env,
      NODE_PATH: learningDirectory,
      TS_NODE_PROJECT: 'tsconfig.seed.json',
    },
    stdio: 'inherit',
    windowsHide: true,
  },
);
if (result.error) throw result.error;
if (result.signal)
  throw new Error('Learning integration test stopped: ' + result.signal);
process.exitCode = result.status ?? 1;

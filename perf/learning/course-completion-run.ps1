param([switch]$Explain)
$ErrorActionPreference = 'Stop'
# Run from repository root; only the existing disposable L6 environment is used.
if ($env:NODE_ENV -eq 'production') { throw 'Refusing production' }
$completionDbEnv = (docker inspect learnup-l6-postgres | ConvertFrom-Json)[0].Config.Env
$completionCourseEnv = (docker inspect learnup-l6-course | ConvertFrom-Json)[0].Config.Env
$completionDbPass = ($completionDbEnv | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' }).Split('=',2)[1]
$env:DATABASE_URL = 'postgresql://postgres:' + [uri]::EscapeDataString($completionDbPass) + '@localhost:5433/learning_db'
$env:INTERNAL_SERVICE_KEY = ($completionCourseEnv | Where-Object { $_ -like 'INTERNAL_SERVICE_KEY=*' }).Split('=',2)[1]
$env:COURSE_SERVICE_URL = 'http://localhost:8089'
$env:ASSESSMENT_CLIENT_MODE = 'fake'
$env:ASSESSMENT_COMPLETION_CLIENT_MODE = 'fake'
$env:TENANT_CLIENT_MODE = 'fake'
$env:TENANT_SERVICE_URL = 'http://127.0.0.1:1'
$env:VIDEO_PLAYBACK_MODE = 'course'
$env:COMPLETION_WORKER_ENABLED = 'true'
$env:OUTBOX_RELAY_ENABLED = 'true'
$env:KAFKA_BROKERS = 'localhost:9092'
Push-Location services/learning-service
try {
  $env:NODE_PATH = (Get-Location).Path
  if ($Explain) {
    node_modules/.bin/ts-node.cmd -P tsconfig.seed.json test/perf/course-completion-explain.ts *> ../../completion-explain.log
  } else {
    node_modules/.bin/ts-node.cmd -P tsconfig.seed.json test/perf/course-completion.perf.ts *> ../../completion-perf.log
  }
  if ($LASTEXITCODE) { throw 'Completion performance harness failed; inspect completion-perf.log' }
} finally {
  Pop-Location
  $env:DATABASE_URL = $null
  $env:INTERNAL_SERVICE_KEY = $null
}

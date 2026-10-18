$ErrorActionPreference = 'Stop'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing UC27.2 perf in production.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$service = Join-Path $repo 'services/learning-service'
$results = Join-Path $PSScriptRoot 'results'
New-Item -ItemType Directory -Force $results | Out-Null
$savedKey = $env:INTERNAL_SERVICE_KEY
$savedNodePath = $env:NODE_PATH
try {
  if (!$env:INTERNAL_SERVICE_KEY) {
    $line = Get-Content -LiteralPath (Join-Path $service '.env') | Where-Object { $_ -match '^INTERNAL_SERVICE_KEY=' } | Select-Object -First 1
    $env:INTERNAL_SERVICE_KEY = $line.Split('=',2)[1].Trim().Trim('"')
  }
  if (!$env:INTERNAL_SERVICE_KEY) { throw 'Missing INTERNAL_SERVICE_KEY.' }
  $env:NODE_PATH = $service
  Push-Location $service
  try {
    & npx ts-node -P tsconfig.seed.json test/perf/video-progress.perf.ts seed
    if ($LASTEXITCODE -ne 0) { throw 'Fixture seed failed.' }
    & npx ts-node -P tsconfig.seed.json test/perf/video-progress.perf.ts explain
    if ($LASTEXITCODE -ne 0) { throw 'EXPLAIN failed.' }
    foreach ($rate in @(10,30,60,100)) {
      & npx ts-node -P tsconfig.seed.json test/perf/video-progress.perf.ts reset
      if ($LASTEXITCODE -ne 0) { throw 'Fixture reset failed.' }
      & docker run --rm --mount "type=bind,source=$PSScriptRoot,target=/scripts,readonly" --mount "type=bind,source=$results,target=/results" --env INTERNAL_SERVICE_KEY --env "RATE=$rate" --env BASE_URL=http://host.docker.internal:18085 grafana/k6 run /scripts/uc27.2-progress.js *> (Join-Path $results "uc27.2-$rate-console.txt")
      $k6Exit = $LASTEXITCODE
      Get-Content -LiteralPath (Join-Path $results "uc27.2-$rate-console.txt") -Tail 20
      & npx ts-node -P tsconfig.seed.json test/perf/video-progress.perf.ts verify $rate
      if ($LASTEXITCODE -ne 0) { throw 'Fixture verification failed.' }
      if ($k6Exit -ne 0) { throw "k6 thresholds failed at $rate req/s; evidence preserved." }
    }
  } finally {
    try {
      & npx ts-node -P tsconfig.seed.json test/perf/video-progress.perf.ts cleanup
      if ($LASTEXITCODE -ne 0) { Write-Error 'Fixture cleanup failed.' }
    } finally { Pop-Location }
  }
} finally {
  $env:INTERNAL_SERVICE_KEY = $savedKey
  $env:NODE_PATH = $savedNodePath
}

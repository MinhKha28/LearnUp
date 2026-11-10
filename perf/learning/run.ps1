param(
  [Parameter(Mandatory=$true)][string]$Label,
  [ValidateSet('A','B','C')][string]$Mode = 'B',
  [ValidateSet(2,200)][int]$Vus = 2,
  [ValidateSet(10,30,60,100)][int]$ArrivalRate = 30,
  [int]$UserOffset = 0,
  [switch]$Warm,
  [switch]$ObservePools
)
$ErrorActionPreference = 'Stop'
# Keep UC25.3 synthetic identities independent of Tenant rows.
$env:LEARNING_TENANT_CLIENT_MODE = 'fake'
$env:LEARNING_TENANT_FAKE_TIMEZONE = 'Asia/Ho_Chi_Minh'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing perf: NODE_ENV=production.' }
if ($Label -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid result label.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$results = Join-Path $PSScriptRoot 'results'
New-Item -ItemType Directory -Force $results | Out-Null
$fixture = Join-Path $PSScriptRoot 'fixture.cjs'
$savedKey = $env:INTERNAL_SERVICE_KEY
function Read-Observer([string]$Service, [string]$Method = 'GET') {
  $output = & docker compose exec -T $Service node -e "fetch('http://127.0.0.1:18084',{method:'$Method'}).then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))"
  if ($LASTEXITCODE -ne 0) { throw "Observer failed: $Service" }
  return ($output | ConvertFrom-Json)
}
try {
  $runningTenantMode = (& docker compose exec -T learning-service node -p 'process.env.TENANT_CLIENT_MODE').Trim()
  if ($LASTEXITCODE -ne 0 -or $runningTenantMode -ne 'fake') {
    throw 'UC25.3 perf requires fake Tenant access. Set LEARNING_TENANT_CLIENT_MODE=fake and recreate learning-service as documented.'
  }
  if (!$env:INTERNAL_SERVICE_KEY) {
    $env:INTERNAL_SERVICE_KEY = (& docker compose exec -T learning-service node -p 'process.env.INTERNAL_SERVICE_KEY').Trim()
  }
  if (!$env:INTERNAL_SERVICE_KEY) { throw 'Missing INTERNAL_SERVICE_KEY.' }
  if ($Warm) { & node $fixture reset } else { & node $fixture reset --snapshot }
  if ($LASTEXITCODE -ne 0) { throw 'Fixture reset failed.' }
  if ($ObservePools) {
    Read-Observer 'course-service' 'DELETE' | Out-Null
    Read-Observer 'learning-service' 'DELETE' | Out-Null
  }
  $monitor = Start-Process -FilePath 'node' -ArgumentList @($fixture, 'monitor', $Label) -WindowStyle Hidden -PassThru
  $stats = Start-Process -FilePath 'docker' -ArgumentList @('stats', '--format', '"{{json .}}"', 'learnup-learning-service', 'learnup-course-service', 'learnup-postgres') -RedirectStandardOutput (Join-Path $results "$Label-docker-stats.txt") -RedirectStandardError (Join-Path $results "$Label-docker-stats-error.txt") -WindowStyle Hidden -PassThru
  try {
    & docker run --rm --network learnup_learnup-network --mount "type=bind,source=$PSScriptRoot,target=/scripts,readonly" --mount "type=bind,source=$results,target=/results" --env INTERNAL_SERVICE_KEY --env BASE_URL=http://learning-service:8085 --env "MODE=$Mode" --env "VUS=$Vus" --env "ARRIVAL_RATE=$ArrivalRate" --env "LABEL=$Label" --env "USER_OFFSET=$UserOffset" grafana/k6 run --out "json=/results/$Label-samples.json" /scripts/uc25.3.js
    $k6Exit = $LASTEXITCODE
  } finally {
    if (!$monitor.HasExited) { Stop-Process -Id $monitor.Id }
    if (!$stats.HasExited) { Stop-Process -Id $stats.Id }
  }
  $courseObservation = if ($ObservePools) { Read-Observer 'course-service' } else { @{ available = $false } }
  $courseObservation | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $results "$Label-course-calls.json")
  if ($ObservePools) { Read-Observer 'learning-service' | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $results "$Label-learning-pool.json") }
  $summary = Get-Content -Raw -LiteralPath (Join-Path $results "$Label-summary.json") | ConvertFrom-Json
  $expected = [int]$summary.metrics.enrolled_201.values.count
  & node $fixture verify $Label $expected
  $sqlExit = $LASTEXITCODE
  & node (Join-Path $PSScriptRoot 'summarize.cjs') $Label
  if ($LASTEXITCODE -ne 0) { throw 'Summary failed.' }
  if ($sqlExit -ne 0) { throw 'SQL verification failed; evidence preserved.' }
  if ($k6Exit -ne 0) { Write-Warning "k6 failed thresholds (exit $k6Exit); evidence preserved. Do not tune application settings." }
} finally { $env:INTERNAL_SERVICE_KEY = $savedKey }

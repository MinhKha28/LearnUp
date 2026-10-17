param(
  [Parameter(Mandatory=$true)][string]$Label,
  [ValidateSet('A','B')][string]$Mode = 'B',
  [ValidateSet(2,200,1000)][int]$Vus = 2,
  [int]$UserOffset = 0,
  [switch]$Warm
)
$ErrorActionPreference = 'Stop'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing perf: NODE_ENV=production.' }
if ($Label -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid result label.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$results = Join-Path $PSScriptRoot 'results'
New-Item -ItemType Directory -Force $results | Out-Null
$fixture = Join-Path $PSScriptRoot 'fixture.cjs'
$savedKey = $env:INTERNAL_SERVICE_KEY
try {
  if (!$env:INTERNAL_SERVICE_KEY) {
    $line = Get-Content -LiteralPath (Join-Path $repo 'services/learning-service/.env') | Where-Object { $_ -match '^INTERNAL_SERVICE_KEY=' } | Select-Object -First 1
    $env:INTERNAL_SERVICE_KEY = ($line -replace '^INTERNAL_SERVICE_KEY=', '').Trim('"', "'")
  }
  if (!$env:INTERNAL_SERVICE_KEY) { throw 'Missing INTERNAL_SERVICE_KEY.' }
  if ($Warm) { & node $fixture reset } else { & node $fixture reset --snapshot }
  if ($LASTEXITCODE -ne 0) { throw 'Fixture reset failed.' }
  Invoke-RestMethod -Uri 'http://127.0.0.1:18084' -Method Delete | Out-Null
  $monitor = Start-Process -FilePath 'node' -ArgumentList @($fixture, 'monitor', $Label) -WindowStyle Hidden -PassThru
  try {
    & docker run --rm --mount "type=bind,source=$PSScriptRoot,target=/scripts,readonly" --mount "type=bind,source=$results,target=/results" --env INTERNAL_SERVICE_KEY --env "MODE=$Mode" --env "VUS=$Vus" --env "LABEL=$Label" --env "USER_OFFSET=$UserOffset" grafana/k6 run --out "json=/results/$Label-samples.json" /scripts/uc25.3.js
    $k6Exit = $LASTEXITCODE
  } finally {
    if (!$monitor.HasExited) { Stop-Process -Id $monitor.Id }
  }
  Invoke-RestMethod -Uri 'http://127.0.0.1:18084' | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $results "$Label-course-calls.json")
  $expected = if ($Mode -eq 'A') { 6 } else { $Vus }
  & node $fixture verify $Label $expected
  $sqlExit = $LASTEXITCODE
  & node (Join-Path $PSScriptRoot 'summarize.cjs') $Label
  if ($LASTEXITCODE -ne 0) { throw 'Summary failed.' }
  if ($sqlExit -ne 0) { throw 'SQL verification failed; evidence preserved.' }
  if ($k6Exit -ne 0) { throw "k6 failed thresholds (exit $k6Exit); inspect results before continuing." }
} finally { $env:INTERNAL_SERVICE_KEY = $savedKey }

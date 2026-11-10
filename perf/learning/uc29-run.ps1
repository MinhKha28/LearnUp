$ErrorActionPreference = 'Stop'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing production.' }
# Run from repository root. Credentials come from the existing disposable L6 containers, never saved.
$dbEnv=(docker inspect learnup-l6-postgres | ConvertFrom-Json)[0].Config.Env
$appEnv=(docker inspect learnup-l17-learning-ready | ConvertFrom-Json)[0].Config.Env
$dbPass=($dbEnv | Where-Object {$_ -like 'POSTGRES_PASSWORD=*'}).Split('=',2)[1]
$env:DATABASE_URL='postgresql://postgres:'+ [uri]::EscapeDataString($dbPass)+'@localhost:5433/learning_db'
$env:INTERNAL_SERVICE_KEY=($appEnv | Where-Object {$_ -like 'INTERNAL_SERVICE_KEY=*'}).Split('=',2)[1]
$env:BASE_URL='http://learnup-l17-learning-ready:8085'
$env:FIXTURES='/scripts/results/uc29-fixtures.json'
$runStamp=Get-Date -Format yyyyMMddHHmmss
$perf=(Resolve-Path 'perf/learning').Path
node perf/learning/uc29-fixture.cjs
if ($LASTEXITCODE) {throw 'Fixture failed'}
try {
 foreach($vus in @(1,2,100,200,1000,2000)) {
  foreach($run in 1..3) {
   $env:VUS="$vus"
   $env:SUMMARY="/scripts/results/uc29-$vus-$run.json"
   $name="learnup-l17-ready-k6-$runStamp-$vus-$run"
   docker run -d --name $name --network learnup-l6-test_learnup-network --mount "type=bind,source=$perf,target=/scripts" -e INTERNAL_SERVICE_KEY -e BASE_URL -e FIXTURES -e VUS -e SUMMARY grafana/k6 run /scripts/uc29-assessment-access.js | Out-Null
   if($LASTEXITCODE){throw 'k6 launch failed'}
   $samples=@()
   do {
    $sample=docker stats --no-stream --format '{{json .}}' learnup-l17-learning-ready learnup-l6-postgres
    $samples+=@{timestamp=[DateTime]::UtcNow.ToString('o');containers=@($sample | ForEach-Object {$_ | ConvertFrom-Json})}
    $running=docker inspect $name --format '{{.State.Running}}'
   } while ($running -eq 'true')
   $samples | ConvertTo-Json -Depth 6 | Set-Content "perf/learning/results/uc29-$vus-$run-resources.json"
   docker logs $name *> "perf/learning/results/uc29-$vus-$run-console.txt"
   $exitCode=docker inspect $name --format '{{.State.ExitCode}}'
   if($exitCode -ne '0'){throw "k6 failed at $vus run $run; higher loads not attempted"}
   $summary=Get-Content "perf/learning/results/uc29-$vus-$run.json" -Raw | ConvertFrom-Json
   $failed=$summary.metrics.'http_req_failed{phase:steady}'.values.rate
   $checks=$summary.metrics.'checks{phase:steady}'.values.rate
   Write-Output "L17 VUs=$vus run=$run failed=$failed checks=$checks"
   if($failed -gt 0 -or $checks -lt 1){throw "Unstable load at $vus run $run; higher loads not attempted"}
  }
 }
} finally {
 node perf/learning/uc29-fixture.cjs cleanup
 $env:INTERNAL_SERVICE_KEY=$null
 $env:DATABASE_URL=$null
}

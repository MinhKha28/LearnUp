param([string]$BaselineRoot)
$ErrorActionPreference='Stop'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing production' }
if (!$BaselineRoot) { throw 'Supply archive of 52cfbc0 learning-service as -BaselineRoot; reuse installed dependencies, no installation or migration.' }
$env:BASELINE_SERVICE_ROOT=(Resolve-Path $BaselineRoot).Path
$dbEnvPaired=(docker inspect learnup-l6-postgres | ConvertFrom-Json)[0].Config.Env
$courseEnvPaired=(docker inspect learnup-l6-course | ConvertFrom-Json)[0].Config.Env
$passPaired=($dbEnvPaired | Where-Object {$_ -like 'POSTGRES_PASSWORD=*'}).Split('=',2)[1]
$env:DATABASE_URL='postgresql://postgres:'+ [uri]::EscapeDataString($passPaired)+'@localhost:5433/learning_db'
$env:INTERNAL_SERVICE_KEY=($courseEnvPaired | Where-Object {$_ -like 'INTERNAL_SERVICE_KEY=*'}).Split('=',2)[1]
$env:COURSE_SERVICE_URL='http://localhost:8089';$env:COURSE_SERVICE_TIMEOUT_MS='3000'
$env:ASSESSMENT_CLIENT_MODE='fake';$env:ASSESSMENT_COMPLETION_CLIENT_MODE='fake'
$env:TENANT_CLIENT_MODE='fake';$env:TENANT_FAKE_TIMEZONE='Asia/Ho_Chi_Minh';$env:TENANT_SERVICE_URL='http://127.0.0.1:1'
$env:VIDEO_PLAYBACK_MODE='course';$env:COMPLETION_WORKER_ENABLED='true';$env:OUTBOX_RELAY_ENABLED='true';$env:KAFKA_BROKERS='localhost:9092'
$reports=@();$stop=$false
New-Item -ItemType Directory -Force -Path perf/learning/results | Out-Null
try {
 foreach($vus in @(1,2,100,200,1000,2000)) {
  $env:VUS="$vus";$before=@();$after=@()
  foreach($run in 1..3) {
   $env:RUN="$run"
   foreach($side in @('baseline','branch')) {
    node perf/learning/course-completion-paired.cjs $side *> "perf/learning/results/completion-paired-$side-$vus-$run.log"
    if($LASTEXITCODE){throw "Harness failed: $side $vus/$run"}
    $report=Get-Content "perf/learning/results/completion-paired/$side-$vus-$run-report.json" -Raw | ConvertFrom-Json
    if($side -eq 'baseline'){$before+=,$report}else{$after+=,$report}
    if($report.failureRate -gt 0.01 -or ($side -eq 'branch' -and ($report.completed -ne $vus -or $report.events -ne $vus))){
     $stop=$true
     @{vus=$vus;run=$run;side=$side;failureRate=$report.failureRate;completed=$report.completed;events=$report.events;reason='HTTP errors >1% or incorrect branch completion/event counts'} | ConvertTo-Json | Set-Content perf/learning/results/completion-paired-stop.json
     break
    }
   }
   if($stop){break}
  }
  if(!$stop){
   $phases=@()
   foreach($phase in @('coverage','trigger')) {
    $baselineP99=@($before | ForEach-Object {$_.phases.$phase.'p(99)'} | Sort-Object)[1]
    $branchP99=@($after | ForEach-Object {$_.phases.$phase.'p(99)'} | Sort-Object)[1]
    $threshold=[Math]::Max([double]500,[double](1.5*$baselineP99))
    $breaches=@($after | Where-Object {$_.phases.$phase.'p(99)' -gt $threshold}).Count
    $phases+=@{phase=$phase;baselineMedianP99=$baselineP99;branchMedianP99=$branchP99;threshold=$threshold;breaches=$breaches;regressionWarning=($branchP99 -gt 1.2*$baselineP99)}
    if($breaches -ge 2){$stop=$true}
   }
   $reports+=@{vus=$vus;phases=$phases;stopped=$stop}
   $reports | ConvertTo-Json -Depth 8 | Set-Content perf/learning/results/completion-paired-summary.json
   Write-Output ($reports[-1] | ConvertTo-Json -Depth 8 -Compress)
  }
  if($stop){Write-Output "Stopped at $vus VUs; no further tuning performed.";break}
 }
} finally {$env:DATABASE_URL=$null;$env:INTERNAL_SERVICE_KEY=$null}

param([Parameter(Mandatory=$true)][string]$BaselineRoot)
$ErrorActionPreference='Stop'
if ($env:NODE_ENV -eq 'production') { throw 'Refusing production' }
$env:BASELINE_SERVICE_ROOT=(Resolve-Path $BaselineRoot).Path
# Credentials are supplied through the caller's environment, never persisted in reports.
if (!$env:DATABASE_URL -or !$env:INTERNAL_SERVICE_KEY) { throw 'Supply isolated DATABASE_URL and INTERNAL_SERVICE_KEY' }
$summary=@(); $stop=$false
foreach($vus in @(1,100,200)) {
  $env:VUS="$vus"; $baseline=@(); $branch=@(); $reading=@()
  foreach($run in 1..3) {
    $env:RUN="$run"; $env:MATERIAL_TYPE='Video'
    foreach($side in @('baseline','branch')) {
      node perf/learning/reading-completion-run.cjs $side
      if($LASTEXITCODE){throw "Harness failed: Video/$side/$vus/$run"}
      $report=Get-Content "perf/learning/results/reading-completion/video-$side-$vus-$run-report.json" -Raw | ConvertFrom-Json
      if($side -eq 'baseline'){$baseline+=,$report}else{$branch+=,$report}
      if($report.failureRate -gt 0.01 -or $report.checks -ne 1 -or $report.k6Exit -ne 0 -or
        $report.counts.completions -ne $report.expected -or $report.counts.activated -ne $report.expected -or
        $report.counts.requests -ne $report.expected -or $report.counts.duplicate_signals -ne 0){$stop=$true;break}
    }
    if($stop){break}
  }
  $phases=@()
  if(!$stop) {
    foreach($phase in @('first','duplicate')) {
      $b=@($baseline | ForEach-Object {$_.phases.$phase.'p(99)'} | Sort-Object)[1]
      $limit=[Math]::Max([double]500,[double](1.5*$b))
      $breaches=@($branch | Where-Object {$_.phases.$phase.'p(99)' -gt $limit}).Count
      $phases+=@{phase=$phase;baselineMedianP99=$b;branchMedianP99=@($branch | ForEach-Object {$_.phases.$phase.'p(99)'} | Sort-Object)[1];limit=$limit;breaches=$breaches}
      if($breaches -ge 2){$stop=$true}
    }
  }
  # Reading has no baseline endpoint; record independently, never compare against a 404.
  if(!$stop) {
    $env:MATERIAL_TYPE='Reading'
    foreach($run in 1..3) {
      $env:RUN="$run"
      node perf/learning/reading-completion-run.cjs branch
      if($LASTEXITCODE){throw "Harness failed: Reading/$vus/$run"}
      $report=Get-Content "perf/learning/results/reading-completion/reading-branch-$vus-$run-report.json" -Raw | ConvertFrom-Json
      $reading+=,$report
      if($report.failureRate -gt 0.01 -or $report.checks -ne 1 -or $report.k6Exit -ne 0 -or
        $report.counts.completions -ne $report.expected -or $report.counts.activated -ne $report.expected -or
        $report.counts.requests -ne $report.expected -or $report.counts.duplicate_signals -ne 0){$stop=$true;break}
    }
  }
  $summary+=@{vus=$vus;video=$phases;baseline=$baseline;branch=$branch;reading=$reading;stopped=$stop}
  $summary | ConvertTo-Json -Depth 12 | Set-Content perf/learning/results/reading-completion/summary.json
  if($stop){Write-Output "Stopped at $vus VUs under the approved stop criteria.";break}
}

<#
Inter 2 demo launcher. Run from the repository root:
  powershell -ExecutionPolicy Bypass -File scripts\inter2-demo.ps1 [-Mode fake] [-Install]
  ... -Mode fake   assessment fake, no assessment-service
  ... -Install     npm ci for services whose lockfile changed, build missing libraries
Creates a clean PostgreSQL 16 container, then runs scripts/inter1-demo.mjs against it.
#>
param(
    [ValidateSet('http', 'fake')][string]$Mode = 'http',
    [switch]$Install,
    [string]$Repo = (Split-Path -Parent $PSScriptRoot),
    [switch]$AnyBranch,
    [ValidateRange(1, 65535)][int]$Port = 15433
)
$ErrorActionPreference = 'Stop'
$started = Get-Date

function Write-Step([string]$Text) { Write-Host "`n== $Text" -ForegroundColor Cyan }
function Stop-Demo([string]$Text) { throw "STOP: $Text" }

function Invoke-Checked([string]$Dir, [string]$What, [scriptblock]$Command) {
    Push-Location $Dir
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) { Stop-Demo "$What failed (exit $LASTEXITCODE)." }
    }
    finally { Pop-Location }
}

function Read-DatabaseUrl([string]$EnvFile) {
    if (-not (Test-Path $EnvFile)) { Stop-Demo "Missing $EnvFile." }
    $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*(?:export\s+)?DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) { Stop-Demo "$EnvFile has no DATABASE_URL." }
    try { [Uri](($line -split '=', 2)[1].Trim().Trim('"').Trim("'")) }
    catch { Stop-Demo "Invalid DATABASE_URL in $EnvFile (value omitted)." }
}

Write-Step 'Repository'
Set-Location $Repo
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0) { Stop-Demo 'Cannot read repository branch.' }
if (-not $AnyBranch -and $branch -ne 'develop') { Stop-Demo "Current branch is '$branch', expected develop." }
$dirty = git status --short --untracked-files=all
if ($LASTEXITCODE -ne 0) { Stop-Demo 'Cannot read repository status.' }
if ($dirty) { $dirty | Write-Host; Stop-Demo 'Working tree has uncommitted changes.' }
Write-Host "HEAD $(git log -1 --format='%h %s')"

Write-Step 'Docker'
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { Stop-Demo 'Docker is not running. Open Docker Desktop, wait until it is ready, run again.' }
if ($env:DEMO_BACKEND_ROOT -and [IO.Path]::GetFullPath($env:DEMO_BACKEND_ROOT).TrimEnd('\') -ne (Resolve-Path $Repo).Path.TrimEnd('\')) {
    Stop-Demo 'DEMO_BACKEND_ROOT points outside this repository. Clear it before running.'
}

Write-Step 'Dependencies'
$services = @('course', 'tenant', 'learning')
if ($Mode -eq 'http') { $services += 'assessment' }
$dependencyDirs = @{}
foreach ($s in $services) { $dependencyDirs[$s] = Join-Path $Repo "services\$s-service" }
$dependencyDirs['frontend'] = Join-Path $Repo 'frontend'
$stale = @()
foreach ($s in $dependencyDirs.Keys) {
    $dir = $dependencyDirs[$s]
    $installed = Join-Path $dir 'node_modules\.package-lock.json'
    if (-not (Test-Path $installed) -or
        (Get-Item "$dir\package-lock.json").LastWriteTime -gt (Get-Item $installed).LastWriteTime) { $stale += $s }
}
if ($stale.Count -gt 0) {
    if (-not $Install) { Stop-Demo "Dependencies out of date: $($stale -join ', '). Run again with -Install (about 1-2 minutes per service)." }
    foreach ($s in $stale) { Invoke-Checked $dependencyDirs[$s] "npm ci ($s)" { npm.cmd ci } }
}
$libraries = @('ts-common')
if ($Mode -eq 'http') { $libraries += 'ts-storage' }
foreach ($lib in $libraries) {
    $dir = Join-Path $Repo "libraries\$lib"
    if (Test-Path "$dir\dist\index.js") { continue }
    if (-not $Install) { Stop-Demo "libraries/$lib is not built. Run again with -Install." }
    Invoke-Checked $dir "npm ci ($lib)" { npm.cmd ci }
    Invoke-Checked $dir "build ($lib)" { npm.cmd run build }
}

Write-Step 'Prisma generate'
foreach ($s in $services) {
    Invoke-Checked (Join-Path $Repo "services\$s-service") "prisma generate ($s)" { npx.cmd --no-install prisma generate --config prisma7.config.ts | Out-Null }
}

Write-Step 'Configuration'
$learningDb = Read-DatabaseUrl (Join-Path $Repo 'services\learning-service\.env')
foreach ($s in $services) {
    $database = Read-DatabaseUrl (Join-Path $Repo "services\$s-service\.env")
    if ($database.Scheme -notin @('postgres', 'postgresql') -or
        $database.Host -notin @('localhost', '127.0.0.1') -or
        $database.UserInfo -ne $learningDb.UserInfo -or
        $database.AbsolutePath -ne "/${s}_db") {
        Stop-Demo "$s-service/.env DATABASE_URL must use localhost, the same credentials as learning-service and ${s}_db; the runner replaces only the port."
    }
}
$credentials = @($learningDb.UserInfo.Split(':', 2) | ForEach-Object { [Uri]::UnescapeDataString($_) })
$dbUser = $credentials[0]
if ($credentials.Count -ne 2 -or -not $credentials[0] -or -not $credentials[1]) { Stop-Demo 'Database username and password are required.' }
$dbPassword = $credentials[1]

Write-Step "PostgreSQL 16 on port $Port"
$holders = @(docker ps --filter "publish=$Port" --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { Stop-Demo 'Cannot inspect Docker port holders.' }
foreach ($name in $holders) {
    if ($name -and $name -notlike 'learnup-inter2-*') { Stop-Demo "Port $Port is used by container $name." }
}
foreach ($name in $holders) {
    if ($name -like 'learnup-inter2-*') { docker rm -f $name | Out-Null; if ($LASTEXITCODE -ne 0) { Stop-Demo "Cannot remove $name." }; Write-Host "Removed old demo container $name" }
}
if ($holders.Count -gt 0) { Start-Sleep -Seconds 2 }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { Stop-Demo "Port $Port is used by a non-Docker process." }

$container = 'learnup-inter2-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
$init = (Resolve-Path (Join-Path $Repo 'infrastructure\postgres\init-databases.sh')).Path
$created = $false
$savedEnvironment = @{}
foreach ($key in 'DEMO_POSTGRES_PORT', 'DEMO_POSTGRES_CONTAINER', 'NODE_PATH') {
    $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    docker run -d --name $container -p "${Port}:5432" -e "POSTGRES_USER=$dbUser" -e "POSTGRES_PASSWORD=$dbPassword" `
        --mount "type=bind,source=$init,target=/docker-entrypoint-initdb.d/init-databases.sh,readonly" postgres:16-alpine | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-Demo 'docker run failed.' }
    $created = $true

    # TCP check: the temporary server used while init scripts run listens only on the Unix socket.
    $deadline = (Get-Date).AddSeconds(60)
    do {
        Start-Sleep -Milliseconds 500
        docker exec $container pg_isready -h 127.0.0.1 -U $dbUser | Out-Null
    } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
    if ($LASTEXITCODE -ne 0) {
        Stop-Demo 'PostgreSQL was not ready after 60 seconds.'
    }

    $existing = @(docker exec $container psql -U $dbUser -d postgres -Atc 'SELECT datname FROM pg_database')
    if ($LASTEXITCODE -ne 0) { Stop-Demo 'Cannot list demo databases.' }
    foreach ($db in 'assessment_db', 'course_db', 'learning_db', 'tenant_db') {
        if ($existing -contains $db) { continue }
        docker exec $container psql -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db" | Out-Null
        if ($LASTEXITCODE -ne 0) { Stop-Demo "Cannot create $db." }
        Write-Host "Created $db"
    }
    Write-Host "Container $container ready."

    $env:DEMO_POSTGRES_PORT = "$Port"
    $env:DEMO_POSTGRES_CONTAINER = $container
    $env:NODE_PATH = (@('learning', 'tenant', 'assessment') | ForEach-Object { Join-Path $Repo "services\$_-service" }) -join ';'

    Write-Step "Runner preflight (--assessment=$Mode)"
    node scripts/inter1-demo.mjs "--assessment=$Mode" --check
    if ($LASTEXITCODE -ne 0) { Stop-Demo 'Runner preflight failed (see message above).' }
    Write-Host ('Preparation took {0:N0} s. If this window is closed abruptly, run: docker rm -f {1}' -f ((Get-Date) - $started).TotalSeconds, $container)

    Write-Step 'Runner'
    node scripts/inter1-demo.mjs "--assessment=$Mode"
    if ($LASTEXITCODE -ne 0) { Stop-Demo "Runner failed (exit $LASTEXITCODE)." }
}
finally {
    foreach ($key in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], 'Process')
    }
    if ($created) {
        docker rm -f $container | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning "Cannot remove $container. Run: docker rm -f $container" }
        else { Write-Host "Removed $container" }
    }
}

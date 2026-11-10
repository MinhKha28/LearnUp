<#
.SYNOPSIS
Runs password-reset transaction tests against a fresh disposable PostgreSQL container.
.DESCRIPTION
Requires Docker with a running daemon and a cached postgres:16-alpine image, Maven,
and Java 21. No shared databases or existing/named volumes are used. The generated database
password is process-local and is not written to disk, command arguments, or output.
The container is stopped only after checking its exact ID and unique ownership label.
.EXAMPLE
./src/test/scripts/Test-PasswordResetPostgres.ps1
.EXAMPLE
./src/test/scripts/Test-PasswordResetPostgres.ps1 -AllTests -MavenGoals clean,verify -Offline -MavenRepository 'C:\path\to\.m2\repository'
#>
[CmdletBinding()]
param(
    [string[]]$MavenGoals = @('test'),
    [switch]$AllTests,
    [string]$MavenRepository,
    [switch]$Offline
)

$ErrorActionPreference = 'Stop'
$testImage = 'postgres:16-alpine'
$testDatabase = 'identity_reset_test'
$testLabel = 'learnup.identity-reset-test'
$testOwner = [Guid]::NewGuid().ToString('N')
$testContainerName = "learnup-identity-reset-$testOwner"
$testContainerId = $null
$locationPushed = $false
$mavenExitCode = 1
$environmentNames = @(
    'POSTGRES_PASSWORD',
    'IDENTITY_TEST_POSTGRES_URL',
    'IDENTITY_TEST_POSTGRES_USERNAME',
    'IDENTITY_TEST_POSTGRES_PASSWORD'
)
$savedEnvironment = @{}
foreach ($name in $environmentNames) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Get-OwnedTestContainer {
    param([string]$ContainerId)
    if ($ContainerId -notmatch '^[a-f0-9]{64}$') {
        throw 'Refusing to operate on an unvalidated test container ID'
    }
    $inspection = & docker inspect $ContainerId 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to verify ownership of the disposable test container'
    }
    $container = @($inspection | ConvertFrom-Json)[0]
    if ($container.Id -ne $ContainerId -or
            $container.Name -ne "/$testContainerName" -or
            $container.Config.Labels.$testLabel -ne $testOwner) {
        throw 'Refusing to operate on a container without the exact test ownership label'
    }
    return $container
}

try {
    $null = Get-Command docker -ErrorAction Stop
    $null = Get-Command mvn -ErrorAction Stop
    & docker image inspect $testImage *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'The postgres:16-alpine image must already be cached; this runner never pulls images'
    }

    # --env NAME reads the process environment instead of exposing the value in argv.
    $testPasswordBytes = New-Object byte[] 48
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($testPasswordBytes)
    } finally {
        $random.Dispose()
    }
    $testPassword = [Convert]::ToBase64String($testPasswordBytes)
    [Environment]::SetEnvironmentVariable('POSTGRES_PASSWORD', $testPassword, 'Process')
    $created = & docker run --detach --rm --pull never --name $testContainerName `
        --label "$testLabel=$testOwner" --publish '127.0.0.1::5432' `
        --env "POSTGRES_DB=$testDatabase" --env "POSTGRES_USER=$testDatabase" `
        --env POSTGRES_PASSWORD $testImage
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not start the disposable PostgreSQL test container'
    }
    $testContainerId = ($created | Select-Object -Last 1).Trim()
    $null = Get-OwnedTestContainer $testContainerId

    $binding = & docker port $testContainerId '5432/tcp'
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:([0-9]+)$') {
        throw 'Disposable PostgreSQL must have exactly one loopback-only port binding'
    }
    $testPort = [int]$Matches[1]
    if ($testPort -lt 1024 -or $testPort -gt 65535 -or $testPort -eq 5432) {
        throw 'Disposable PostgreSQL received an unsafe host port'
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker exec $testContainerId pg_isready --host 127.0.0.1 --username $testDatabase --dbname $testDatabase --quiet *> $null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        throw 'Disposable PostgreSQL did not become ready within the bounded startup wait'
    }

    [Environment]::SetEnvironmentVariable('IDENTITY_TEST_POSTGRES_URL', "jdbc:postgresql://127.0.0.1:$testPort/$testDatabase", 'Process')
    [Environment]::SetEnvironmentVariable('IDENTITY_TEST_POSTGRES_USERNAME', $testDatabase, 'Process')
    [Environment]::SetEnvironmentVariable('IDENTITY_TEST_POSTGRES_PASSWORD', $testPassword, 'Process')

    $mavenArguments = @('--batch-mode', '-Dstyle.color=never')
    if ($Offline) {
        $mavenArguments += '--offline'
    }
    if ($MavenRepository) {
        $mavenArguments += "-Dmaven.repo.local=$MavenRepository"
    }
    if (-not $AllTests) {
        $mavenArguments += '-Dtest=PasswordResetPostgresIntegrationTest'
    }
    $mavenArguments += $MavenGoals
    $identityDirectory = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
    Push-Location -LiteralPath $identityDirectory
    $locationPushed = $true
    Write-Host 'Running Identity tests against an owned disposable PostgreSQL container (Tenant remains mocked).'
    # Windows PowerShell can promote benign native stderr (e.g. Java agent warnings)
    # to terminating ErrorRecords when a caller captures output. Maven's exit code,
    # not the presence of stderr, determines whether verification succeeded.
    $previousErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & mvn @mavenArguments
        $mavenExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }
} finally {
    try {
        if ($locationPushed) {
            Pop-Location
        }
        if ($testContainerId) {
            # Never stop by a parsed name, wildcard, unverified ID, or broad Docker prune.
            $null = Get-OwnedTestContainer $testContainerId
            & docker stop --time 5 $testContainerId *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-Warning 'The owned PostgreSQL test container could not be stopped; no broader cleanup was attempted.'
            }
        }
    } finally {
        foreach ($name in $environmentNames) {
            [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
        }
        $testPassword = $null
        $testPasswordBytes = $null
    }
}

if ($mavenExitCode -ne 0) {
    throw "Identity PostgreSQL test verification failed (Maven exit code $mavenExitCode)"
}

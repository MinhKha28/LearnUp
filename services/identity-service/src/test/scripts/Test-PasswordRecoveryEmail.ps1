<#
.SYNOPSIS
Runs real Identity -> Notification HTTP -> JavaMail -> disposable loopback SMTP tests.
.DESCRIPTION
Requires Java 21, Maven, a running Docker daemon, a cached postgres:16-alpine image,
and the already packaged Notification Service JAR from a successful clean verify.
The existing PostgreSQL runner creates a new labelled, loopback-only container and
restores process-local database credentials after the test run. No existing database,
container, named volume or external SMTP provider is used. SMTP message bodies and
the Notification child process output remain bounded in memory only.

The complete Identity suite runs, including the opt-in migrated PostgreSQL contract
and three real HTTP/SMTP recovery tests. Tenant access decisions remain mocked;
SMTP acceptance is not proof of delivery to an external mailbox or frontend E2E.
.EXAMPLE
./src/test/scripts/Test-PasswordRecoveryEmail.ps1 -MavenGoals clean,verify -Offline -MavenRepository 'C:\path\to\.m2\repository'
#>
[CmdletBinding()]
param(
    [string[]]$MavenGoals = @('test'),
    [string]$MavenRepository,
    [switch]$Offline
)

$ErrorActionPreference = 'Stop'
$identityDirectory = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$notificationJar = Join-Path $identityDirectory '../notification-service/target/notification-service-1.0.0-SNAPSHOT.jar'
$postgresRunner = Join-Path $PSScriptRoot 'Test-PasswordResetPostgres.ps1'
if (-not (Test-Path -LiteralPath $notificationJar -PathType Leaf)) {
    throw 'Run a successful Notification Service clean verify before the opt-in recovery email tests.'
}
if (-not (Test-Path -LiteralPath $postgresRunner -PathType Leaf)) {
    throw 'The reviewed disposable PostgreSQL runner is required; no database fallback is allowed.'
}

$previousOptIn = [Environment]::GetEnvironmentVariable('IDENTITY_TEST_RECOVERY_E2E', 'Process')
try {
    [Environment]::SetEnvironmentVariable('IDENTITY_TEST_RECOVERY_E2E', 'true', 'Process')
    $runnerArguments = @{
        AllTests = $true
        MavenGoals = $MavenGoals
        Offline = $Offline
    }
    if ($MavenRepository) {
        $runnerArguments.MavenRepository = $MavenRepository
    }
    Write-Host 'Running opt-in real Identity/Notification HTTP and SMTP verification; Tenant remains mocked.'
    & $postgresRunner @runnerArguments
} finally {
    [Environment]::SetEnvironmentVariable('IDENTITY_TEST_RECOVERY_E2E', $previousOptIn, 'Process')
}

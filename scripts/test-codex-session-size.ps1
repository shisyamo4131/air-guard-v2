$ErrorActionPreference = 'Stop'

$scriptUnderTest = Join-Path $PSScriptRoot 'check-codex-session-size.ps1'
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("airguard-codex-capacity-" + [guid]::NewGuid().ToString('N'))
$sessionsRoot = Join-Path $fixtureRoot 'sessions\2026\08\28'
$cachePath = Join-Path $fixtureRoot 'capacity-cache.json'
$testSessionId = 'capacity-task-001'

function Invoke-CapacityScript([string[]]$Arguments) {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptUnderTest @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    return [pscustomobject]@{
        output = @($output)
        exit_code = $exitCode
    }
}

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Path $sessionsRoot -Force | Out-Null
    $sessionPath = Join-Path $sessionsRoot "rollout-2026-08-28T00-00-00-$testSessionId.jsonl"
    [IO.File]::WriteAllBytes($sessionPath, [byte[]]::new(1024))

    $missingId = Invoke-CapacityScript @('-CodexRoot', $fixtureRoot, '-TotalCachePath', $cachePath)
    Assert-True ($missingId.exit_code -ne 0) 'Missing SessionId must fail.'

    $zeroMatch = Invoke-CapacityScript @('-SessionId', 'unknown-task', '-CodexRoot', $fixtureRoot, '-TotalCachePath', $cachePath)
    Assert-True ($zeroMatch.exit_code -ne 0) 'Zero matching sessions must fail.'

    $success = Invoke-CapacityScript @(
        '-SessionId', $testSessionId,
        '-CodexRoot', $fixtureRoot,
        '-ThresholdBytes', '2048',
        '-TotalThresholdBytes', '4096',
        '-TotalCachePath', $cachePath,
        '-ForceTotalScan'
    )
    Assert-True ($success.exit_code -eq 0) 'Exact-one session measurement must succeed.'
    $result = ($success.output -join [Environment]::NewLine) | ConvertFrom-Json
    Assert-True ($result.session_id -eq $testSessionId) 'The reported session ID must match the requested task.'
    Assert-True ($result.size_bytes -eq 1024) 'The measured session size must match the fixture.'
    Assert-True ($result.threshold_bytes -eq 2048) 'The task threshold must be reported.'
    Assert-True ($result.usage_percent -eq 50) 'Usage percentage must be calculated from task size and threshold.'
    Assert-True (-not $result.handoff_required) 'Handoff must be false below the threshold.'
    Assert-True ($result.codex_total_threshold_bytes -eq 4096) 'The Codex-wide reference threshold must be separate.'
    Assert-True ($result.codex_scan_complete) 'The isolated fixture scan must be complete.'
    Assert-True ($result.codex_scan_error_count -eq 0) 'The isolated fixture scan must have zero errors.'
    Assert-True ($result.selection -eq 'session_id') 'Session selection must be task-ID based.'
    Assert-True ($result.codex_total_measurement_source -eq 'scanned') 'A forced total scan must report scanned source.'

    $cached = Invoke-CapacityScript @(
        '-SessionId', $testSessionId,
        '-CodexRoot', $fixtureRoot,
        '-ThresholdBytes', '2048',
        '-TotalThresholdBytes', '4096',
        '-TotalCachePath', $cachePath
    )
    Assert-True ($cached.exit_code -eq 0) 'Cached capacity measurement must succeed.'
    $cachedResult = ($cached.output -join [Environment]::NewLine) | ConvertFrom-Json
    Assert-True ($cachedResult.codex_total_measurement_source -eq 'cached') 'A fresh matching cache must report cached source.'

    $handoff = Invoke-CapacityScript @(
        '-SessionId', $testSessionId,
        '-CodexRoot', $fixtureRoot,
        '-ThresholdBytes', '512',
        '-TotalThresholdBytes', '4096',
        '-TotalCachePath', $cachePath
    )
    Assert-True ($handoff.exit_code -eq 0) 'Threshold boundary measurement must succeed.'
    $handoffResult = ($handoff.output -join [Environment]::NewLine) | ConvertFrom-Json
    Assert-True $handoffResult.handoff_required 'Handoff must be true at or above the task threshold.'

    $duplicatePath = Join-Path $sessionsRoot "rollout-duplicate-$testSessionId.jsonl"
    [IO.File]::WriteAllBytes($duplicatePath, [byte[]]::new(1))
    $multipleMatch = Invoke-CapacityScript @('-SessionId', $testSessionId, '-CodexRoot', $fixtureRoot, '-TotalCachePath', $cachePath)
    Assert-True ($multipleMatch.exit_code -ne 0) 'Multiple matching sessions must fail instead of selecting the newest.'

    Write-Output 'Capacity routing and measurement regression passed: 7 checks.'
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        $resolvedFixture = (Resolve-Path -LiteralPath $fixtureRoot).Path
        $resolvedTemp = ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())).TrimEnd('\')
        if (-not $resolvedFixture.StartsWith($resolvedTemp + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw "Fixture path escaped the temporary directory: $resolvedFixture"
        }
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    }
}

$global:LASTEXITCODE = 0

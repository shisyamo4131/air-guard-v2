[CmdletBinding()]
param(
    [ValidateSet('Seed', 'Test')]
    [string]$Mode = 'Test',
    [ValidateSet('Harness', 'CcbRulesPrecontainment')]
    [string]$Suite = 'Harness',
    [string]$TestNamePattern = '',
    [long]$WarnBytes = 50MB,
    [long]$StopBytes = 100MB
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dedicatedRoot = Join-Path $projectRoot '.codex-test'
$seedPath = Join-Path $dedicatedRoot 'isolated-saved-data'
$runtimeRoot = Join-Path $dedicatedRoot 'runtime'
$runtimePath = Join-Path $runtimeRoot ("{0}-{1}-{2}" -f $Mode.ToLowerInvariant(), $Suite.ToLowerInvariant(), $PID)
$userSavedDataPath = Join-Path $projectRoot 'saved-data'
$configPath = Join-Path $projectRoot 'firebase.codex-test.json'
$seedScriptPath = Join-Path $projectRoot 'scripts\seed-codex-local-test.mjs'
$testPath = switch ($Suite) {
    'Harness' { Join-Path $projectRoot 'test\local\codex-local-harness.test.mjs' }
    'CcbRulesPrecontainment' { Join-Path $projectRoot 'test\local\ccb-rules-precontainment-emulator.test.mjs' }
}
$projectId = 'demo-air-guard-v2-codex'
$seedEmulators = 'auth,firestore,database,storage'
$testEmulators = if ($Suite -eq 'CcbRulesPrecontainment') {
    'firestore'
} else {
    'auth,firestore,database,storage,functions'
}
$emulators = if ($Mode -eq 'Seed') { $seedEmulators } else { $testEmulators }

if ($Mode -eq 'Seed' -and $Suite -ne 'Harness') {
    throw 'Seed mode is only available for the Harness suite.'
}

function Assert-ProjectChild {
    param([Parameter(Mandatory = $true)][string]$Path)

    $absolutePath = [IO.Path]::GetFullPath($Path)
    $requiredPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $absolutePath.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Codex test path escaped the project root: $absolutePath"
    }
    return $absolutePath
}

function Get-DirectoryBytes {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return [long]0 }
    $sum = (Get-ChildItem -LiteralPath $Path -File -Force -Recurse -ErrorAction Stop |
        Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return [long]0 }
    return [long]$sum
}

function Get-DirectoryFingerprint {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return '<missing>' }
    $normalizedRoot = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $records = foreach ($file in Get-ChildItem -LiteralPath $Path -File -Force -Recurse | Sort-Object FullName) {
        $relativePath = $file.FullName.Substring($normalizedRoot.Length).TrimStart('\')
        $stream = [System.IO.File]::OpenRead($file.FullName)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hash = ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '')
        }
        finally {
            $sha256.Dispose()
            $stream.Dispose()
        }
        "$relativePath|$($file.Length)|$hash"
    }
    $joined = $records -join "`n"
    $bytes = [Text.Encoding]::UTF8.GetBytes($joined)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '')
    } finally {
        $sha.Dispose()
    }
}

function Resolve-Executable {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$Fallback
    )

    $resolved = Get-Command $Command -ErrorAction SilentlyContinue
    if ($resolved) { return $resolved.Source }
    if (Test-Path -LiteralPath $Fallback -PathType Leaf) { return $Fallback }
    throw "Required executable was not found: $Command"
}

function Remove-RuntimeDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    for ($attempt = 1; $attempt -le 20; $attempt++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return
        }
        catch [System.IO.IOException] {
            if ($attempt -eq 20) {
                Write-Warning "Runtime cleanup remains deferred because Windows still has an open handle: $Path"
                return
            }
            Start-Sleep -Milliseconds 500
        }
    }
}

Assert-ProjectChild -Path $dedicatedRoot | Out-Null
Assert-ProjectChild -Path $seedPath | Out-Null
Assert-ProjectChild -Path $runtimePath | Out-Null

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Dedicated Firebase config is missing: $configPath"
}

New-Item -ItemType Directory -Path $dedicatedRoot -Force | Out-Null
$existingBytes = Get-DirectoryBytes -Path $dedicatedRoot
if ($existingBytes -ge $StopBytes) {
    throw "Codex test storage is at or above the stop limit: $([math]::Round($existingBytes / 1MB, 2)) MiB"
}
if ($existingBytes -ge $WarnBytes) {
    Write-Warning "Codex test storage reached $([math]::Round($existingBytes / 1MB, 2)) MiB."
}

$metadataPath = Join-Path $seedPath 'firebase-export-metadata.json'
if ($Mode -eq 'Seed' -and (Test-Path -LiteralPath $seedPath)) {
    throw 'Dedicated isolated-saved-data already exists. Normal tests never overwrite it; remove it only through a separately approved cleanup.'
}
if ($Mode -eq 'Test' -and -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw 'Dedicated isolated-saved-data is missing. Run npm run test:local:seed once before the normal test command.'
}

$nodeExe = Resolve-Executable -Command 'node.exe' -Fallback (Join-Path $env:ProgramFiles 'nodejs\node.exe')
$firebaseExe = Resolve-Executable -Command 'firebase.cmd' -Fallback (Join-Path $env:APPDATA 'npm\firebase.cmd')
$userDataBefore = Get-DirectoryFingerprint -Path $userSavedDataPath
$seedBefore = if ($Mode -eq 'Test') { Get-DirectoryFingerprint -Path $seedPath } else { '<not-created>' }

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$childScriptPath = Join-Path $runtimePath 'run-child.cmd'
$firebaseArguments = @(
    '--config', $configPath,
    '--project', $projectId,
    'emulators:exec',
    '--only', $emulators,
    '--log-verbosity', 'QUIET'
)

if ($Mode -eq 'Seed') {
    $firebaseArguments += @('--export-on-exit', $seedPath)
    $childScriptContent = '@"{0}" "{1}"' -f $nodeExe, $seedScriptPath
} else {
    $firebaseArguments += @('--import', $seedPath)
    $testArguments = if ($TestNamePattern) {
        if ($TestNamePattern.Contains('"') -or $TestNamePattern.Contains("`r") -or $TestNamePattern.Contains("`n")) {
            throw 'TestNamePattern contains unsupported characters.'
        }
        '--test --test-name-pattern "{0}" "{1}"' -f $TestNamePattern, $testPath
    } else {
        '--test "{0}"' -f $testPath
    }
    $childScriptContent = '@"{0}" {1}' -f $nodeExe, $testArguments
}
Set-Content -LiteralPath $childScriptPath -Value $childScriptContent -Encoding Ascii
$firebaseArguments += $childScriptPath

$exitCode = 1
$externalEffectsModeWasSet = Test-Path Env:\AIR_GUARD_EXTERNAL_EFFECTS
$externalEffectsModeBefore = $env:AIR_GUARD_EXTERNAL_EFFECTS
try {
    $env:AIR_GUARD_EXTERNAL_EFFECTS = 'deny'
    Push-Location $runtimePath
    & $firebaseExe @firebaseArguments
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
    if ($externalEffectsModeWasSet) {
        $env:AIR_GUARD_EXTERNAL_EFFECTS = $externalEffectsModeBefore
    } else {
        Remove-Item Env:\AIR_GUARD_EXTERNAL_EFFECTS -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $runtimePath) {
        Assert-ProjectChild -Path $runtimePath | Out-Null
        Remove-RuntimeDirectory -Path $runtimePath
    }
}

$userDataAfter = Get-DirectoryFingerprint -Path $userSavedDataPath
if ($userDataAfter -ne $userDataBefore) {
    throw 'The user-owned saved-data fingerprint changed during the Codex test command.'
}

if ($Mode -eq 'Seed' -and -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw 'Firebase Emulator did not create the dedicated export metadata.'
}
if ($Mode -eq 'Test') {
    $seedAfter = Get-DirectoryFingerprint -Path $seedPath
    if ($seedAfter -ne $seedBefore) {
        throw 'Dedicated saved-data changed during a read-only test run.'
    }
}
if ($exitCode -ne 0) {
    throw "Firebase Emulator command failed with exit code $exitCode."
}

$finalBytes = Get-DirectoryBytes -Path $dedicatedRoot
if ($finalBytes -ge $StopBytes) {
    throw "Codex test storage exceeded the stop limit: $([math]::Round($finalBytes / 1MB, 2)) MiB"
}

[pscustomobject]@{
    mode = $Mode
    suite = $Suite
    project_id = $projectId
    emulators = $emulators
    functions_started = $Mode -eq 'Test' -and $Suite -eq 'Harness'
    loopback_only = $true
    user_saved_data_unchanged = $true
    dedicated_saved_data_read_only = $Mode -eq 'Test'
    codex_test_storage_mib = [math]::Round($finalBytes / 1MB, 2)
    warning_threshold_mib = [math]::Round($WarnBytes / 1MB, 2)
    stop_threshold_mib = [math]::Round($StopBytes / 1MB, 2)
} | ConvertTo-Json

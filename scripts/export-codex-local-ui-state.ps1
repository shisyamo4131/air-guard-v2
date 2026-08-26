[CmdletBinding()]
param(
    [long]$StopBytes = 100MB
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dedicatedRoot = Join-Path $projectRoot '.codex-test'
$runtimeRoot = Join-Path $dedicatedRoot 'runtime'
$candidatePath = Join-Path $dedicatedRoot 'ui-candidate'
$candidateAcceptancePath = Join-Path $dedicatedRoot 'ui-candidate-acceptance.json'
$stagingPath = Join-Path $runtimeRoot ("ui-export-{0}" -f $PID)
$userSavedDataPath = Join-Path $projectRoot 'saved-data'
$configPath = Join-Path $projectRoot 'firebase.codex-test.json'
$projectId = 'demo-air-guard-v2-codex'

function Assert-ProjectChild {
    param([Parameter(Mandatory = $true)][string]$Path)

    $absolutePath = [IO.Path]::GetFullPath($Path)
    $requiredPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $absolutePath.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Codex UI export path escaped the project root: $absolutePath"
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
    $bytes = [Text.Encoding]::UTF8.GetBytes($records -join "`n")
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '')
    } finally {
        $sha.Dispose()
    }
}

foreach ($path in @($dedicatedRoot, $runtimeRoot, $candidatePath, $candidateAcceptancePath, $stagingPath)) {
    Assert-ProjectChild -Path $path | Out-Null
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
if (Test-Path -LiteralPath $candidatePath) {
    throw 'Dedicated UI candidate already exists; do not overwrite unverified state.'
}
if (Test-Path -LiteralPath $candidateAcceptancePath) {
    throw 'Stale dedicated UI candidate acceptance exists; do not overwrite it.'
}
if (Test-Path -LiteralPath $stagingPath) {
    throw 'Dedicated UI export staging path already exists.'
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$firebaseCommand = Get-Command firebase.cmd -ErrorAction SilentlyContinue
$firebaseExe = if ($firebaseCommand) { $firebaseCommand.Source } else { Join-Path $env:APPDATA 'npm\firebase.cmd' }
if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf) -or
    -not (Test-Path -LiteralPath $firebaseExe -PathType Leaf)) {
    throw 'Node.js or the global Firebase CLI was not found.'
}

$userDataBefore = Get-DirectoryFingerprint -Path $userSavedDataPath
$previousExternalEffects = $env:AIR_GUARD_EXTERNAL_EFFECTS

try {
    $env:AIR_GUARD_EXTERNAL_EFFECTS = 'deny'
    & $firebaseExe `
        --config $configPath `
        --project $projectId `
        emulators:export $stagingPath
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase Emulator export failed with exit code $LASTEXITCODE."
    }

    $metadataPath = Join-Path $stagingPath 'firebase-export-metadata.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
        throw 'Firebase Emulator export metadata is missing.'
    }
    $exportBytes = Get-DirectoryBytes -Path $stagingPath
    if ($exportBytes -ge $StopBytes) {
        throw "Codex UI export reached the stop limit: $([math]::Round($exportBytes / 1MB, 2)) MiB"
    }

    Move-Item -LiteralPath $stagingPath -Destination $candidatePath
} finally {
    $env:AIR_GUARD_EXTERNAL_EFFECTS = $previousExternalEffects
    foreach ($path in @($stagingPath)) {
        if (Test-Path -LiteralPath $path) {
            Assert-ProjectChild -Path $path | Out-Null
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }
}

$userDataAfter = Get-DirectoryFingerprint -Path $userSavedDataPath
if ($userDataAfter -ne $userDataBefore) {
    throw 'The user-owned saved-data fingerprint changed during the Codex UI export.'
}

[pscustomobject]@{
    project_id = $projectId
    exported = $true
    synthetic_only = $true
    user_saved_data_unchanged = $true
    candidate_ready = $true
    export_mib = [math]::Round((Get-DirectoryBytes -Path $candidatePath) / 1MB, 2)
} | ConvertTo-Json

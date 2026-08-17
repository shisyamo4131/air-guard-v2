[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dedicatedRoot = Join-Path $projectRoot '.codex-test'
$runtimeRoot = Join-Path $dedicatedRoot 'runtime'
$candidatePath = Join-Path $dedicatedRoot 'ui-candidate'
$savedDataPath = Join-Path $dedicatedRoot 'saved-data'
$backupPath = Join-Path $runtimeRoot ("ui-promotion-backup-{0}" -f $PID)

function Assert-ProjectChild {
    param([Parameter(Mandatory = $true)][string]$Path)

    $absolutePath = [IO.Path]::GetFullPath($Path)
    $requiredPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $absolutePath.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Codex UI promotion path escaped the project root: $absolutePath"
    }
    return $absolutePath
}

foreach ($path in @($dedicatedRoot, $runtimeRoot, $candidatePath, $savedDataPath, $backupPath)) {
    Assert-ProjectChild -Path $path | Out-Null
}

$candidateMetadata = Join-Path $candidatePath 'firebase-export-metadata.json'
if (-not (Test-Path -LiteralPath $candidateMetadata -PathType Leaf)) {
    throw 'Verified Codex UI candidate metadata is missing.'
}
if (Test-Path -LiteralPath $backupPath) {
    throw 'Codex UI promotion backup path already exists.'
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$savedDataMoved = $false
try {
    if (Test-Path -LiteralPath $savedDataPath) {
        Move-Item -LiteralPath $savedDataPath -Destination $backupPath
        $savedDataMoved = $true
    }
    Move-Item -LiteralPath $candidatePath -Destination $savedDataPath
    if (Test-Path -LiteralPath $backupPath) {
        Remove-Item -LiteralPath $backupPath -Recurse -Force
        $savedDataMoved = $false
    }
} catch {
    if ($savedDataMoved -and
        -not (Test-Path -LiteralPath $savedDataPath) -and
        (Test-Path -LiteralPath $backupPath)) {
        Move-Item -LiteralPath $backupPath -Destination $savedDataPath
        $savedDataMoved = $false
    }
    throw
}

[pscustomobject]@{
    promoted = $true
    project_id = 'demo-air-guard-v2-codex'
} | ConvertTo-Json

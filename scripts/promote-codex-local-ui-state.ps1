[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dedicatedRoot = Join-Path $projectRoot '.codex-test'
$runtimeRoot = Join-Path $dedicatedRoot 'runtime'
$candidatePath = Join-Path $dedicatedRoot 'ui-candidate'
$candidateAcceptancePath = Join-Path $dedicatedRoot 'ui-candidate-acceptance.json'
$savedDataPath = Join-Path $dedicatedRoot 'saved-data'
$backupPath = Join-Path $runtimeRoot ("ui-promotion-backup-{0}" -f $PID)
$acceptanceBackupPath = Join-Path $runtimeRoot ("ui-promotion-acceptance-{0}.json" -f $PID)
$dedicatedPorts = @(14400, 14500, 14600, 15001, 18080, 19000, 19099, 19199)

function Assert-ProjectChild {
    param([Parameter(Mandatory = $true)][string]$Path)

    $absolutePath = [IO.Path]::GetFullPath($Path)
    $requiredPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $absolutePath.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Codex UI promotion path escaped the project root: $absolutePath"
    }
    return $absolutePath
}

foreach ($path in @($dedicatedRoot, $runtimeRoot, $candidatePath, $candidateAcceptancePath, $savedDataPath, $backupPath, $acceptanceBackupPath)) {
    Assert-ProjectChild -Path $path | Out-Null
}

$candidateMetadata = Join-Path $candidatePath 'firebase-export-metadata.json'
if (-not (Test-Path -LiteralPath $candidateMetadata -PathType Leaf)) {
    throw 'Verified Codex UI candidate metadata is missing.'
}
if (Test-Path -LiteralPath $backupPath) {
    throw 'Codex UI promotion backup path already exists.'
}
if (Test-Path -LiteralPath $acceptanceBackupPath) {
    throw 'Codex UI promotion acceptance backup path already exists.'
}

$listeningPorts = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port
$blockedPorts = @($dedicatedPorts | Where-Object { $listeningPorts -contains $_ })
if ($blockedPorts.Count -gt 0) {
    throw "Dedicated UI processes must be stopped before promotion. Listening ports: $($blockedPorts -join ', ')"
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw 'Node.js was not found for candidate acceptance verification.'
}
& $nodeCommand.Source (Join-Path $PSScriptRoot 'accept-codex-local-ui-candidate.mjs') --assert-only | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Dedicated UI candidate acceptance verification failed with exit code $LASTEXITCODE."
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$savedDataMoved = $false
$acceptanceMoved = $false
try {
    Move-Item -LiteralPath $candidateAcceptancePath -Destination $acceptanceBackupPath
    $acceptanceMoved = $true
    if (Test-Path -LiteralPath $savedDataPath) {
        Move-Item -LiteralPath $savedDataPath -Destination $backupPath
        $savedDataMoved = $true
    }
    Move-Item -LiteralPath $candidatePath -Destination $savedDataPath
} catch {
    if ($savedDataMoved -and
        -not (Test-Path -LiteralPath $savedDataPath) -and
        (Test-Path -LiteralPath $backupPath)) {
        Move-Item -LiteralPath $backupPath -Destination $savedDataPath
        $savedDataMoved = $false
    }
    if ($acceptanceMoved -and
        -not (Test-Path -LiteralPath $candidateAcceptancePath) -and
        (Test-Path -LiteralPath $acceptanceBackupPath)) {
        Move-Item -LiteralPath $acceptanceBackupPath -Destination $candidateAcceptancePath
        $acceptanceMoved = $false
    }
    throw
}

$cleanupRequired = $false
foreach ($cleanupPath in @($acceptanceBackupPath, $backupPath)) {
    if (Test-Path -LiteralPath $cleanupPath) {
        try {
            Remove-Item -LiteralPath $cleanupPath -Recurse -Force
        } catch {
            $cleanupRequired = $true
            Write-Warning "Promoted state is valid, but a runtime backup requires cleanup: $cleanupPath"
        }
    }
}

[pscustomobject]@{
    promoted = $true
    project_id = 'demo-air-guard-v2-codex'
    cleanup_required = $cleanupRequired
} | ConvertTo-Json

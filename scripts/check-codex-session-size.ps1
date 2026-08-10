param(
    [Parameter(Mandatory = $true)]
    [string]$SessionId,
    [string]$CodexRoot = (Join-Path $env:USERPROFILE '.codex'),
    [long]$ThresholdBytes = 300MB,
    [long]$TotalThresholdBytes = 2GB
)

$sessionsRoot = Join-Path $CodexRoot 'sessions'
if (-not (Test-Path -LiteralPath $sessionsRoot)) {
    throw "Codex sessions directory was not found: $sessionsRoot"
}

$sessionFiles = @(Get-ChildItem -LiteralPath $sessionsRoot -Recurse -File -Filter '*.jsonl' |
    Where-Object { $_.BaseName -like "*$SessionId*" })
if ($sessionFiles.Count -ne 1) {
    throw "Expected exactly one session for '$SessionId', found $($sessionFiles.Count)."
}

$scanErrors = @()
$codexFiles = @(Get-ChildItem -LiteralPath $CodexRoot -Recurse -File -ErrorAction SilentlyContinue -ErrorVariable +scanErrors)
$totalBytes = [long](($codexFiles | Measure-Object -Property Length -Sum).Sum)
$sessionFile = $sessionFiles[0]

[pscustomobject]@{
    session_file = $sessionFile.FullName
    size_bytes = $sessionFile.Length
    size_mib = [math]::Round($sessionFile.Length / 1MB, 2)
    threshold_mib = [math]::Round($ThresholdBytes / 1MB, 2)
    handoff_required = $sessionFile.Length -ge $ThresholdBytes
    codex_total_mib = [math]::Round($totalBytes / 1MB, 2)
    codex_total_threshold_mib = [math]::Round($TotalThresholdBytes / 1MB, 2)
    codex_total_warning = $totalBytes -ge $TotalThresholdBytes
    codex_scan_complete = $scanErrors.Count -eq 0
    codex_scan_error_count = $scanErrors.Count
    measured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    selection = 'session_id'
} | ConvertTo-Json

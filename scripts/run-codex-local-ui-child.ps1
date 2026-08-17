[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$NodePath,
    [Parameter(Mandatory = $true)][string]$NuxtPath,
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$DotenvPath,
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$StopFile,
    [Parameter(Mandatory = $true)][string]$StandardOutputPath,
    [Parameter(Mandatory = $true)][string]$StandardErrorPath
)

$ErrorActionPreference = 'Stop'
$nuxtArguments = @(
    $NuxtPath,
    'dev',
    '--dotenv', $DotenvPath,
    '--host', $HostName,
    '--port', [string]$Port
)
$startParameters = @{
    FilePath = $NodePath
    ArgumentList = $nuxtArguments
    WorkingDirectory = $ProjectRoot
    RedirectStandardOutput = $StandardOutputPath
    RedirectStandardError = $StandardErrorPath
    WindowStyle = 'Hidden'
    PassThru = $true
}
$nuxtProcess = Start-Process @startParameters

try {
    while (-not (Test-Path -LiteralPath $StopFile -PathType Leaf)) {
        if ($nuxtProcess.HasExited) {
            if (Test-Path -LiteralPath $StandardOutputPath) {
                Get-Content -LiteralPath $StandardOutputPath
            }
            if (Test-Path -LiteralPath $StandardErrorPath) {
                Get-Content -LiteralPath $StandardErrorPath | Write-Error
            }
            exit $nuxtProcess.ExitCode
        }
        Start-Sleep -Milliseconds 250
    }
} finally {
    if (-not $nuxtProcess.HasExited) {
        Stop-Process -Id $nuxtProcess.Id -ErrorAction SilentlyContinue
        Wait-Process -Id $nuxtProcess.Id -ErrorAction SilentlyContinue
    }
}

exit 0

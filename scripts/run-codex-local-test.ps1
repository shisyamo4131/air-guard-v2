[CmdletBinding()]
param(
    [ValidateSet('Seed', 'Test', 'UI')]
    [string]$Mode = 'Test',
    [long]$WarnBytes = 50MB,
    [long]$StopBytes = 100MB
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$dedicatedRoot = Join-Path $projectRoot '.codex-test'
$seedPath = Join-Path $dedicatedRoot 'saved-data'
$runtimeRoot = Join-Path $dedicatedRoot 'runtime'
$runtimePath = Join-Path $runtimeRoot ("{0}-{1}" -f $Mode.ToLowerInvariant(), $PID)
$userSavedDataPath = Join-Path $projectRoot 'saved-data'
$configPath = Join-Path $projectRoot 'firebase.codex-test.json'
$seedScriptPath = Join-Path $projectRoot 'scripts\seed-codex-local-test.mjs'
$testPath = Join-Path $projectRoot 'test\local\codex-local-harness.test.mjs'
$uiChildScriptPath = Join-Path $projectRoot 'scripts\run-codex-local-ui-child.ps1'
$projectId = 'demo-air-guard-v2-codex'
$uiHost = '127.0.0.1'
$uiPort = 14600
$uiStopPath = Join-Path $runtimeRoot 'ui.stop'
$seedEmulators = 'auth,firestore,database,storage'
$testEmulators = 'auth,firestore,database,storage,functions'
$emulators = if ($Mode -eq 'Seed') { $seedEmulators } else { $testEmulators }

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
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
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

Assert-ProjectChild -Path $dedicatedRoot | Out-Null
Assert-ProjectChild -Path $seedPath | Out-Null
Assert-ProjectChild -Path $runtimePath | Out-Null
Assert-ProjectChild -Path $uiStopPath | Out-Null

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Dedicated Firebase config is missing: $configPath"
}

New-Item -ItemType Directory -Path $dedicatedRoot -Force | Out-Null
if ($Mode -eq 'UI' -and (Test-Path -LiteralPath $uiStopPath)) {
    Remove-Item -LiteralPath $uiStopPath -Force
}
$existingBytes = Get-DirectoryBytes -Path $dedicatedRoot
if ($existingBytes -ge $StopBytes) {
    throw "Codex test storage is at or above the stop limit: $([math]::Round($existingBytes / 1MB, 2)) MiB"
}
if ($existingBytes -ge $WarnBytes) {
    Write-Warning "Codex test storage reached $([math]::Round($existingBytes / 1MB, 2)) MiB."
}

$metadataPath = Join-Path $seedPath 'firebase-export-metadata.json'
if ($Mode -eq 'Seed' -and (Test-Path -LiteralPath $seedPath)) {
    throw 'Dedicated saved-data already exists. Normal tests never overwrite it; remove it only through a separately approved cleanup.'
}
if ($Mode -ne 'Seed' -and -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw 'Dedicated saved-data is missing. Run npm run test:local:seed once before the normal test command.'
}

$nodeExe = Resolve-Executable -Command 'node.exe' -Fallback (Join-Path $env:ProgramFiles 'nodejs\node.exe')
$npxCli = Join-Path (Split-Path -Parent $nodeExe) 'node_modules\npm\bin\npx-cli.js'
if (-not (Test-Path -LiteralPath $npxCli -PathType Leaf)) {
    throw "npx CLI entrypoint was not found: $npxCli"
}
$userDataBefore = Get-DirectoryFingerprint -Path $userSavedDataPath
$seedBefore = if ($Mode -ne 'Seed') { Get-DirectoryFingerprint -Path $seedPath } else { '<not-created>' }

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$childScriptPath = Join-Path $runtimePath 'run-child.cmd'
$firebaseArguments = @(
    '-y', 'firebase-tools@latest',
    '--config', $configPath,
    '--project', $projectId,
    'emulators:exec',
    '--only', $emulators,
    '--log-verbosity', 'QUIET'
)

if ($Mode -eq 'Seed') {
    $firebaseArguments += @('--export-on-exit', $seedPath)
    $childScriptContent = '@"{0}" "{1}"' -f $nodeExe, $seedScriptPath
} elseif ($Mode -eq 'Test') {
    $firebaseArguments += @('--import', $seedPath)
    $childScriptContent = '@"{0}" --test "{1}"' -f $nodeExe, $testPath
} else {
    $firebaseArguments += @('--import', $seedPath)
    $nuxtEntryPath = Join-Path $projectRoot 'node_modules\nuxt\bin\nuxt.mjs'
    if (-not (Test-Path -LiteralPath $nuxtEntryPath -PathType Leaf)) {
        throw "Nuxt CLI entrypoint was not found: $nuxtEntryPath"
    }
    if (-not (Test-Path -LiteralPath $uiChildScriptPath -PathType Leaf)) {
        throw "Dedicated UI child script was not found: $uiChildScriptPath"
    }
    $powerShellExe = Resolve-Executable -Command 'powershell.exe' -Fallback (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
    $uiDotenvPath = Join-Path $runtimePath 'codex-ui.env'
    $uiStandardOutputPath = Join-Path $runtimePath 'nuxt.stdout.log'
    $uiStandardErrorPath = Join-Path $runtimePath 'nuxt.stderr.log'
    Set-Content -LiteralPath $uiDotenvPath -Value '# Dedicated Codex UI values are supplied by the parent process.' -Encoding Ascii
    $childArguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $uiChildScriptPath,
        '-NodePath', $nodeExe,
        '-NuxtPath', $nuxtEntryPath,
        '-ProjectRoot', $projectRoot,
        '-DotenvPath', $uiDotenvPath,
        '-HostName', $uiHost,
        '-Port', [string]$uiPort,
        '-StopFile', $uiStopPath,
        '-StandardOutputPath', $uiStandardOutputPath,
        '-StandardErrorPath', $uiStandardErrorPath
    )
    $quotedChildArguments = $childArguments | ForEach-Object { '"{0}"' -f $_ }
    $childScriptContent = '@"{0}" {1}' -f $powerShellExe, ($quotedChildArguments -join ' ')
}
Set-Content -LiteralPath $childScriptPath -Value $childScriptContent -Encoding Ascii
$firebaseArguments += $childScriptPath

$exitCode = 1
$externalEffectsModeWasSet = Test-Path Env:\AIR_GUARD_EXTERNAL_EFFECTS
$externalEffectsModeBefore = $env:AIR_GUARD_EXTERNAL_EFFECTS
$uiEnvironment = @{}
$uiEnvironmentBefore = @{}
if ($Mode -eq 'UI') {
    $uiEnvironment = @{
        NUXT_PUBLIC_FIREBASE_USE_EMULATOR = 'true'
        NUXT_PUBLIC_FIREBASE_API_KEY = 'codex-local-only'
        NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-air-guard-v2-codex.localhost'
        NUXT_PUBLIC_FIREBASE_DATABASE_URL = 'http://127.0.0.1:19000?ns=demo-air-guard-v2-codex'
        NUXT_PUBLIC_FIREBASE_PROJECT_ID = $projectId
        NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'demo-air-guard-v2-codex.appspot.com'
        NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000'
        NUXT_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:codex-local'
        NUXT_PUBLIC_FIREBASE_REGION = 'asia-northeast1'
        NUXT_PUBLIC_FIREBASE_VAPID_KEY = ''
        NUXT_PUBLIC_FIREBASE_EMULATOR_HOST = '127.0.0.1'
        NUXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT = '19099'
        NUXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT = '18080'
        NUXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_PORT = '19000'
        NUXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT = '19199'
        NUXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT = '15001'
    }
    foreach ($name in $uiEnvironment.Keys) {
        $uiEnvironmentBefore[$name] = @{
            exists = Test-Path "Env:$name"
            value = [Environment]::GetEnvironmentVariable($name, 'Process')
        }
        Set-Item -Path "Env:$name" -Value $uiEnvironment[$name]
    }
}
try {
    $env:AIR_GUARD_EXTERNAL_EFFECTS = 'deny'
    Push-Location $runtimePath
    & $nodeExe $npxCli @firebaseArguments
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
    if ($externalEffectsModeWasSet) {
        $env:AIR_GUARD_EXTERNAL_EFFECTS = $externalEffectsModeBefore
    } else {
        Remove-Item Env:\AIR_GUARD_EXTERNAL_EFFECTS -ErrorAction SilentlyContinue
    }
    foreach ($name in $uiEnvironment.Keys) {
        $previous = $uiEnvironmentBefore[$name]
        if ($previous.exists) {
            Set-Item -Path "Env:$name" -Value $previous.value
        } else {
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $uiStopPath) {
        Remove-Item -LiteralPath $uiStopPath -Force
    }
    if (Test-Path -LiteralPath $runtimePath) {
        Assert-ProjectChild -Path $runtimePath | Out-Null
        Remove-Item -LiteralPath $runtimePath -Recurse -Force
    }
}

$userDataAfter = Get-DirectoryFingerprint -Path $userSavedDataPath
if ($userDataAfter -ne $userDataBefore) {
    throw 'The user-owned saved-data fingerprint changed during the Codex test command.'
}

if ($Mode -eq 'Seed' -and -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw 'Firebase Emulator did not create the dedicated export metadata.'
}
if ($Mode -ne 'Seed') {
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
    project_id = $projectId
    emulators = $emulators
    functions_started = $Mode -ne 'Seed'
    server_started = $Mode -eq 'UI'
    loopback_only = $true
    user_saved_data_unchanged = $true
    dedicated_saved_data_read_only = $Mode -ne 'Seed'
    codex_test_storage_mib = [math]::Round($finalBytes / 1MB, 2)
    warning_threshold_mib = [math]::Round($WarnBytes / 1MB, 2)
    stop_threshold_mib = [math]::Round($StopBytes / 1MB, 2)
} | ConvertTo-Json

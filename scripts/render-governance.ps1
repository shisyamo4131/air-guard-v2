[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$governanceRoot = Join-Path $resolvedProject 'governance'
$commonPath = Join-Path $governanceRoot 'common-governance.md'
$projectRulesPath = Join-Path $governanceRoot 'project-rules.md'
$lockPath = Join-Path $governanceRoot 'governance.lock.toml'
$agentsPath = Join-Path $resolvedProject 'AGENTS.md'

foreach ($requiredPath in @($commonPath, $projectRulesPath, $lockPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required governance file is missing: $requiredPath"
    }
}

function Get-LockValue {
    param([string]$Name)
    $pattern = '^%s\s*=\s*"([^"]+)"\s*$' -replace '%s', [regex]::Escape($Name)
    $match = Select-String -LiteralPath $lockPath -Pattern $pattern | Select-Object -First 1
    if (-not $match) {
        throw "Missing lock value: $Name"
    }
    return $match.Matches[0].Groups[1].Value
}

$commonVersion = Get-LockValue -Name 'common_governance_version'
$lockedHash = Get-LockValue -Name 'common_governance_sha256'
$actualHash = (Get-FileHash -LiteralPath $commonPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $lockedHash.ToLowerInvariant()) {
    throw 'Managed common governance differs from governance.lock.toml. Run the approved skill sync instead of editing it directly.'
}

$common = [IO.File]::ReadAllText($commonPath).TrimEnd()
$newline = "`n"
$header = @(
    '# AGENTS.md',
    '',
    '<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. -->',
    "<!-- Common governance version: $commonVersion -->",
    "<!-- Common governance SHA-256: $actualHash -->",
    '<!-- Edit project-specific rules in governance/project-rules.md, then validate. -->',
    ''
) -join $newline
$projectRoute = @(
    '',
    '',
    '## Project-specific Rules',
    '',
    'Before any write, delegation, Git mutation, external action, implementation, or completion claim, read `governance/project-rules.md` and the task-routed authoritative documents it identifies. Project-specific rules may be stricter than the common contract but must not weaken or contradict it.',
    ''
) -join $newline
$expected = $header + $common + $projectRoute

if ($Check) {
    if (-not (Test-Path -LiteralPath $agentsPath -PathType Leaf)) {
        throw "Generated AGENTS.md is missing: $agentsPath"
    }
    $actual = [IO.File]::ReadAllText($agentsPath).Replace("`r`n", "`n")
    if ($actual -ne $expected) {
        throw 'AGENTS.md is stale or was edited directly. Run scripts/render-governance.ps1 after an approved managed update.'
    }
    [pscustomobject]@{
        project_path = $resolvedProject
        agents_path = $agentsPath
        common_governance_version = $commonVersion
        common_governance_sha256 = $actualHash
        generated_content_current = $true
    }
    return
}

[IO.File]::WriteAllText($agentsPath, $expected, [Text.UTF8Encoding]::new($false))
Write-Output "Generated $agentsPath"

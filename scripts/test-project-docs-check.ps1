$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("airguard-governance-" + [guid]::NewGuid().ToString('N'))
$checker = Join-Path $PSScriptRoot 'check-project-docs.ps1'

function Invoke-Checker([bool]$ShouldPass, [string]$CaseName) {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & $checker -RepositoryRoot $fixtureRoot 2>&1
    $passed = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $previousErrorAction
    if ($passed -ne $ShouldPass) {
        $output | ForEach-Object { Write-Output $_ }
        throw "Unexpected result for governance fixture '$CaseName': passed=$passed"
    }
    Write-Output "Governance fixture passed: $CaseName (expected success=$ShouldPass)"
}

try {
    New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
    foreach ($directory in @('docs', 'governance', '.codex', 'scripts')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $directory) -Destination (Join-Path $fixtureRoot $directory) -Recurse
    }
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -File -Filter '*.md') {
        Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $fixtureRoot $file.Name)
    }

    Invoke-Checker $true 'valid baseline'

    $documentationMapPath = Join-Path $fixtureRoot 'docs/README.md'
    $validDocumentationMap = Get-Content -LiteralPath $documentationMapPath -Raw -Encoding UTF8
    $capacityAliasPrefix = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('YOWuuemHj+ODgeOCp+ODg+OCr2AgLyA='))
    Set-Content -LiteralPath $documentationMapPath -Encoding UTF8 -Value ($validDocumentationMap.Replace($capacityAliasPrefix, ''))
    Invoke-Checker $false 'capacity routing alias is required'
    Set-Content -LiteralPath $documentationMapPath -Encoding UTF8 -Value $validDocumentationMap

    Set-Content -LiteralPath $documentationMapPath -Encoding UTF8 -Value ($validDocumentationMap.Replace('../governance/verification-policy.json', ''))
    Invoke-Checker $false 'verification policy route is required'
    Set-Content -LiteralPath $documentationMapPath -Encoding UTF8 -Value $validDocumentationMap

    $verificationPolicyPath = Join-Path $fixtureRoot 'governance/verification-policy.json'
    $validVerificationPolicy = Get-Content -LiteralPath $verificationPolicyPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $verificationPolicyPath -Encoding UTF8 -Value '{ invalid verification policy json'
    Invoke-Checker $false 'invalid verification policy JSON'
    Set-Content -LiteralPath $verificationPolicyPath -Encoding UTF8 -Value $validVerificationPolicy

    $operationsPath = Join-Path $fixtureRoot 'docs/operations.md'
    $validOperations = Get-Content -LiteralPath $operationsPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $operationsPath -Encoding UTF8 -Value ($validOperations.Replace('## Verification Matrix', '## Removed Verification Matrix'))
    Invoke-Checker $false 'verification matrix heading is required'
    Set-Content -LiteralPath $operationsPath -Encoding UTF8 -Value $validOperations

    $initialPromptPath = Join-Path $fixtureRoot 'INITIAL_PROMPT.md'
    $validInitialPrompt = Get-Content -LiteralPath $initialPromptPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $initialPromptPath -Encoding UTF8 -Value ($validInitialPrompt.Replace('governance/verification-policy.json', 'governance/missing-policy.json'))
    Invoke-Checker $false 'verification policy route is required in INITIAL_PROMPT'
    Set-Content -LiteralPath $initialPromptPath -Encoding UTF8 -Value $validInitialPrompt

    $nestedRepositoryPath = Join-Path $fixtureRoot 'vendor/nested-project'
    New-Item -ItemType Directory -Path (Join-Path $nestedRepositoryPath '.git') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $nestedRepositoryPath 'README.md') -Encoding UTF8 -Value @'
# Nested repository fixture

[Broken only inside nested repository](./missing-document.md)
'@
    Invoke-Checker $true 'broken Markdown link inside nested independent repository is pruned'
    Remove-Item -LiteralPath (Join-Path $fixtureRoot 'vendor') -Recurse -Force

    $configPath = Join-Path $fixtureRoot '.codex/config.toml'
    $validConfig = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $configPath -Encoding UTF8 -Value "[agents`nenabled = definitely-not-toml"
    Invoke-Checker $false 'invalid TOML'
    Set-Content -LiteralPath $configPath -Encoding UTF8 -Value $validConfig

    $manualIndexPath = Join-Path $fixtureRoot 'docs/manual/index.md'
    $validManualIndex = Get-Content -LiteralPath $manualIndexPath -Raw -Encoding UTF8
    $badAnchorIndex = [regex]::Replace($validManualIndex, '(\./control-operation\.md#)[^)]+', '${1}missing-heading-anchor', 1)
    Set-Content -LiteralPath $manualIndexPath -Encoding UTF8 -Value $badAnchorIndex
    Invoke-Checker $false 'missing Markdown heading anchor'
    Set-Content -LiteralPath $manualIndexPath -Encoding UTF8 -Value $validManualIndex

    Set-Content -LiteralPath $manualIndexPath -Encoding UTF8 -Value ($validManualIndex + "`n[Broken root project link](./missing-document.md)`n")
    Invoke-Checker $false 'broken Markdown link in root project is rejected'
    Set-Content -LiteralPath $manualIndexPath -Encoding UTF8 -Value $validManualIndex

    Set-Content -LiteralPath (Join-Path $fixtureRoot 'docs/unindexed-important-document.md') -Encoding UTF8 -Value "# Unindexed fixture"
    Invoke-Checker $false 'unindexed important document'
    Remove-Item -LiteralPath (Join-Path $fixtureRoot 'docs/unindexed-important-document.md') -Force

    $roadmapPath = Join-Path $fixtureRoot 'docs/roadmaps/airguard-v2.md'
    $validRoadmap = Get-Content -LiteralPath $roadmapPath -Raw -Encoding UTF8
    $invalidRoadmap = $validRoadmap.Replace('| 10 | 10 | Completed', '| 10 | 11 | Completed')
    Set-Content -LiteralPath $roadmapPath -Encoding UTF8 -Value $invalidRoadmap
    Invoke-Checker $false 'roadmap earned exceeds weight'
    Set-Content -LiteralPath $roadmapPath -Encoding UTF8 -Value $validRoadmap
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

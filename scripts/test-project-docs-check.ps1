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

function Add-StaleTableToIndexSection([string]$Content, [string]$Table) {
    $indexHeading = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('IyMg57Si5byV'))
    $sectionMatch = [regex]::Match(
        $Content,
        '(?ms)^' + [regex]::Escape($indexHeading) + '\s*\r?\n.*?(?=^##\s|\z)'
    )
    if (-not $sectionMatch.Success) {
        throw 'Index section was not found in fixture.'
    }
    return $Content.Insert($sectionMatch.Index + $sectionMatch.Length, "`n`n$Table`n")
}

try {
    New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
    foreach ($directory in @('docs', 'governance', '.codex', 'scripts')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $directory) -Destination (Join-Path $fixtureRoot $directory) -Recurse
    }
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -File -Filter '*.md') {
        Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $fixtureRoot $file.Name)
    }
    foreach ($relativeFile in @('.firebaserc', 'firebase.json', 'utils/customer/customerDocumentContract.js', 'test/local/codex-local-harness.test.mjs')) {
        $destination = Join-Path $fixtureRoot $relativeFile
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $sourceRoot $relativeFile) -Destination $destination
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

    $decisionIndexPath = Join-Path $fixtureRoot 'docs/decisions/README.md'
    $validDecisionIndex = Get-Content -LiteralPath $decisionIndexPath -Raw -Encoding UTF8
    $decisionLinkOnlyHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCBJRCB8IOWIpOaWrSB8'))
    $decisionMutableHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCBJRCB8IOWIpOaWrSB8IOeKtuaFiyB8'))
    Set-Content -LiteralPath $decisionIndexPath -Encoding UTF8 -Value ($validDecisionIndex.Replace($decisionLinkOnlyHeader, $decisionMutableHeader))
    Invoke-Checker $false 'ADR index rejects duplicated mutable status column'
    Set-Content -LiteralPath $decisionIndexPath -Encoding UTF8 -Value $validDecisionIndex
    $staleDecisionHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCDnirbmhYsgfCDml6Xku5ggfA=='))
    $staleDecisionTable = "$staleDecisionHeader`n|---|---|`n| Accepted | 2026-09-02 |"
    Set-Content -LiteralPath $decisionIndexPath -Encoding UTF8 -Value (Add-StaleTableToIndexSection -Content $validDecisionIndex -Table $staleDecisionTable)
    Invoke-Checker $false 'ADR index rejects a second stale status and date table'
    Set-Content -LiteralPath $decisionIndexPath -Encoding UTF8 -Value $validDecisionIndex

    $roadmapIndexPath = Join-Path $fixtureRoot 'docs/roadmaps/README.md'
    $validRoadmapIndex = Get-Content -LiteralPath $roadmapIndexPath -Raw -Encoding UTF8
    $roadmapLinkOnlyHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCDlr77osaEgfCDjg63jg7zjg4njg57jg4Pjg5cgfA=='))
    $roadmapMutableHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCDlr77osaEgfCDpgLLmjZcgfCDmnIDntYLnorroqo3ml6UgfCDjg63jg7zjg4njg57jg4Pjg5cgfA=='))
    Set-Content -LiteralPath $roadmapIndexPath -Encoding UTF8 -Value ($validRoadmapIndex.Replace($roadmapLinkOnlyHeader, $roadmapMutableHeader))
    Invoke-Checker $false 'roadmap index rejects duplicated mutable progress and date columns'
    Set-Content -LiteralPath $roadmapIndexPath -Encoding UTF8 -Value $validRoadmapIndex
    $staleRoadmapHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCDpgLLmjZcgfCDmnIDntYLnorroqo3ml6UgfA=='))
    $staleRoadmapTable = "$staleRoadmapHeader`n|---|---|`n| 100% | 2026-09-02 |"
    Set-Content -LiteralPath $roadmapIndexPath -Encoding UTF8 -Value (Add-StaleTableToIndexSection -Content $validRoadmapIndex -Table $staleRoadmapTable)
    Invoke-Checker $false 'roadmap index rejects a second stale progress and date table'
    Set-Content -LiteralPath $roadmapIndexPath -Encoding UTF8 -Value $validRoadmapIndex

    $handoffPath = Join-Path $fixtureRoot 'docs/implementation/current-coordinator-handoff.md'
    $validHandoff = Get-Content -LiteralPath $handoffPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $handoffPath -Encoding UTF8 -Value ($validHandoff + (('x' * 1024) * 17))
    Invoke-Checker $false 'current handoff rejects content over 16 KiB'
    Set-Content -LiteralPath $handoffPath -Encoding UTF8 -Value ($validHandoff + "`n## Current evidence contract`n`nLegacy completed evidence.`n")
    Invoke-Checker $false 'current handoff rejects legacy completed-history structure'
    Set-Content -LiteralPath $handoffPath -Encoding UTF8 -Value $validHandoff

    $verificationIndexPath = Join-Path $fixtureRoot 'docs/verification/README.md'
    $validVerificationIndex = Get-Content -LiteralPath $verificationIndexPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $verificationIndexPath -Encoding UTF8 -Value ($validVerificationIndex.Replace('(stripe-05-dev-release.md)', '(missing-stripe-05-dev-release.md)'))
    Invoke-Checker $false 'STRIPE receipt must remain indexed'
    Set-Content -LiteralPath $verificationIndexPath -Encoding UTF8 -Value $validVerificationIndex

    $stripeRoadmapPath = Join-Path $fixtureRoot 'docs/roadmaps/company-stripe-removal.md'
    $validStripeRoadmap = Get-Content -LiteralPath $stripeRoadmapPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $stripeRoadmapPath -Encoding UTF8 -Value ($validStripeRoadmap.Replace('../verification/stripe-05-dev-release.md', '../verification/governance-verification-benchmark.md'))
    Invoke-Checker $false 'STRIPE roadmap must link to immutable receipt'
    Set-Content -LiteralPath $stripeRoadmapPath -Encoding UTF8 -Value $validStripeRoadmap

    $dataMigrationRunbookPath = Join-Path $fixtureRoot 'docs/runbooks/data-migrations.md'
    $validDataMigrationRunbook = Get-Content -LiteralPath $dataMigrationRunbookPath -Raw -Encoding UTF8
    Set-Content -LiteralPath $dataMigrationRunbookPath -Encoding UTF8 -Value ($validDataMigrationRunbook + "`nSTRIPE-05-DEV-RELEASE-001`n")
    Invoke-Checker $false 'runbook rejects receipt-only execution identifier'
    Set-Content -LiteralPath $dataMigrationRunbookPath -Encoding UTF8 -Value $validDataMigrationRunbook

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

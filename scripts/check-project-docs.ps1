param(
    [string]$RepositoryRoot = (Join-Path $PSScriptRoot '..')
)

# Project-owned documentation/configuration validator.
# The managed governance validator is scripts/check-governance.ps1.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$errors = [System.Collections.Generic.List[string]]::new()

function Add-CheckError([string]$Message) {
    $errors.Add($Message)
}

function Test-LinkOnlyIndexSection {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$ExpectedHeader
    )

    $normalized = $Content.Replace("`r`n", "`n").Replace("`r", "`n")
    $indexHeading = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('IyMg57Si5byV'))
    $sectionMatch = [regex]::Match(
        $normalized,
        '(?ms)^' + [regex]::Escape($indexHeading) + '\s*\n(?<body>.*?)(?=^##\s|\z)'
    )
    if (-not $sectionMatch.Success) { return $false }

    $tableGroupCount = 0
    $inTable = $false
    $tableLines = [Collections.Generic.List[string]]::new()
    foreach ($line in ($sectionMatch.Groups['body'].Value -split "`n")) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('|')) {
            if (-not $inTable) { $tableGroupCount++ }
            $inTable = $true
            $tableLines.Add($trimmed)
        } else {
            $inTable = $false
        }
    }
    if ($tableGroupCount -ne 1 -or $tableLines.Count -lt 2) { return $false }
    if ($tableLines[0] -ne $ExpectedHeader) { return $false }
    foreach ($tableLine in $tableLines) {
        if (-not $tableLine.EndsWith('|')) { return $false }
        $cells = @($tableLine.Trim([char]'|') -split '\|')
        if ($cells.Count -ne 2) { return $false }
    }
    return $true
}

$requiredFiles = @(
    'AGENTS.md', 'README.md', 'CHANGELOG.md', 'INITIAL_PROMPT.md',
    'docs/README.md', 'docs/specification.md', 'docs/operations.md',
    'docs/decisions/README.md', 'docs/roadmaps/README.md',
    'docs/implementation/current-coordinator-handoff.md',
    'docs/verification/stripe-05-dev-release.md',
    'docs/runbooks/project-coordination.md', 'scripts/check-codex-session-size.ps1',
    'scripts/check-schemas-package-adoption.ps1',
    'governance/verification-policy.json',
    'docs/decisions/0040-impact-based-staged-verification.md',
    '.codex/config.toml', '.codex/agents/ui-tester.toml'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
        Add-CheckError "Missing required file: $relativePath"
    }
}

$capacityAliases = @(
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5a656YeP44OB44Kn44OD44Kv')),
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('44K/44K544Kv5a656YeP56K66KqN')),
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('44K744OD44K344On44Oz5a656YeP56K66KqN')),
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('c2Vzc2lvbiBzaXplIC8gaGFuZG9mZiB0aHJlc2hvbGTnorroqo0='))
)
$documentationMapPath = Join-Path $repoRoot 'docs/README.md'
$coordinationRunbookPath = Join-Path $repoRoot 'docs/runbooks/project-coordination.md'
$capacityScriptPath = Join-Path $repoRoot 'scripts/check-codex-session-size.ps1'
if (Test-Path -LiteralPath $documentationMapPath) {
    $documentationMapContent = Get-Content -LiteralPath $documentationMapPath -Raw -Encoding UTF8
    foreach ($alias in $capacityAliases) {
        if (-not $documentationMapContent.Contains($alias)) {
            Add-CheckError "Capacity routing alias is missing from docs/README.md: $alias"
        }
    }
    foreach ($requiredRoute in @('runbooks/project-coordination.md', 'scripts/check-codex-session-size.ps1')) {
        if (-not $documentationMapContent.Contains($requiredRoute)) {
            Add-CheckError "Capacity route is missing from docs/README.md: $requiredRoute"
        }
    }
}
if (Test-Path -LiteralPath $coordinationRunbookPath) {
    $coordinationContent = Get-Content -LiteralPath $coordinationRunbookPath -Raw -Encoding UTF8
    foreach ($alias in $capacityAliases) {
        if (-not $coordinationContent.Contains($alias)) {
            Add-CheckError "Capacity routing alias is missing from project coordination runbook: $alias"
        }
    }
    foreach ($requiredContract in @('<current-task-id>', '300 MiB', '10 GiB', 'codex_scan_complete', 'model')) {
        if (-not $coordinationContent.Contains($requiredContract)) {
            Add-CheckError "Capacity contract is missing from project coordination runbook: $requiredContract"
        }
    }
}
if (Test-Path -LiteralPath $capacityScriptPath) {
    $capacityScriptContent = Get-Content -LiteralPath $capacityScriptPath -Raw -Encoding UTF8
    foreach ($requiredScriptContract in @(
        'SessionId is required',
        'Expected exactly one session',
        'TotalThresholdBytes = 10GB',
        'usage_percent',
        "selection = 'session_id'"
    )) {
        if (-not $capacityScriptContent.Contains($requiredScriptContract)) {
            Add-CheckError "Capacity script contract is missing: $requiredScriptContract"
        }
    }
}

$criticalIdentifierScriptPath = Join-Path $repoRoot 'scripts/check-schemas-package-adoption.ps1'
if (Test-Path -LiteralPath $documentationMapPath) {
    foreach ($requiredCriticalRoute in @(
        'decisions/0039-evidence-bound-critical-identifiers.md',
        'scripts/check-schemas-package-adoption.ps1'
    )) {
        if (-not $documentationMapContent.Contains($requiredCriticalRoute)) {
            Add-CheckError "Critical identifier route is missing from docs/README.md: $requiredCriticalRoute"
        }
    }
}
if (Test-Path -LiteralPath $criticalIdentifierScriptPath) {
    $criticalIdentifierScript = Get-Content -Raw -LiteralPath $criticalIdentifierScriptPath -Encoding UTF8
    foreach ($requiredCriticalContract in @(
        "ValidateSet('PreAdoption', 'PostAdoption')",
        'Tag manifest conflicts with expected identity',
        'Release evidence commit differs from peeled tag commit',
        'Root and Functions integrity values disagree',
        'PostAdoption consumer integrity differs from release evidence',
        'network_verified = $false'
    )) {
        if (-not $criticalIdentifierScript.Contains($requiredCriticalContract)) {
            Add-CheckError "Schemas package preflight contract is missing: $requiredCriticalContract"
        }
    }
}

$verificationPolicyPath = Join-Path $repoRoot 'governance/verification-policy.json'
$operationsPath = Join-Path $repoRoot 'docs/operations.md'
$initialPromptPath = Join-Path $repoRoot 'INITIAL_PROMPT.md'
$verificationPolicy = $null
if (Test-Path -LiteralPath $verificationPolicyPath) {
    $verificationPolicyRaw = Get-Content -LiteralPath $verificationPolicyPath -Raw -Encoding UTF8
    if ($verificationPolicyRaw.Contains('REPLACE_')) {
        Add-CheckError 'Verification policy contains an unresolved REPLACE_ placeholder.'
    }
    try {
        $verificationPolicy = $verificationPolicyRaw | ConvertFrom-Json
    } catch {
        Add-CheckError "Verification policy JSON is invalid: $($_.Exception.Message)"
    }
}
if ($null -ne $verificationPolicy) {
    if ($verificationPolicy.schemaVersion -ne '1.0') {
        Add-CheckError 'Verification policy schemaVersion must be 1.0.'
    }
    $requiredVerificationClasses = @(
        'documentation-only',
        'project-guidance-metadata',
        'ui-css-layout',
        'application-logic',
        'data-contract-schema-migration',
        'governance-permissions-agents',
        'build-release-deploy'
    )
    $actualVerificationClasses = @($verificationPolicy.classes | ForEach-Object { [string]$_.id })
    foreach ($requiredClass in $requiredVerificationClasses) {
        if ($actualVerificationClasses -notcontains $requiredClass) {
            Add-CheckError "Verification policy class is missing: $requiredClass"
        }
    }

    $runtimeProfiles = @($verificationPolicy.runtimeProfiles | Where-Object { $null -ne $_ })
    $runtimeIds = @{}
    $hasRequiredWindowsRuntime = $false
    if ($runtimeProfiles.Count -eq 0) { Add-CheckError 'Verification policy runtimeProfiles must not be empty.' }
    foreach ($profile in $runtimeProfiles) {
        foreach ($field in @('id', 'platform', 'edition', 'executable', 'versionRule', 'supportStatus')) {
            if ($profile.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($profile.$field)) {
                Add-CheckError "Runtime profile field must be a nonempty string: $field"
            }
        }
        $profileId = [string]$profile.id
        if ($runtimeIds.ContainsKey($profileId)) { Add-CheckError "Duplicate runtime profile: $profileId" }
        $runtimeIds[$profileId] = $true
        if ($profile.required -isnot [bool]) { Add-CheckError "Runtime required must be boolean: $profileId" }
        if ($profile.required -is [bool] -and $profile.required -and
            $profile.platform -eq 'windows' -and $profile.edition -eq 'Desktop' -and
            $profile.executable -eq 'powershell' -and $profile.versionRule -eq 'major-minor=5.1' -and
            $profile.supportStatus -eq 'supported') { $hasRequiredWindowsRuntime = $true }
    }
    if (-not $hasRequiredWindowsRuntime) { Add-CheckError 'Required supported Windows PowerShell 5.1 runtime is missing.' }
    if (@($verificationPolicy.comprehensiveGateIds).Count -eq 0) {
        Add-CheckError 'Verification policy comprehensiveGateIds must not be empty.'
    }
    if (@($verificationPolicy.unknownImpactGateIds).Count -eq 0) {
        Add-CheckError 'Verification policy unknownImpactGateIds must not be empty.'
    }
}
if (Test-Path -LiteralPath $operationsPath) {
    $operationsContent = Get-Content -LiteralPath $operationsPath -Raw -Encoding UTF8
    foreach ($requiredVerificationOperationsContract in @(
        '## Verification Matrix',
        'governance/verification-policy.json',
        '<!-- BEGIN GENERATED VERIFICATION POLICY SUMMARY -->',
        '<!-- END GENERATED VERIFICATION POLICY SUMMARY -->',
        '### Gate Catalog and Inclusion',
        '### Evidence Validity'
    )) {
        if (-not $operationsContent.Contains($requiredVerificationOperationsContract)) {
            Add-CheckError "Verification operations contract is missing: $requiredVerificationOperationsContract"
        }
    }
}
if (Test-Path -LiteralPath $documentationMapPath) {
    foreach ($requiredVerificationRoute in @(
        '../governance/verification-policy.json',
        'operations.md#verification-matrix',
        'decisions/0040-impact-based-staged-verification.md',
        'verification/README.md'
    )) {
        if (-not $documentationMapContent.Contains($requiredVerificationRoute)) {
            Add-CheckError "Verification route is missing from docs/README.md: $requiredVerificationRoute"
        }
    }
}
if (Test-Path -LiteralPath $initialPromptPath) {
    $initialPromptContent = Get-Content -LiteralPath $initialPromptPath -Raw -Encoding UTF8
    foreach ($requiredPromptContract in @(
        'AGENTS.md',
        'governance/project-rules.md',
        'docs/README.md',
        'docs/operations.md#verification-matrix'
    )) {
        if (-not $initialPromptContent.Contains($requiredPromptContract)) {
            Add-CheckError "Repository startup route is missing from INITIAL_PROMPT.md: $requiredPromptContract"
        }
    }
}

function Get-ProjectMarkdownFiles([string]$RootPath) {
    $excludedDirectoryNames = @(
        'node_modules', '.agents', '.codex', '.nuxt', '.output', 'dist',
        '.git', '.governance-backup'
    )
    $pendingDirectories = [System.Collections.Generic.Stack[string]]::new()
    $pendingDirectories.Push($RootPath)

    while ($pendingDirectories.Count -gt 0) {
        $currentDirectory = $pendingDirectories.Pop()

        Get-ChildItem -LiteralPath $currentDirectory -File -Filter '*.md'

        foreach ($directory in Get-ChildItem -LiteralPath $currentDirectory -Directory) {
            if ($excludedDirectoryNames -contains $directory.Name) { continue }
            if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }

            # A child directory with its own Git marker is an independent repository.
            # Check children only so the project root's own .git does not prune the project.
            if (Test-Path -LiteralPath (Join-Path $directory.FullName '.git')) { continue }

            $pendingDirectories.Push($directory.FullName)
        }
    }
}

$markdownFiles = @(Get-ProjectMarkdownFiles -RootPath $repoRoot)
$linkPattern = [regex]'\[[^\]]+\]\((?<target>[^)]+)\)'
$linkGraph = @{}

function Get-MarkdownAnchorSet([string]$FilePath) {
    $anchors = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $headingCounts = @{}
    foreach ($line in Get-Content -LiteralPath $FilePath -Encoding UTF8) {
        if ($line -notmatch '^#{1,6}\s+(?<heading>.+?)\s*#*\s*$') { continue }
        $heading = $Matches['heading'] -replace '<[^>]+>', '' -replace '[`*_~]', ''
        $slug = $heading.ToLowerInvariant() -replace '\s+', '-' -replace '[^\p{L}\p{Nd}_-]', '' -replace '-+', '-'
        $slug = $slug.Trim('-')
        if ([string]::IsNullOrWhiteSpace($slug)) { continue }
        if ($headingCounts.ContainsKey($slug)) {
            $headingCounts[$slug]++
            $slug = "$slug-$($headingCounts[$slug])"
        } else {
            $headingCounts[$slug] = 0
        }
        [void]$anchors.Add($slug)
    }
    return $anchors
}

foreach ($file in $markdownFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $sourceRelative = $file.FullName.Substring($repoRoot.Length + 1).Replace('\', '/')
    $linkGraph[$sourceRelative] = [System.Collections.Generic.List[string]]::new()
    foreach ($match in $linkPattern.Matches($content)) {
        $target = $match.Groups['target'].Value.Trim().Trim('<', '>')
        if ($target -match '^(https?://|mailto:|#)') { continue }
        if ($target -match '[`"'']') { continue }
        $targetParts = $target -split '#', 2
        $pathPart = $targetParts[0]
        $anchorPart = if ($targetParts.Count -eq 2) { [uri]::UnescapeDataString($targetParts[1]).ToLowerInvariant() } else { $null }
        if ([string]::IsNullOrWhiteSpace($pathPart)) { continue }
        $decodedPath = [uri]::UnescapeDataString($pathPart)
        $resolvedTarget = Join-Path $file.DirectoryName $decodedPath
        if (-not (Test-Path -LiteralPath $resolvedTarget)) {
            Add-CheckError "Broken link in $($file.FullName.Substring($repoRoot.Length + 1)): $target"
            continue
        }
        $targetItem = Get-Item -LiteralPath $resolvedTarget
        if ($targetItem.PSIsContainer) {
            $resolvedTarget = Join-Path $targetItem.FullName 'README.md'
            if (-not (Test-Path -LiteralPath $resolvedTarget)) { continue }
        }
        if ([IO.Path]::GetExtension($resolvedTarget) -ieq '.md') {
            $targetRelative = (Resolve-Path -LiteralPath $resolvedTarget).Path.Substring($repoRoot.Length + 1).Replace('\', '/')
            $linkGraph[$sourceRelative].Add($targetRelative)
            if ($anchorPart) {
                $anchors = Get-MarkdownAnchorSet $resolvedTarget
                if (-not $anchors.Contains($anchorPart)) {
                    Add-CheckError "Missing heading anchor in ${sourceRelative}: $target"
                }
            }
        }
    }
}

$reachable = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$queue = [System.Collections.Generic.Queue[string]]::new()
$queue.Enqueue('docs/README.md')
while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    if (-not $reachable.Add($current)) { continue }
    if (-not $linkGraph.ContainsKey($current)) { continue }
    foreach ($next in $linkGraph[$current]) {
        if (-not $reachable.Contains($next)) { $queue.Enqueue($next) }
    }
}
foreach ($importantFile in $markdownFiles | Where-Object { $_.FullName.StartsWith((Join-Path $repoRoot 'docs') + '\') }) {
    $importantRelative = $importantFile.FullName.Substring($repoRoot.Length + 1).Replace('\', '/')
    if (-not $reachable.Contains($importantRelative)) {
        Add-CheckError "Important documentation is not reachable from docs/README.md: $importantRelative"
    }
}

$decisionIndexPath = Join-Path $repoRoot 'docs/decisions/README.md'
$decisionIndex = Get-Content -LiteralPath $decisionIndexPath -Raw -Encoding UTF8
$decisionLinkOnlyHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCBJRCB8IOWIpOaWrSB8'))
if (-not (Test-LinkOnlyIndexSection -Content $decisionIndex -ExpectedHeader $decisionLinkOnlyHeader)) {
    Add-CheckError 'ADR index section must contain exactly one two-column link-only table.'
}
$decisionFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'docs/decisions') -File -Filter '*.md' |
    Where-Object { $_.Name -match '^\d{4}-.+\.md$' })
foreach ($decisionFile in $decisionFiles) {
    $body = Get-Content -LiteralPath $decisionFile.FullName -Raw -Encoding UTF8
    $statusMatch = [regex]::Match($body, '(?m)^- [^:\r\n]+: (?<status>Accepted|Proposed|Rejected|Superseded)\r?$')
    if (-not $statusMatch.Success) {
        Add-CheckError "ADR status missing or invalid: $($decisionFile.Name)"
        continue
    }
    $id = $decisionFile.BaseName.Substring(0, 4)
    $escapedFileName = [regex]::Escape($decisionFile.Name)
    $indexMatch = [regex]::Match($decisionIndex, "(?m)^\|\s*\[$id\]\($escapedFileName\)\s*\|\s*[^|]+\s*\|\s*$")
    if (-not $indexMatch.Success) {
        Add-CheckError "ADR is missing from index: $($decisionFile.Name)"
    }
}

$roadmapIndex = Get-Content -LiteralPath (Join-Path $repoRoot 'docs/roadmaps/README.md') -Raw -Encoding UTF8
$roadmapLinkOnlyHeader = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('fCDlr77osaEgfCDjg63jg7zjg4njg57jg4Pjg5cgfA=='))
if (-not (Test-LinkOnlyIndexSection -Content $roadmapIndex -ExpectedHeader $roadmapLinkOnlyHeader)) {
    Add-CheckError 'Roadmap index section must contain exactly one two-column link-only table.'
}
$roadmapFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'docs/roadmaps') -File -Filter '*.md' |
    Where-Object { $_.Name -ne 'README.md' })
foreach ($roadmapFile in $roadmapFiles) {
    $body = Get-Content -LiteralPath $roadmapFile.FullName -Raw -Encoding UTF8
    $progressMatch = [regex]::Match($body, '(?m)^- [^:\r\n]+: (?<progress>\d+)%\r?$')
    if (-not $progressMatch.Success) {
        Add-CheckError "Roadmap progress missing: $($roadmapFile.Name)"
        continue
    }
    $rows = [regex]::Matches($body, '(?m)^\| (?!\*\*)(?<name>[^|]+) \| (?<weight>\d+) \| (?<earned>\d+) \| (?<status>[^|]+) \|')
    $weight = 0
    $earned = 0
    foreach ($row in $rows) {
        $rowWeight = [int]$row.Groups['weight'].Value
        $rowEarned = [int]$row.Groups['earned'].Value
        $rowStatus = $row.Groups['status'].Value.Trim()
        $weight += $rowWeight
        $earned += $rowEarned
        if ($rowEarned -gt $rowWeight) { Add-CheckError "Roadmap earned exceeds weight in $($roadmapFile.Name): $($row.Groups['name'].Value.Trim())" }
        if ($rowStatus -like 'Completed*' -and $rowEarned -ne $rowWeight) { Add-CheckError "Completed roadmap milestone must earn full weight in $($roadmapFile.Name): $($row.Groups['name'].Value.Trim())" }
        if ($rowStatus -notlike 'Completed*' -and $rowEarned -ne 0) { Add-CheckError "Incomplete roadmap milestone must earn zero in $($roadmapFile.Name): $($row.Groups['name'].Value.Trim())" }
    }
    if ($weight -ne 100) { Add-CheckError "Roadmap weights do not total 100 in $($roadmapFile.Name): $weight" }
    if ($earned -ne [int]$progressMatch.Groups['progress'].Value) { Add-CheckError "Roadmap earned points do not match progress in $($roadmapFile.Name): earned=$earned" }
    $escapedName = [regex]::Escape($roadmapFile.Name)
    $indexMatch = [regex]::Match($roadmapIndex, "(?m)^\|\s*[^|]+\s*\|\s*\[[^\]]+\]\($escapedName\)\s*\|\s*$")
    if (-not $indexMatch.Success) {
        Add-CheckError "Roadmap is missing from index: $($roadmapFile.Name)"
    }
}

$currentHandoffPath = Join-Path $repoRoot 'docs/implementation/current-coordinator-handoff.md'
if (Test-Path -LiteralPath $currentHandoffPath) {
    $currentHandoffBytes = (Get-Item -LiteralPath $currentHandoffPath).Length
    if ($currentHandoffBytes -gt 16384) {
        Add-CheckError "Current coordinator handoff exceeds 16 KiB: $currentHandoffBytes bytes"
    }
    $currentHandoff = Get-Content -LiteralPath $currentHandoffPath -Raw -Encoding UTF8
    foreach ($requiredProductRoute in @('../roadmaps/customer-status.md', 'pending-confirmations.md')) {
        if (-not $currentHandoff.Contains($requiredProductRoute)) {
            Add-CheckError "Product restart route is missing: $requiredProductRoute"
        }
    }
    if ($currentHandoff.Contains('## Current evidence contract')) {
        Add-CheckError 'Current product restart guide must not accumulate completed execution evidence.'
    }
}

$stripeReceiptRelative = 'docs/verification/stripe-05-dev-release.md'
$stripeReceiptPath = Join-Path $repoRoot $stripeReceiptRelative
if (Test-Path -LiteralPath $stripeReceiptPath) {
    $stripeReceipt = Get-Content -LiteralPath $stripeReceiptPath -Raw -Encoding UTF8
    if (-not $stripeReceipt.Contains('Verified / immutable execution evidence')) {
        Add-CheckError 'STRIPE receipt must be marked as immutable execution evidence.'
    }
    $verificationIndexPath = Join-Path $repoRoot 'docs/verification/README.md'
    $verificationIndex = if (Test-Path -LiteralPath $verificationIndexPath) { Get-Content -LiteralPath $verificationIndexPath -Raw -Encoding UTF8 } else { '' }
    if ($verificationIndex -notmatch '\]\(stripe-05-dev-release\.md(?:#[^)]+)?\)') {
        Add-CheckError 'STRIPE receipt is missing from docs/verification/README.md.'
    }
    $stripeRoadmapPath = Join-Path $repoRoot 'docs/roadmaps/company-stripe-removal.md'
    $stripeRoadmap = if (Test-Path -LiteralPath $stripeRoadmapPath) { Get-Content -LiteralPath $stripeRoadmapPath -Raw -Encoding UTF8 } else { '' }
    if ($stripeRoadmap -notmatch '\]\(\.\./verification/stripe-05-dev-release\.md(?:#[^)]+)?\)') {
        Add-CheckError 'STRIPE roadmap must link to the immutable STRIPE receipt.'
    }

    $receiptOnlyTokens = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($match in [regex]::Matches($stripeReceipt, '(?i)\b(?:[0-9a-f]{64}|[0-9a-f]{40})\b')) {
        [void]$receiptOnlyTokens.Add($match.Value)
    }
    foreach ($match in [regex]::Matches($stripeReceipt, '\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){3,}\b')) {
        [void]$receiptOnlyTokens.Add($match.Value)
    }
    $runbookDirectory = Join-Path $repoRoot 'docs/runbooks'
    foreach ($runbook in Get-ChildItem -LiteralPath $runbookDirectory -File -Filter '*.md') {
        $runbookContent = Get-Content -LiteralPath $runbook.FullName -Raw -Encoding UTF8
        foreach ($token in $receiptOnlyTokens) {
            if ($runbookContent.Contains($token)) {
                Add-CheckError "Runbook duplicates a STRIPE receipt-only execution identifier or hash: $($runbook.Name): $token"
            }
        }
    }
}

$uiTesterAgentPath = Join-Path $repoRoot '.codex/agents/ui-tester.toml'
if (Test-Path -LiteralPath $uiTesterAgentPath) {
    $uiTesterAgentContent = Get-Content -LiteralPath $uiTesterAgentPath -Raw -Encoding UTF8
    $localPolicyLine = @($uiTesterAgentContent -split "`r?`n" | Where-Object {
        $_.Contains('UI_SCOPE_POLICY=codex-dedicated-local-only:')
    }) | Select-Object -First 1
    if (-not $localPolicyLine) {
        Add-CheckError 'UI tester local-only scope policy marker is missing.'
    } else {
        foreach ($requiredLocalBoundary in @('demo-project', 'loopback', 'synthetic-data', 'in-app-browser')) {
            if (-not $localPolicyLine.Contains($requiredLocalBoundary)) {
                Add-CheckError "UI tester local-only allowlist is missing: $requiredLocalBoundary"
            }
        }
    }

    $externalPolicyLine = @($uiTesterAgentContent -split "`r?`n" | Where-Object {
        $_.Contains('EXTERNAL_UI_POLICY=')
    }) | Select-Object -First 1
    if (-not $externalPolicyLine -or
        -not $externalPolicyLine.Contains('EXTERNAL_UI_POLICY=coordinator-only,subagent-deny:')) {
        Add-CheckError 'UI tester must keep external UI coordinator-only and deny subagent operations.'
    } else {
        foreach ($requiredExternalBoundary in @(
            'user-chrome', 'user-profile', 'user-session', 'desktop-app', 'dev-ui',
            'prod-ui', 'remote-ui', 'external-account', 'external-session', 'external-state'
        )) {
            if (-not $externalPolicyLine.Contains($requiredExternalBoundary)) {
                Add-CheckError "UI tester external-operation deny boundary is missing: $requiredExternalBoundary"
            }
        }
    }
    if (-not $uiTesterAgentContent.Contains('EXTERNAL_UI_RETURN=approval-boundary-to-coordinator')) {
        Add-CheckError 'UI tester must return external UI work to the coordinator as an approval-boundary.'
    }
}

$tomlFiles = @((Join-Path $repoRoot '.codex/config.toml')) +
    @(Get-ChildItem -LiteralPath (Join-Path $repoRoot '.codex/agents') -File -Filter '*.toml' | Select-Object -ExpandProperty FullName)
$tomlValidator = Join-Path $PSScriptRoot 'check-toml.mjs'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    Add-CheckError 'Node.js was not found; TOML validation cannot run.'
} else {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $tomlOutput = & $nodeExecutable $tomlValidator @tomlFiles 2>&1
    $tomlExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    $tomlOutput | ForEach-Object { Write-Output $_ }
    if ($tomlExitCode -ne 0) {
        Add-CheckError 'TOML parser validation failed.'
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Output "ERROR: $_" }
    exit 1
}

Write-Output "Governance validation passed: $($markdownFiles.Count) Markdown files, $($decisionFiles.Count) ADRs, $($roadmapFiles.Count) roadmaps, $($tomlFiles.Count) TOML files."

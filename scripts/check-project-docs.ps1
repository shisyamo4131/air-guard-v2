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

$requiredFiles = @(
    'AGENTS.md', 'README.md', 'CHANGELOG.md', 'INITIAL_PROMPT.md',
    'docs/README.md', 'docs/specification.md', 'docs/operations.md',
    'docs/decisions/README.md', 'docs/roadmaps/README.md',
    '.codex/config.toml'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath))) {
        Add-CheckError "Missing required file: $relativePath"
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
    $indexMatch = [regex]::Match($decisionIndex, "(?m)^\| \[$id\]\([^\)]+\) \|.*\| (?<status>Accepted|Proposed|Rejected|Superseded) \|")
    if (-not $indexMatch.Success) {
        Add-CheckError "ADR is missing from index: $($decisionFile.Name)"
    } elseif ($indexMatch.Groups['status'].Value -ne $statusMatch.Groups['status'].Value) {
        Add-CheckError "ADR status mismatch for ${id}: body=$($statusMatch.Groups['status'].Value), index=$($indexMatch.Groups['status'].Value)"
    }
}

$roadmapIndex = Get-Content -LiteralPath (Join-Path $repoRoot 'docs/roadmaps/README.md') -Raw -Encoding UTF8
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
    $indexMatch = [regex]::Match($roadmapIndex, "(?m)^\| .* \| (?<progress>\d+)% \| .* \| \[[^\]]+\]\($escapedName\) \|")
    if (-not $indexMatch.Success) {
        Add-CheckError "Roadmap is missing from index: $($roadmapFile.Name)"
    } elseif ([int]$indexMatch.Groups['progress'].Value -ne [int]$progressMatch.Groups['progress'].Value) {
        Add-CheckError "Roadmap index progress mismatch: $($roadmapFile.Name)"
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

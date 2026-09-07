[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SchemasRepository,
    [Parameter(Mandatory = $true)][string]$ConsumerRepository,
    [Parameter(Mandatory = $true)][string]$ExpectedPackageName,
    [Parameter(Mandatory = $true)][string]$TargetVersion,
    [Parameter(Mandatory = $true)][string]$ReleaseEvidencePath,
    [Parameter(Mandatory = $true)][ValidateSet('PreAdoption', 'PostAdoption')][string]$Mode
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions

function Invoke-GitText {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $output = @(& git -c "safe.directory=$Repository" -C $Repository @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed in ${Repository}: $($output -join [Environment]::NewLine)"
    }
    return ($output -join "`n").Trim()
}

function Convert-JsonDictionary {
    param([Parameter(Mandatory = $true)][string]$Text)
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength = [int]::MaxValue
    return $serializer.DeserializeObject($Text)
}

function Read-JsonDictionary {
    param([Parameter(Mandatory = $true)][string]$Path)
    return Convert-JsonDictionary -Text (Get-Content -Raw -LiteralPath $Path -Encoding UTF8)
}

function Get-ConsumerState {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$PackageName
    )

    $rootManifest = Read-JsonDictionary (Join-Path $Root 'package.json')
    $functionsManifest = Read-JsonDictionary (Join-Path $Root 'functions\package.json')
    $rootLock = Read-JsonDictionary (Join-Path $Root 'package-lock.json')
    $functionsLock = Read-JsonDictionary (Join-Path $Root 'functions\package-lock.json')

    $rootLockPackage = $rootLock['packages']["node_modules/$PackageName"]
    $functionsLockPackage = $functionsLock['packages']["node_modules/$PackageName"]
    if ($null -eq $rootLockPackage -or $null -eq $functionsLockPackage) {
        throw "Consumer lock entry is missing for package: $PackageName"
    }

    $values = [ordered]@{
        root_manifest = $rootManifest['dependencies'][$PackageName]
        functions_manifest = $functionsManifest['dependencies'][$PackageName]
        root_lock_manifest = $rootLock['packages']['']['dependencies'][$PackageName]
        functions_lock_manifest = $functionsLock['packages']['']['dependencies'][$PackageName]
        root_lock_version = $rootLockPackage['version']
        functions_lock_version = $functionsLockPackage['version']
    }
    foreach ($entry in $values.GetEnumerator()) {
        if ([string]::IsNullOrWhiteSpace([string]$entry.Value)) {
            throw "Consumer package value is missing: $($entry.Key)"
        }
    }

    $versions = @($values.Values | Select-Object -Unique)
    if ($versions.Count -ne 1) {
        throw "Root/Functions manifest and lock versions disagree: $($values | ConvertTo-Json -Compress)"
    }
    if ($rootLockPackage['resolved'] -ne $functionsLockPackage['resolved']) {
        throw 'Root and Functions resolved tarballs disagree.'
    }
    if ($rootLockPackage['integrity'] -ne $functionsLockPackage['integrity']) {
        throw 'Root and Functions integrity values disagree.'
    }

    return [pscustomobject]@{
        version = [string]$versions[0]
        resolved = [string]$rootLockPackage['resolved']
        integrity = [string]$rootLockPackage['integrity']
    }
}

$schemasRoot = (Resolve-Path -LiteralPath $SchemasRepository).Path.TrimEnd('\')
$consumerRoot = (Resolve-Path -LiteralPath $ConsumerRepository).Path.TrimEnd('\')
$evidencePath = (Resolve-Path -LiteralPath $ReleaseEvidencePath).Path

$actualSchemasRoot = (Invoke-GitText -Repository $schemasRoot -Arguments @('rev-parse', '--show-toplevel')).Replace('/', '\')
if ([IO.Path]::GetFullPath($actualSchemasRoot).TrimEnd('\') -ne [IO.Path]::GetFullPath($schemasRoot).TrimEnd('\')) {
    throw "SchemasRepository is not the Git top-level: $schemasRoot"
}
$actualConsumerRoot = (Invoke-GitText -Repository $consumerRoot -Arguments @('rev-parse', '--show-toplevel')).Replace('/', '\')
if ([IO.Path]::GetFullPath($actualConsumerRoot).TrimEnd('\') -ne [IO.Path]::GetFullPath($consumerRoot).TrimEnd('\')) {
    throw "ConsumerRepository is not the Git top-level: $consumerRoot"
}
if (-not $evidencePath.StartsWith($schemasRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Release evidence must be inside the Schemas repository.'
}

$sourceManifest = Read-JsonDictionary (Join-Path $schemasRoot 'package.json')
if ($sourceManifest['name'] -ne $ExpectedPackageName) {
    throw "Expected package name conflicts with Schemas package.json: expected=$ExpectedPackageName actual=$($sourceManifest['name'])"
}

$tagName = "v$TargetVersion"
$tagCommit = Invoke-GitText -Repository $schemasRoot -Arguments @('rev-parse', "$tagName^{}")
$tagManifestText = Invoke-GitText -Repository $schemasRoot -Arguments @('show', "${tagName}:package.json")
$tagManifest = Convert-JsonDictionary -Text $tagManifestText
if ($tagManifest['name'] -ne $ExpectedPackageName -or $tagManifest['version'] -ne $TargetVersion) {
    throw "Tag manifest conflicts with expected identity: tag=$tagName name=$($tagManifest['name']) version=$($tagManifest['version'])"
}

$evidence = Get-Content -Raw -LiteralPath $evidencePath -Encoding UTF8
$expectedPackageLine = "- Package: ``$ExpectedPackageName@$TargetVersion``"
if (-not $evidence.Contains($expectedPackageLine)) {
    throw "Release evidence does not contain exact package identity: $expectedPackageLine"
}
$commitMatch = [regex]::Match($evidence, '(?m)^- Commit: `(?<value>[0-9a-f]{40})`\r?$')
$tagMatch = [regex]::Match($evidence, '(?m)^- Annotated tag: `(?<value>[^`]+)`\r?$')
$integrityMatch = [regex]::Match($evidence, '(?m)^- integrity: `(?<value>sha512-[^`]+)`\r?$')
if (-not $commitMatch.Success -or -not $tagMatch.Success -or -not $integrityMatch.Success) {
    throw 'Release evidence is missing commit, annotated tag, or integrity metadata.'
}
if ($commitMatch.Groups['value'].Value -ne $tagCommit) {
    throw "Release evidence commit differs from peeled tag commit: evidence=$($commitMatch.Groups['value'].Value) tag=$tagCommit"
}
if ($tagMatch.Groups['value'].Value -ne $tagName) {
    throw "Release evidence tag differs from expected tag: evidence=$($tagMatch.Groups['value'].Value) expected=$tagName"
}

$consumer = Get-ConsumerState -Root $consumerRoot -PackageName $ExpectedPackageName
$targetIntegrity = $integrityMatch.Groups['value'].Value
$packageBasename = ($ExpectedPackageName -split '/')[-1]
$expectedTarballSuffix = "/$packageBasename-$($consumer.version).tgz"
if (-not $consumer.resolved.EndsWith($expectedTarballSuffix, [StringComparison]::Ordinal)) {
    throw "Consumer resolved tarball does not match its version: $($consumer.resolved)"
}

$adoptionState = if ($consumer.version -eq $TargetVersion) { 'adopted' } else { 'pending' }
if ($Mode -eq 'PostAdoption') {
    if ($consumer.version -ne $TargetVersion) {
        throw "PostAdoption requires target version in both consumers: current=$($consumer.version) target=$TargetVersion"
    }
    if ($consumer.integrity -ne $targetIntegrity) {
        throw 'PostAdoption consumer integrity differs from release evidence.'
    }
} elseif ($consumer.version -eq $TargetVersion -and $consumer.integrity -ne $targetIntegrity) {
    throw 'PreAdoption found target version with integrity that differs from release evidence.'
}

[pscustomobject]@{
    mode = $Mode
    package_name = $ExpectedPackageName
    target_version = $TargetVersion
    tag = $tagName
    tag_commit = $tagCommit
    release_evidence = $evidencePath
    release_integrity = $targetIntegrity
    consumer_version = $consumer.version
    consumer_resolved = $consumer.resolved
    consumer_integrity = $consumer.integrity
    adoption_state = $adoptionState
    source_git_status = Invoke-GitText -Repository $schemasRoot -Arguments @('status', '--porcelain=v1')
    consumer_git_status = Invoke-GitText -Repository $consumerRoot -Arguments @('status', '--porcelain=v1')
    network_verified = $false
    valid = $true
}

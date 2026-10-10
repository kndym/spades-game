$ErrorActionPreference = 'Stop'
$benchmarkDirectory = $PSScriptRoot
$benchmarkVendor = Join-Path $benchmarkDirectory 'external-vendor/TricksterBots'
$benchmarkCommit = '3abca057bff801eca00d2d20839c3407db96ebb2'
if (-not (Test-Path -LiteralPath $benchmarkVendor)) {
    git clone --recurse-submodules https://github.com/TricksterCards/TricksterBots.git $benchmarkVendor
    if ($LASTEXITCODE -ne 0) { throw 'Trickster clone failed' }
}
git -C $benchmarkVendor fetch origin $benchmarkCommit
if ($LASTEXITCODE -ne 0) { throw 'Pinned commit fetch failed' }
$benchmarkDirty = git -C $benchmarkVendor status --porcelain
if ($benchmarkDirty) { throw 'Refusing to change a modified vendor checkout' }
git -C $benchmarkVendor checkout --detach $benchmarkCommit
if ($LASTEXITCODE -ne 0) { throw 'Pinned Trickster checkout failed' }
git -C $benchmarkVendor submodule update --init --recursive
if ($LASTEXITCODE -ne 0) { throw 'Pinned submodule update failed' }
dotnet build -c Release (Join-Path $benchmarkDirectory 'external-runner')
if ($LASTEXITCODE -ne 0) { throw 'External runner build failed' }
$benchmarkSearchVendor = Join-Path $benchmarkDirectory 'external-vendor/ISMCTS-Spades'
$benchmarkSearchCommit = '8b924def0fde39fdde23b85b4d4ace7ca0ca20fe'
if (-not (Test-Path -LiteralPath $benchmarkSearchVendor)) {
    git clone https://github.com/jdfreden/Spades.git $benchmarkSearchVendor
    if ($LASTEXITCODE -ne 0) { throw 'ISMCTS clone failed' }
}
git -C $benchmarkSearchVendor fetch origin $benchmarkSearchCommit
if ($LASTEXITCODE -ne 0) { throw 'ISMCTS pinned commit fetch failed' }
git -C $benchmarkSearchVendor diff --quiet
if ($LASTEXITCODE -ne 0) { throw 'Refusing to modify a dirty ISMCTS vendor checkout' }
git -C $benchmarkSearchVendor diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'Refusing to modify a staged ISMCTS vendor checkout' }
git -C $benchmarkSearchVendor checkout --detach $benchmarkSearchCommit
if ($LASTEXITCODE -ne 0) { throw 'ISMCTS pinned checkout failed' }

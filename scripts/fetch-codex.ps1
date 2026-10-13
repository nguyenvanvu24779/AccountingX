<#
  Downloads the pinned Codex CLI for Windows x64 into src-tauri\resources\codex.
  Usage:  powershell -ExecutionPolicy Bypass -File scripts\fetch-codex.ps1
          (optional) -Version rust-v0.161.0
#>
param([string]$Version = "rust-v0.161.0")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "src-tauri\resources\codex"
$tmp  = Join-Path $env:TEMP "accountingx-codex-$Version"
New-Item -ItemType Directory -Force $dest, $tmp | Out-Null

$base = "https://github.com/openai/codex/releases/download/$Version"
# main binary + Windows sandbox helpers that Codex expects next to it
$files = @(
  @{ asset = "codex-x86_64-pc-windows-msvc.exe.zip";                 target = "codex.exe" },
  @{ asset = "codex-command-runner-x86_64-pc-windows-msvc.exe.zip";  target = "codex-command-runner.exe" },
  @{ asset = "codex-windows-sandbox-setup-x86_64-pc-windows-msvc.exe.zip"; target = "codex-windows-sandbox-setup.exe" },
  # Companion host for [features] code_mode_host / browser_use (code-mode sandbox + browser automation).
  @{ asset = "codex-code-mode-host-x86_64-pc-windows-msvc.exe.zip";  target = "codex-code-mode-host.exe" }
)

foreach ($f in $files) {
  $zip = Join-Path $tmp $f.asset
  Write-Host "Downloading $($f.asset) ..."
  Invoke-WebRequest "$base/$($f.asset)" -OutFile $zip
  $out = Join-Path $tmp ([IO.Path]::GetFileNameWithoutExtension($f.asset))
  if (Test-Path $out) { Remove-Item -Recurse -Force $out }
  Expand-Archive $zip -DestinationPath $out -Force
  $all = Get-ChildItem $out -Recurse -Filter *.exe | Sort-Object Length -Descending
  Write-Host ("  contains: " + (($all | ForEach-Object { "$($_.Name) ($([math]::Round($_.Length/1MB,1)) MB)" }) -join ", "))
  # The archive may hold helper executables too; the real CLI is the largest one.
  $exe = $all | Select-Object -First 1
  if (-not $exe) { throw "No .exe found inside $($f.asset)" }
  Copy-Item $exe.FullName (Join-Path $dest $f.target) -Force
}

Set-Content (Join-Path $dest "VERSION.txt") $Version
Write-Host "`nDone. Installed into $dest"
& (Join-Path $dest "codex.exe") --version

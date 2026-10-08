<#
  Checks that the bundled Codex works end to end, without the UI, and writes
  diag-report.txt in the repo root (git-ignored). Never copies auth.json.
  Usage: powershell -ExecutionPolicy Bypass -File scripts\diag.ps1
#>
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$report = Join-Path $root "diag-report.txt"
$codex = Join-Path $root "src-tauri\resources\codex\codex.exe"
$home_ = Join-Path $env:USERPROFILE ".accountingx\codex"
$env:CODEX_HOME = $home_
"AccountingX diag  $(Get-Date -Format s)" | Set-Content $report

function Section($t) { Add-Content $report "`n=== $t ===" }

Section "codex home contents (names and sizes only)"
if (Test-Path $home_) { Get-ChildItem $home_ -Force | Select-Object Name,Length | Format-Table | Out-String | Add-Content $report } else { Add-Content $report "MISSING: $home_" }

Section "config.toml"
$cfg = Join-Path $home_ "config.toml"
if (Test-Path $cfg) { Get-Content $cfg | Add-Content $report } else { Add-Content $report "MISSING" }

Section "auth present"
Add-Content $report ("auth.json exists: " + (Test-Path (Join-Path $home_ "auth.json")))

Section "codex login status"
& $codex login status 2>&1 | Out-String | Add-Content $report

Section "codex exec (real chat test, 90s timeout)"
$out = Join-Path $env:TEMP "accountingx-exec.txt"
$err = Join-Path $env:TEMP "accountingx-exec-err.txt"
$p = Start-Process -FilePath $codex -ArgumentList @("exec","--skip-git-repo-check","Reply with exactly: OK from AccountingX") `
     -WorkingDirectory $env:TEMP -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
if (-not $p.WaitForExit(90000)) { $p.Kill(); Add-Content $report "TIMEOUT after 90s" } else { Add-Content $report "exit code: $($p.ExitCode)" }
Add-Content $report "--- stdout (last 30) ---"
if (Test-Path $out) { Get-Content $out -Tail 30 | Add-Content $report }
Add-Content $report "--- stderr (last 40) ---"
if (Test-Path $err) { Get-Content $err -Tail 40 | Add-Content $report }

Section "app logs (last 60 lines of newest log)"
$logDir = Join-Path $env:APPDATA "vn.accountingx.desktop\logs"
if (Test-Path $logDir) {
  $f = Get-ChildItem $logDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  Add-Content $report "file: $($f.FullName)"
  Get-Content $f.FullName -Tail 60 | Add-Content $report
} else { Add-Content $report "no log dir at $logDir" }

Write-Host "Done. Report: $report"

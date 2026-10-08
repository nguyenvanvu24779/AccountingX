<#
  Runs the checks that can only run on Windows and writes a readable report
  to selftest-report.txt in the repo root (git-ignored), so it can be reviewed.
  Usage: powershell -ExecutionPolicy Bypass -File scripts\selftest.ps1
#>
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$report = Join-Path $root "selftest-report.txt"
"AccountingX selftest  $(Get-Date -Format s)" | Set-Content $report
$failed = 0

function Step($name, [scriptblock]$body) {
  Add-Content $report "`n=== $name ==="
  try {
    $out = & $body 2>&1 | Out-String
    $code = $LASTEXITCODE
    $tail = ($out -split "`r?`n" | Select-Object -Last 25) -join "`n"
    Add-Content $report $tail
    if ($code -ne $null -and $code -ne 0) { Add-Content $report "RESULT: FAIL (exit $code)"; $script:failed++ }
    else { Add-Content $report "RESULT: OK" }
  } catch {
    Add-Content $report "RESULT: FAIL ($($_.Exception.Message))"; $script:failed++
  }
}

Step "git head"            { git log --oneline -3 }
Step "disk free (GB)"      { [math]::Round((Get-PSDrive C).Free/1GB,1) }
Step "bundled files"       { Get-ChildItem src-tauri\resources\codex | Select-Object Name,Length | Format-Table | Out-String; if (-not (Test-Path src-tauri\resources\codex\codex.exe)) { cmd /c exit 1 } }
Step "codex --version"     { & .\src-tauri\resources\codex\codex.exe --version; "size MB: " + [math]::Round((Get-Item src-tauri\resources\codex\codex.exe).Length/1MB,1) }
Step "frontend typecheck"  { bunx tsc --noEmit }
Step "frontend tests"      { bun run test }
Step "rust check"          { cargo check --workspace }
Step "rust tests"          { cargo test --workspace --no-fail-fast }

Add-Content $report "`nSUMMARY: $failed step(s) failed"
Write-Host "Done. Report: $report  ($failed failed)"

# AccountingX - kiem tra moi truong build tren Windows. Chay: powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1
$ErrorActionPreference = "Continue"
function Check($name, $cmd) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($c) { $v = (& $cmd --version 2>&1 | Select-Object -First 1); Write-Host "[OK]   $name : $v" -ForegroundColor Green }
  else { Write-Host "[THIEU] $name  (lenh '$cmd' khong tim thay)" -ForegroundColor Red }
}
Check "Rust (rustc)" "rustc"; Check "Cargo" "cargo"; Check "Bun" "bun"; Check "Node" "node"; Check "Codex CLI" "codex"; Check "Git" "git"
$wv = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if ($wv) { Write-Host "[OK]   WebView2 : $($wv.pv)" -ForegroundColor Green } else { Write-Host "[THIEU] WebView2 Runtime" -ForegroundColor Red }
$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
if ($vs) { Write-Host "[OK]   VS Build Tools (C++) : $vs" -ForegroundColor Green } else { Write-Host "[THIEU] Visual Studio Build Tools - workload 'Desktop development with C++'" -ForegroundColor Red }
Write-Host "`nNeu du het: bun install ; cargo check -p codexia ; bun tauri dev"

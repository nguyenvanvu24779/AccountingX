param(
  [switch]$AllowDesktopProcess
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$codexPath = Join-Path $repoRoot "src-tauri\resources\codex\codex.exe"
$accountingXCodexHome = Join-Path $env:USERPROFILE ".accountingx\codex"

if (-not (Test-Path -LiteralPath $codexPath)) {
  throw "AccountingX Codex CLI was not found at $codexPath"
}

if (-not $AllowDesktopProcess) {
  $desktopProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and (
      $_.ExecutablePath -like "$env:LOCALAPPDATA\OpenAI\Codex\*" -or
      $_.ExecutablePath -like "C:\Program Files\WindowsApps\OpenAI.Codex_*"
    )
  }

  if ($desktopProcesses) {
    $details = $desktopProcesses |
      Select-Object ProcessId, Name, ExecutablePath |
      Format-Table -AutoSize |
      Out-String
    throw "Codex Desktop is still running. Close it completely and retry.`n$details"
  }
}

$previousAccountingXCodexHome = $env:CODEX_HOME
$env:CODEX_HOME = $accountingXCodexHome

try {
  & $codexPath `
    -c 'mcp_servers.cua_repl.env.SKY_CUA_NATIVE_PIPE=""' `
    -c 'mcp_servers.cua_repl.env.SKY_CUA_NATIVE_PIPE_DIRECTORY=""' `
    --no-daemon `
    --dangerously-bypass-approvals-and-sandbox `
    exec "Use cua_repl only. Call await cua.getState(); report the provider, browser name, profile name, and whether a Google Keep tab is visible. Do not click, type, navigate, or modify anything."

  exit $LASTEXITCODE
} finally {
  if ($null -eq $previousAccountingXCodexHome) {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  } else {
    $env:CODEX_HOME = $previousAccountingXCodexHome
  }
}

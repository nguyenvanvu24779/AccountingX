# Write test: the bundled AccountingX Codex creates ONE Google Keep note in the
# user's Chrome (through cua_repl + the official ChatGPT extension), reloads
# Keep and verifies it. Run it yourself from a PowerShell window; it touches
# nothing else.
#
# Runs Codex interactively with approvals on: browser-use asks before it may
# access a site (keep.google.com), and you answer in this window. A
# non-interactive `exec` run can't ask, so that request is declined.
# Use test-cloned-cua-standalone.ps1 for routine read-only checks.

param(
  # The Google account whose Chrome window should be used. The agent checks it
  # on keep.google.com itself — Chrome's own profile pages are off limits.
  [string]$Account = "cacaodongnai.com@gmail.com",
  [switch]$AllowDesktopProcess
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$codexPath = Join-Path $repoRoot "src-tauri\resources\codex\codex.exe"
if (-not (Test-Path -LiteralPath $codexPath)) {
  throw "AccountingX Codex CLI was not found at $codexPath"
}

# With the ChatGPT/Codex desktop app running, cua_repl sees a second browser
# connection and can't tell which one is the user's Chrome profile.
if (-not $AllowDesktopProcess) {
  $desktopProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and (
      $_.ExecutablePath -like "$env:LOCALAPPDATA\OpenAI\Codex\*" -or
      $_.ExecutablePath -like "C:\Program Files\WindowsApps\OpenAI.Codex_*" -or
      $_.ExecutablePath -like "C:\Program Files\WindowsApps\OpenAI.ChatGPT*"
    )
  }
  if ($desktopProcesses) {
    $details = $desktopProcesses | Select-Object ProcessId, Name, ExecutablePath | Format-Table -AutoSize | Out-String
    throw "Close the ChatGPT / Codex desktop app completely (including the tray icon), then retry.`n$details"
  }
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$prompt = @"
Use cua_repl only.
1. Call cua.getState(). If several Chrome browsers are listed, pick the one where keep.google.com
   shows the signed-in Google account $Account (read it from the account button on the Keep page).
   Never open chrome:// or settings pages to find a profile. If no browser shows that account, stop and say so.
2. In that browser, open https://keep.google.com in a new tab and create exactly ONE note:
     title: AccountingX test $stamp
     body:  Test ghi note tu AccountingX qua Codex
3. Reload Keep and confirm the note exists.
Do not edit or delete any other note, do not change settings, do not type anything else.
Report: which account was verified, whether the note was created, and whether it was still there after reload.
"@

$previousCodexHome = $env:CODEX_HOME
$env:CODEX_HOME = Join-Path $env:USERPROFILE ".accountingx\codex"
try {
  # The computer stays read-only for the agent; only the browser is driven,
  # and only after you approve access to the site.
  & $codexPath `
    -c 'mcp_servers.cua_repl.env.SKY_CUA_NATIVE_PIPE=""' `
    -c 'mcp_servers.cua_repl.env.SKY_CUA_NATIVE_PIPE_DIRECTORY=""' `
    -c 'approval_policy="on-request"' `
    --sandbox read-only `
    --no-daemon `
    $prompt
  exit $LASTEXITCODE
} finally {
  if ($null -eq $previousCodexHome) {
    Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
  } else {
    $env:CODEX_HOME = $previousCodexHome
  }
}

$ErrorActionPreference = "Stop"

function Assert-Windows {
  if (-not $env:OS -or $env:OS -notmatch "Windows") {
    throw "This installer must run on Windows 10 or later."
  }
}

function Ensure-Elevation {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process powershell.exe -ArgumentList $arguments -Verb RunAs -Wait
    exit $LASTEXITCODE
  }
}

function Ensure-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) { return }

  Write-Host "Node.js is required. Installing Node.js LTS..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  } else {
    throw "Node.js was not found and winget is unavailable. Install Node.js LTS from https://nodejs.org/ and rerun setup-windows.cmd."
  }

  $nodePaths = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe"
  )
  $node = $nodePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $node) {
    throw "Node.js installed, but a new PowerShell session is required to refresh PATH. Close this window and rerun setup-windows.cmd."
  }
}

Assert-Windows
Ensure-Elevation
Ensure-Node

$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectPath
Write-Host "Installing project dependencies..."
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

& (Join-Path $PSScriptRoot "windows-poll-control.ps1") -Action on

$rule = Get-NetFirewallRule -DisplayName "Favorite Things Poll" -ErrorAction SilentlyContinue
if ($null -eq $rule) {
  New-NetFirewallRule -DisplayName "Favorite Things Poll" -Direction Inbound -Protocol TCP -LocalPort 4173 -Action Allow -Profile Private,Domain | Out-Null
}

Write-Host ""
Write-Host "Favorite Things Poll is running and set to start by default after Windows sign-in."
Write-Host "Open http://localhost:4173"
Write-Host "LAN address: http://<computer-ip>:4173"

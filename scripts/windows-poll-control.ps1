param(
  [ValidateSet("on", "off", "status")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$TaskName = "FavoriteThingsPoll"
$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$NodeCommand = (Get-Command node -ErrorAction SilentlyContinue)
$WindowsIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()

if ($null -eq $NodeCommand) {
  throw "Node.js was not found in PATH. Install Node.js for Windows and reopen PowerShell."
}

switch ($Action) {
  "on" {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $existingTask) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction -Execute $NodeCommand.Source -Argument "server.js" -WorkingDirectory $ProjectPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $WindowsIdentity.Name
    $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId $WindowsIdentity.Name -LogonType Interactive -RunLevel Highest
    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

    Start-ScheduledTask -TaskName $TaskName
    Get-ScheduledTaskInfo -TaskName $TaskName
  }
  "off" {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Favorite Things Poll is stopped and will not start automatically."
  }
  "status" {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -eq $task) {
      Write-Host "Favorite Things Poll autostart is off."
      return
    }
    Get-ScheduledTaskInfo -TaskName $TaskName
  }
}

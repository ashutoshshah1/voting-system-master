param(
  [switch]$SkipOfflineApi,
  [switch]$StartSerialBridge,
  [string]$SerialPort,
  [ValidateSet("register", "link", "pin-setup", "session", "attest", "vote", "scan")]
  [string]$SerialMode = "scan",
  [string]$OfflineApiUrl = "http://localhost:4100",
  [int]$SerialBaud = 115200,
  [int]$SerialTimeoutMs = 15000,
  [int]$SerialRetries = 1,
  [string]$SerialExtraArgs = "",
  [switch]$SerialOnce
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Use-InstalledNodePath {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    return
  }
  $candidates = @(
    (Join-Path $env:ProgramFiles "nodejs"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs")
  ) | Where-Object { $_ }
  foreach ($dir in $candidates) {
    if (Test-Path (Join-Path $dir "node.exe")) {
      $env:Path = "$dir;$env:Path"
      return
    }
  }
}

function Get-NpmCommand {
  $command = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  $command = Get-Command "npm" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  throw "Missing npm. Install Node.js 18+ from nodejs.org."
}

function Ensure-NodeModules {
  param([string]$dir)
  $nodeModules = Join-Path $dir "node_modules"
  if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing dependencies in $dir..." -ForegroundColor Cyan
    Push-Location $dir
    & $script:NpmCommand install
    Pop-Location
  }
}

function Warn-MissingEnv {
  param([string]$dir, [string]$name)
  $envPath = Join-Path $dir ".env"
  if (-not (Test-Path $envPath)) {
    Write-Host "Warning: $name .env not found at $envPath. Create it before running." -ForegroundColor Yellow
  }
}

function Get-EnvFileValue {
  param([string]$Path, [string]$Name)
  if (-not (Test-Path $Path)) {
    return $null
  }
  $pattern = "^{0}=(.*)$" -f [Regex]::Escape($Name)
  foreach ($line in Get-Content $Path) {
    if ($line -match $pattern) {
      return $Matches[1].Trim()
    }
  }
  return $null
}

function Get-AvailableSerialPorts {
  $ports = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty DeviceID
  return @($ports | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Resolve-SerialPort {
  param([string]$RequestedPort, [string]$SerialBridgeDir)
  if (-not [string]::IsNullOrWhiteSpace($RequestedPort)) {
    return $RequestedPort.Trim()
  }

  $envPath = Join-Path $SerialBridgeDir ".env"
  $configuredPort = Get-EnvFileValue -Path $envPath -Name "SERIAL_PORT"
  $availablePorts = Get-AvailableSerialPorts

  if (-not [string]::IsNullOrWhiteSpace($configuredPort) -and $availablePorts -contains $configuredPort) {
    return $configuredPort
  }

  if (-not [string]::IsNullOrWhiteSpace($configuredPort)) {
    Write-Host "Warning: configured SERIAL_PORT '$configuredPort' was not detected." -ForegroundColor Yellow
  }

  if ($availablePorts.Count -eq 1) {
    Write-Host "Using detected serial port $($availablePorts[0])." -ForegroundColor Cyan
    return $availablePorts[0]
  }

  if ($availablePorts.Count -gt 1) {
    Write-Host "Warning: multiple serial ports detected ($($availablePorts -join ', ')). Pass -SerialPort to choose one." -ForegroundColor Yellow
    return $null
  }

  Write-Host "Warning: no serial ports detected. Connect the RFID scanner and try again." -ForegroundColor Yellow
  return $null
}

function Build-SerialBridgeCommand {
  param(
    [string]$Port,
    [string]$Mode,
    [string]$ApiUrl,
    [int]$Baud,
    [int]$TimeoutMs,
    [int]$Retries,
    [string]$ExtraArgs,
    [bool]$Once
  )
  $parts = @(
    "npm run dev --",
    "--port `"$Port`"",
    "--mode $Mode",
    "--api `"$ApiUrl`"",
    "--baud $Baud",
    "--timeoutMs $TimeoutMs",
    "--retries $Retries"
  )
  if ($Once) {
    $parts += "--once"
  }
  if (-not [string]::IsNullOrWhiteSpace($ExtraArgs)) {
    $parts += $ExtraArgs
  }
  return ($parts -join " ")
}

$apiDir = Join-Path $root "services/api"
$dappDir = Join-Path $root "apps/dapp"
$offlineApiDir = Join-Path $root "v2/services/offline-api"
$serialBridgeDir = Join-Path $root "v2/device/serial-bridge"

Use-InstalledNodePath
$script:NpmCommand = Get-NpmCommand

Write-Host "Starting infrastructure (Postgres + MinIO)..." -ForegroundColor Cyan
docker compose up -d | Out-Null

Warn-MissingEnv -dir $apiDir -name "API"
Warn-MissingEnv -dir $dappDir -name "DApp"
if (-not $SkipOfflineApi) {
  Warn-MissingEnv -dir $offlineApiDir -name "Offline API"
}

Ensure-NodeModules -dir $apiDir
Ensure-NodeModules -dir $dappDir
if (-not $SkipOfflineApi) {
  Ensure-NodeModules -dir $offlineApiDir
}

Write-Host "Starting API (services/api)..." -ForegroundColor Cyan
Start-Process -WorkingDirectory $apiDir -FilePath "cmd.exe" -ArgumentList "/c npm run dev"

Write-Host "Starting DApp (apps/dapp)..." -ForegroundColor Cyan
Start-Process -WorkingDirectory $dappDir -FilePath "cmd.exe" -ArgumentList "/c npm run dev"

if (-not $SkipOfflineApi) {
  Write-Host "Starting Offline API (v2/services/offline-api)..." -ForegroundColor Cyan
  Start-Process -WorkingDirectory $offlineApiDir -FilePath "cmd.exe" -ArgumentList "/c npm run dev"
}

if ($StartSerialBridge) {
  $resolvedSerialPort = Resolve-SerialPort -RequestedPort $SerialPort -SerialBridgeDir $serialBridgeDir
  if ([string]::IsNullOrWhiteSpace($resolvedSerialPort)) {
    Write-Host "Serial bridge was not started." -ForegroundColor Yellow
  } else {
    if ($SkipOfflineApi) {
      Write-Host "Warning: -SkipOfflineApi is set. Ensure offline API is already running at $OfflineApiUrl." -ForegroundColor Yellow
    }
    Ensure-NodeModules -dir $serialBridgeDir
    $bridgeCommand = Build-SerialBridgeCommand `
      -Port $resolvedSerialPort `
      -Mode $SerialMode `
      -ApiUrl $OfflineApiUrl `
      -Baud $SerialBaud `
      -TimeoutMs $SerialTimeoutMs `
      -Retries $SerialRetries `
      -ExtraArgs $SerialExtraArgs `
      -Once $SerialOnce.IsPresent
    Write-Host "Starting Serial Bridge (v2/device/serial-bridge) on $resolvedSerialPort..." -ForegroundColor Cyan
    Start-Process -WorkingDirectory $serialBridgeDir -FilePath "cmd.exe" -ArgumentList "/c $bridgeCommand"
  }
}

Write-Host "Core services started. Open http://localhost:5173" -ForegroundColor Green
if (-not $SkipOfflineApi) {
  $offlineHealthUrl = "{0}/health" -f $OfflineApiUrl.TrimEnd("/")
  Write-Host "Offline API health: $offlineHealthUrl" -ForegroundColor Green
}

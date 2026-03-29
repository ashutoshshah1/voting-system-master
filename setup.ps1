param(
  [switch]$SkipDocker,
  [switch]$SkipPrisma,
  [switch]$SkipEnv,
  [switch]$SkipOfflineApi
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Section {
  param([string]$Message)
  Write-Host "`n$Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Assert-Command {
  param([string]$Name, [string]$Hint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Missing $Name. $Hint"
  }
}

function Get-CommandPath {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }
  return $null
}

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

function Require-Node18 {
  $raw = (node -v).Trim()
  $versionText = $raw.TrimStart("v")
  try {
    $version = [version]$versionText
  } catch {
    Fail "Unable to parse Node.js version '$raw'."
  }
  if ($version -lt [version]"18.0.0") {
    Fail "Node.js 18+ is required. Found $versionText."
  }
}

function Ensure-DockerCompose {
  try {
    docker compose version | Out-Null
  } catch {
    Fail "Docker Compose is not available. Update Docker Desktop or install docker-compose."
  }
}

function Copy-EnvIfMissing {
  param([string]$Dir)
  $envPath = Join-Path $Dir ".env"
  $examplePath = Join-Path $Dir ".env.example"
  if (Test-Path $envPath) {
    Write-Host "Found $envPath" -ForegroundColor DarkGray
    return
  }
  if (Test-Path $examplePath) {
    Copy-Item $examplePath $envPath
    Write-Host "Created $envPath from .env.example" -ForegroundColor Green
    return
  }
  Write-Host "Warning: $examplePath not found. Create $envPath manually." -ForegroundColor Yellow
}

function Install-NodeDeps {
  param([string]$Dir)
  $lockPath = Join-Path $Dir "package-lock.json"
  Push-Location $Dir
  if (Test-Path $lockPath) {
    & $script:NpmCommand ci
  } else {
    & $script:NpmCommand install
  }
  Pop-Location
}

Write-Section "Checking prerequisites..."
Use-InstalledNodePath
Assert-Command -Name "node" -Hint "Install Node.js 18+ from nodejs.org."
$script:NpmCommand = Get-CommandPath @("npm.cmd", "npm")
$script:NpxCommand = Get-CommandPath @("npx.cmd", "npx")
if (-not $script:NpmCommand) {
  Fail "Missing npm. Install Node.js 18+ from nodejs.org."
}
if (-not $script:NpxCommand) {
  Fail "Missing npx. Install Node.js 18+ from nodejs.org."
}
Require-Node18

if (-not $SkipDocker) {
  Assert-Command -Name "docker" -Hint "Install Docker Desktop from docker.com."
  Ensure-DockerCompose
}

if (-not $SkipEnv) {
  Write-Section "Creating .env files if missing..."
  Copy-EnvIfMissing -Dir (Join-Path $root "services/api")
  Copy-EnvIfMissing -Dir (Join-Path $root "apps/dapp")
  if (-not $SkipOfflineApi) {
    Copy-EnvIfMissing -Dir (Join-Path $root "v2/services/offline-api")
  }
}

if (-not $SkipDocker) {
  Write-Section "Starting infrastructure (Postgres + MinIO)..."
  docker compose up -d
}

Write-Section "Installing dependencies..."
Install-NodeDeps -Dir (Join-Path $root "services/api")
Install-NodeDeps -Dir (Join-Path $root "apps/dapp")
if (-not $SkipOfflineApi) {
  Install-NodeDeps -Dir (Join-Path $root "v2/services/offline-api")
}

if (-not $SkipPrisma) {
  Write-Section "Running Prisma setup..."
  Push-Location (Join-Path $root "services/api")
  & $script:NpxCommand prisma migrate deploy
  & $script:NpxCommand prisma generate
  Pop-Location

  if (-not $SkipOfflineApi) {
    Push-Location (Join-Path $root "v2/services/offline-api")
    & $script:NpmCommand run prisma:generate
    & $script:NpmCommand run prisma:push
    Pop-Location
  }
}

Write-Section "Setup complete."
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1) Edit services/api/.env and apps/dapp/.env with real values."
if (-not $SkipOfflineApi) {
  Write-Host "2) Edit v2/services/offline-api/.env and set OFFLINE_RFID_PEPPER + blockchain values."
  Write-Host "3) Start services with .\\start.ps1"
} else {
  Write-Host "2) Start services with .\\start.ps1 -SkipOfflineApi"
}

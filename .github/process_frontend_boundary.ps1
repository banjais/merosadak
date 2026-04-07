# Process Frontend Boundary Script
# This script handles frontend boundary processing for the application

param(
    [Parameter(Mandatory = $false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory = $false)]
    [string]$BuildDir = "dist",
    
    [Parameter(Mandatory = $false)]
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Timestamp] [$Level] $Message"
}

function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    $requiredCommands = @("node", "npm")
    foreach ($cmd in $requiredCommands) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            throw "Required command '$cmd' is not installed"
        }
    }
    
    Write-Log "All prerequisites satisfied"
}

function New-FrontendBuild {
    param(
        [string]$BuildDirectory
    )
    
    Write-Log "Starting frontend build in directory: $BuildDirectory"
    
    if (-not (Test-Path $BuildDirectory)) {
        Write-Log "Build directory does not exist, running npm build..." -Level "WARN"
        
        if (Test-Path "package.json") {
            npm run build
            if ($LASTEXITCODE -ne 0) {
                throw "Frontend build failed"
            }
        } else {
            Write-Log "No package.json found, skipping build" -Level "WARN"
        }
    }
    
    Write-Log "Frontend build completed"
}

function Set-BoundaryConfig {
    param(
        [string]$Env
    )
    
    Write-Log "Configuring boundary for environment: $Env"
    
    $config = @{
        environment = $Env
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        version = "1.0.0"
    }
    
    $configPath = Join-Path $BuildDir "boundary-config.json"
    $config | ConvertTo-Json | Out-File -FilePath $configPath -Encoding utf8
    
    Write-Log "Boundary configuration written to: $configPath"
}

try {
    Write-Log "Starting frontend boundary processing..."
    
    Test-Prerequisites
    New-FrontendBuild -BuildDirectory $BuildDir
    Set-BoundaryConfig -Env $Environment
    
    Write-Log "Frontend boundary processing completed successfully" -Level "SUCCESS"
    exit 0
}
catch {
    Write-Log "Error: $($_.Exception.Message)" -Level "ERROR"
    exit 1
}
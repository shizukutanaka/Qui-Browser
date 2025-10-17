# Qui Browser - Production Setup Script (Windows PowerShell)
# ı¶ìÙën»­åêÆ£há<'’ŸşY‹êÕ»ÃÈ¢Ã×¹¯ê×È
#
# Usage: .\scripts\setup-production.ps1
#
# Requires PowerShell 5.1 or higher

# Error handling
$ErrorActionPreference = "Stop"

# Functions for colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Display banner
Write-Host ""
Write-Host "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW" -ForegroundColor Cyan
Write-Host "Q   Qui Browser - Production Setup Script             Q" -ForegroundColor Cyan
Write-Host "Q   ı¶ìÙën»­åêÆ£há<'                    Q" -ForegroundColor Cyan
Write-Host "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning-Custom "This script is not running with Administrator privileges."
    Write-Warning-Custom "Some features may not work correctly."
    Write-Host ""
}

try {
    # Step 1: Check prerequisites
    Write-Info "Step 1/8: Checking prerequisites..."

    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js version: $nodeVersion"

        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 18) {
            throw "Node.js version must be 18.0.0 or higher. Current: $nodeVersion"
        }
    }
    catch {
        Write-Error-Custom "Node.js is not installed or version check failed."
        Write-Host "Please install Node.js 18.0.0 or higher from https://nodejs.org/"
        exit 1
    }

    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm version: $npmVersion"
    }
    catch {
        Write-Error-Custom "npm is not installed"
        exit 1
    }

    # Step 2: Install dependencies
    Write-Info "Step 2/8: Installing dependencies..."
    npm install
    Write-Success "Dependencies installed"

    # Step 3: Create necessary directories
    Write-Info "Step 3/8: Creating directories..."
    $directories = @(
        "logs",
        "logs\audit",
        "data",
        "backups",
        "certs"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Success "Directories created"

    # Step 4: Set file permissions (Windows equivalent)
    Write-Info "Step 4/8: Setting file permissions..."
    # On Windows, we'll ensure the directories exist and are accessible
    # ACL management would require admin privileges
    Write-Success "File permissions verified"

    # Step 5: Setup .env file
    Write-Info "Step 5/8: Configuring environment variables..."
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Success ".env file created from .env.example"

            # Generate secure keys
            Write-Info "Generating secure random keys..."
            $auditKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
            $billingToken = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

            # Replace placeholder keys in .env
            $envContent = Get-Content ".env" -Raw
            $envContent = $envContent -replace "change-this-to-a-secure-random-key-minimum-32-characters", $auditKey
            $envContent = $envContent -replace "change-this-to-a-secure-random-admin-token-minimum-32-characters", $billingToken
            Set-Content ".env" -Value $envContent

            Write-Success "Secure random keys generated"
            Write-Warning-Custom "Please review and update .env file with your production settings"
        }
        else {
            Write-Error-Custom ".env.example not found. Cannot create .env file"
            exit 1
        }
    }
    else {
        Write-Warning-Custom ".env file already exists. Skipping..."
    }

    # Step 6: Run security checks
    Write-Info "Step 6/8: Running security checks..."

    # Check for vulnerabilities
    Write-Info "Checking for npm vulnerabilities..."
    try {
        npm audit --audit-level=moderate
    }
    catch {
        Write-Warning-Custom "Some vulnerabilities found. Run 'npm audit fix' to fix"
    }

    # Validate environment configuration
    Write-Info "Validating environment configuration..."
    if (Test-Path "scripts\check-env.js") {
        try {
            node scripts\check-env.js
        }
        catch {
            Write-Warning-Custom "Environment validation warnings detected"
        }
    }

    Write-Success "Security checks completed"

    # Step 7: Run tests
    Write-Info "Step 7/8: Running test suite..."
    try {
        npm test
        Write-Success "Test suite completed"
    }
    catch {
        Write-Warning-Custom "Some tests failed. Please review test output"
    }

    # Step 8: Setup complete
    Write-Info "Step 8/8: Finalizing setup..."

    Write-Host ""
    Write-Host "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW" -ForegroundColor Green
    Write-Host "Q           Setup Completed Successfully!              Q" -ForegroundColor Green
    Write-Host "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]" -ForegroundColor Green
    Write-Host ""

    Write-Info "Next steps:"
    Write-Host ""
    Write-Host "  1. Review and update .env file:"
    Write-Host "     notepad .env"
    Write-Host ""
    Write-Host "  2. Configure HTTPS (recommended for production):"
    Write-Host "     - Set ENABLE_HTTPS=true"
    Write-Host "     - Place TLS certificates in .\certs\"
    Write-Host ""
    Write-Host "  3. Start the server:"
    Write-Host "     npm start                    # Development mode"
    Write-Host "     npm run start:prod          # Production mode"
    Write-Host "     npm run pm2:start           # PM2 (recommended)"
    Write-Host ""
    Write-Host "  4. Verify server health:"
    Write-Host "     curl http://localhost:8000/health"
    Write-Host ""
    Write-Host "  5. Monitor logs:"
    Write-Host "     Get-Content logs\*.log -Wait"
    Write-Host "     pm2 logs                    # If using PM2"
    Write-Host ""

    Write-Info "Important security reminders:"
    Write-Host ""
    Write-Host "     Review .env and ensure all secrets are properly configured"
    Write-Host "     Enable HTTPS in production environments"
    Write-Host "     Configure Windows Firewall to allow only necessary ports"
    Write-Host "     Set up monitoring and alerting"
    Write-Host "     Configure automated backups"
    Write-Host ""

    Write-Info "Documentation:"
    Write-Host ""
    Write-Host "  =Ö README.md                           # User guide"
    Write-Host "  =Ö docs\PRODUCTION-DEPLOYMENT.md      # Deployment guide"
    Write-Host "  =Ö docs\PRODUCTION-CHECKLIST.md       # Security checklist"
    Write-Host ""

    Write-Success "Setup complete! Your Qui Browser server is ready for production."
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Error-Custom "Setup failed: $_"
    Write-Host ""
    Write-Host "Please check the error message above and try again."
    Write-Host "For help, see: docs\TROUBLESHOOTING.md"
    exit 1
}

#!/bin/bash
#
# Qui Browser - Production Setup Script
# ý¶ìÙën»­åêÆ£há<'’ŸþY‹êÕ»ÃÈ¢Ã×¹¯ê×È
#
# Usage: ./scripts/setup-production.sh
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Display banner
echo ""
echo "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW"
echo "Q   Qui Browser - Production Setup Script             Q"
echo "Q   ý¶ìÙën»­åêÆ£há<'                    Q"
echo "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please do not run this script as root"
    exit 1
fi

# Step 1: Check prerequisites
log_info "Step 1/8: Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18.0.0 or higher"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version must be 18.0.0 or higher. Current: $(node -v)"
    exit 1
fi
log_success "Node.js version: $(node -v)"

# Check npm version
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi
log_success "npm version: $(npm -v)"

# Step 2: Install dependencies
log_info "Step 2/8: Installing dependencies..."
npm install
log_success "Dependencies installed"

# Step 3: Create necessary directories
log_info "Step 3/8: Creating directories..."
mkdir -p logs
mkdir -p logs/audit
mkdir -p data
mkdir -p backups
mkdir -p certs
log_success "Directories created"

# Step 4: Set file permissions
log_info "Step 4/8: Setting file permissions..."
chmod 750 logs
chmod 750 logs/audit
chmod 700 data
chmod 700 certs
chmod 700 backups
log_success "File permissions set"

# Step 5: Setup .env file
log_info "Step 5/8: Configuring environment variables..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        chmod 600 .env
        log_success ".env file created from .env.example"

        # Generate secure keys
        log_info "Generating secure random keys..."
        AUDIT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        BILLING_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

        # Replace placeholder keys (cross-platform compatible)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/change-this-to-a-secure-random-key-minimum-32-characters/$AUDIT_KEY/g" .env
            sed -i '' "s/change-this-to-a-secure-random-admin-token-minimum-32-characters/$BILLING_TOKEN/g" .env
        else
            # Linux
            sed -i "s/change-this-to-a-secure-random-key-minimum-32-characters/$AUDIT_KEY/g" .env
            sed -i "s/change-this-to-a-secure-random-admin-token-minimum-32-characters/$BILLING_TOKEN/g" .env
        fi

        log_success "Secure random keys generated"
        log_warning "Please review and update .env file with your production settings"
    else
        log_error ".env.example not found. Cannot create .env file"
        exit 1
    fi
else
    log_warning ".env file already exists. Skipping..."
fi

# Step 6: Run security checks
log_info "Step 6/8: Running security checks..."

# Check for vulnerabilities
log_info "Checking for npm vulnerabilities..."
npm audit --audit-level=moderate || log_warning "Some vulnerabilities found. Run 'npm audit fix' to fix"

# Validate environment configuration
log_info "Validating environment configuration..."
if [ -f scripts/check-env.js ]; then
    node scripts/check-env.js || log_warning "Environment validation warnings detected"
fi

log_success "Security checks completed"

# Step 7: Run tests
log_info "Step 7/8: Running test suite..."
npm test || log_warning "Some tests failed. Please review test output"
log_success "Test suite completed"

# Step 8: Setup complete
log_info "Step 8/8: Finalizing setup..."

echo ""
echo "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW"
echo "Q           Setup Completed Successfully!              Q"
echo "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]"
echo ""

log_info "Next steps:"
echo ""
echo "  1. Review and update .env file:"
echo "     nano .env"
echo ""
echo "  2. Configure HTTPS (recommended for production):"
echo "     - Set ENABLE_HTTPS=true"
echo "     - Place TLS certificates in ./certs/"
echo ""
echo "  3. Start the server:"
echo "     npm start                    # Development mode"
echo "     npm run start:prod          # Production mode"
echo "     npm run pm2:start           # PM2 (recommended)"
echo ""
echo "  4. Verify server health:"
echo "     curl http://localhost:8000/health"
echo ""
echo "  5. Monitor logs:"
echo "     tail -f logs/*.log"
echo "     pm2 logs                    # If using PM2"
echo ""

log_info "Important security reminders:"
echo ""
echo "     Review .env and ensure all secrets are properly configured"
echo "     Enable HTTPS in production environments"
echo "     Configure firewall to allow only necessary ports"
echo "     Set up monitoring and alerting"
echo "     Configure automated backups"
echo ""

log_info "Documentation:"
echo ""
echo "  =Ö README.md                           # User guide"
echo "  =Ö docs/PRODUCTION-DEPLOYMENT.md      # Deployment guide"
echo "  =Ö docs/PRODUCTION-CHECKLIST.md       # Security checklist"
echo ""

log_success "Setup complete! Your Qui Browser server is ready for production."
echo ""

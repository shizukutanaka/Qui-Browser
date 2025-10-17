#!/bin/bash

# Qui Browser - Production Deployment Script
# Supports multiple deployment targets: Docker, Kubernetes, Helm

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV=${DEPLOY_ENV:-production}
DEPLOY_TARGET=${DEPLOY_TARGET:-docker}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    case $DEPLOY_TARGET in
        docker)
            if ! command -v docker &> /dev/null; then
                log_error "Docker is not installed"
                exit 1
            fi
            if ! command -v docker-compose &> /dev/null; then
                log_error "Docker Compose is not installed"
                exit 1
            fi
            ;;
        kubernetes)
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is not installed"
                exit 1
            fi
            ;;
        helm)
            if ! command -v helm &> /dev/null; then
                log_error "Helm is not installed"
                exit 1
            fi
            ;;
    esac

    log_success "Prerequisites check passed"
}

# Build application
build_application() {
    log_info "Building application..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    npm ci

    # Run tests
    npm test

    # Build application
    npm run build

    # Pre-compress assets
    npm run assets:precompress

    log_success "Application built successfully"
}

# Deploy to Docker
deploy_docker() {
    log_info "Deploying to Docker..."

    cd "$PROJECT_ROOT"

    # Create necessary directories
    mkdir -p uploads logs

    # Set environment variables
    export NODE_ENV=production
    export DEPLOY_ENV=$DEPLOY_ENV

    # Build and start services
    case $DEPLOY_ENV in
        production)
            docker-compose -f docker-compose.yml --profile db --profile proxy up -d --build
            ;;
        staging)
            docker-compose -f docker-compose.yml up -d --build
            ;;
        development)
            docker-compose -f docker-compose.yml up --build
            ;;
    esac

    log_success "Docker deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."

    cd "$PROJECT_ROOT"

    # Apply Kubernetes manifests
    kubectl apply -f k8s/

    # Wait for rollout
    kubectl rollout status deployment/qui-browser -n qui-browser --timeout=300s

    log_success "Kubernetes deployment completed"
}

# Deploy with Helm
deploy_helm() {
    log_info "Deploying with Helm..."

    cd "$PROJECT_ROOT/helm/qui-browser"

    # Create namespace if it doesn't exist
    kubectl create namespace qui-browser --dry-run=client -o yaml | kubectl apply -f -

    # Install or upgrade release
    if helm list -n qui-browser | grep -q qui-browser; then
        helm upgrade qui-browser . -n qui-browser \
            --set image.tag=$DEPLOY_ENV \
            --set env.NODE_ENV=production \
            --wait
    else
        helm install qui-browser . -n qui-browser \
            --set image.tag=$DEPLOY_ENV \
            --set env.NODE_ENV=production \
            --wait
    fi

    log_success "Helm deployment completed"
}

# Health check
health_check() {
    log_info "Performing health check..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 5
        ((attempt++))
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Rollback deployment
rollback() {
    log_error "Deployment failed, initiating rollback..."

    case $DEPLOY_TARGET in
        docker)
            docker-compose down
            ;;
        kubernetes)
            kubectl rollout undo deployment/qui-browser -n qui-browser
            ;;
        helm)
            helm rollback qui-browser -n qui-browser
            ;;
    esac
}

# Main deployment function
main() {
    log_info "Starting Qui Browser deployment"
    log_info "Environment: $DEPLOY_ENV"
    log_info "Target: $DEPLOY_TARGET"

    # Trap for cleanup on error
    trap rollback ERR

    check_prerequisites
    build_application

    case $DEPLOY_TARGET in
        docker)
            deploy_docker
            ;;
        kubernetes)
            deploy_kubernetes
            ;;
        helm)
            deploy_helm
            ;;
        *)
            log_error "Unknown deployment target: $DEPLOY_TARGET"
            log_info "Supported targets: docker, kubernetes, helm"
            exit 1
            ;;
    esac

    if health_check; then
        log_success "Deployment completed successfully!"
        log_info "Application is running at http://localhost:8000"
        log_info "Health check: http://localhost:8000/health"
        log_info "API docs: http://localhost:8000/api/docs/ui"
    else
        log_error "Deployment health check failed"
        exit 1
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy Qui Browser to various platforms"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       Deployment environment (production, staging, development) [default: production]"
    echo "  -t, --target TARGET Deployment target (docker, kubernetes, helm) [default: docker]"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -t docker"
    echo "  $0 -e staging -t kubernetes"
    echo "  $0 -t helm"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            DEPLOY_ENV="$2"
            shift 2
            ;;
        -t|--target)
            DEPLOY_TARGET="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
case $DEPLOY_ENV in
    production|staging|development)
        ;;
    *)
        log_error "Invalid environment: $DEPLOY_ENV"
        log_info "Valid environments: production, staging, development"
        exit 1
        ;;
esac

# Validate target
case $DEPLOY_TARGET in
    docker|kubernetes|helm)
        ;;
    *)
        log_error "Invalid target: $DEPLOY_TARGET"
        log_info "Valid targets: docker, kubernetes, helm"
        exit 1
        ;;
esac

# Run main deployment
main

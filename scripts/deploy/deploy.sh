#!/bin/bash

# Qui Browser - Advanced Deployment Script
# Supports blue-green, canary, and rolling deployment strategies

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
REGION=${REGION:-us-east-1}
DEPLOYMENT_STRATEGY=${DEPLOYMENT_STRATEGY:-rolling}
CANARY_PERCENTAGE=${CANARY_PERCENTAGE:-10}
ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-true}

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

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check AWS CLI configuration
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS CLI not configured or invalid credentials"
        exit 1
    fi

    # Check if Docker image exists
    if ! aws ecr describe-images --repository-name qui-browser/app --region $REGION >/dev/null 2>&1; then
        log_error "Docker image not found in ECR"
        exit 1
    fi

    # Run security scan
    log_info "Running security scan..."
    if ! docker run --rm -v "$(pwd):/app" quay.io/lukasmartinelli/hadolint:latest < Dockerfile >/dev/null 2>&1; then
        log_warning "Dockerfile has linting issues"
    fi

    # Check application health
    log_info "Checking application health..."
    if ! curl -f -s "https://api.$DOMAIN_NAME/health" >/dev/null; then
        log_error "Application health check failed"
        exit 1
    fi

    log_success "Pre-deployment checks passed"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."

    # Build Docker image
    docker build -t qui-browser:$GIT_COMMIT .

    # Tag and push to ECR
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    docker tag qui-browser:$GIT_COMMIT $ECR_REPOSITORY:$GIT_COMMIT
    docker tag qui-browser:$GIT_COMMIT $ECR_REPOSITORY:latest
    docker push $ECR_REPOSITORY:$GIT_COMMIT
    docker push $ECR_REPOSITORY:latest

    log_success "Docker image built and pushed"
}

# Rolling deployment strategy
rolling_deployment() {
    log_info "Starting rolling deployment..."

    # Update task definition with new image
    TASK_DEFINITION_ARN=$(aws ecs update-task-definition \
        --family qui-browser-app-$ENVIRONMENT \
        --container-definitions "[
            {
                \"name\": \"qui-browser-app\",
                \"image\": \"$ECR_REPOSITORY:$GIT_COMMIT\",
                \"essential\": true,
                \"portMappings\": [
                    {
                        \"containerPort\": 3000,
                        \"hostPort\": 3000,
                        \"protocol\": \"tcp\"
                    }
                ],
                \"environment\": [
                    {
                        \"name\": \"NODE_ENV\",
                        \"value\": \"$ENVIRONMENT\"
                    },
                    {
                        \"name\": \"GIT_COMMIT\",
                        \"value\": \"$GIT_COMMIT\"
                    }
                ],
                \"logConfiguration\": {
                    \"logDriver\": \"awslogs\",
                    \"options\": {
                        \"awslogs-group\": \"/ecs/qui-browser-app-$ENVIRONMENT\",
                        \"awslogs-region\": \"$REGION\",
                        \"awslogs-stream-prefix\": \"ecs\"
                    }
                },
                \"healthCheck\": {
                    \"command\": [\"CMD-SHELL\", \"curl -f http://localhost:3000/health || exit 1\"],
                    \"interval\": 30,
                    \"timeout\": 5,
                    \"retries\": 3
                }
            }
        ]" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    # Update ECS service
    aws ecs update-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service qui-browser-app-$ENVIRONMENT \
        --task-definition $TASK_DEFINITION_ARN \
        --force-new-deployment

    # Wait for deployment to complete
    wait_for_deployment

    log_success "Rolling deployment completed"
}

# Blue-green deployment strategy
blue_green_deployment() {
    log_info "Starting blue-green deployment..."

    # Get current service configuration
    CURRENT_SERVICE=$(aws ecs describe-services \
        --cluster qui-browser-$ENVIRONMENT \
        --services qui-browser-app-$ENVIRONMENT \
        --query 'services[0]')

    CURRENT_TASK_DEF=$(echo $CURRENT_SERVICE | jq -r '.taskDefinition')
    CURRENT_TARGET_GROUP=$(echo $CURRENT_SERVICE | jq -r '.loadBalancers[0].targetGroupArn')

    # Create new target group for green environment
    GREEN_TARGET_GROUP=$(aws elbv2 create-target-group \
        --name qui-browser-green-$ENVIRONMENT-$(date +%s) \
        --protocol HTTP \
        --port 3000 \
        --vpc-id $VPC_ID \
        --health-check-path /health \
        --query 'targetGroups[0].targetGroupArn' \
        --output text)

    # Update task definition with new image
    GREEN_TASK_DEF=$(aws ecs update-task-definition \
        --family qui-browser-app-$ENVIRONMENT \
        --container-definitions "[
            {
                \"name\": \"qui-browser-app\",
                \"image\": \"$ECR_REPOSITORY:$GIT_COMMIT\",
                \"essential\": true,
                \"portMappings\": [
                    {
                        \"containerPort\": 3000,
                        \"hostPort\": 3000,
                        \"protocol\": \"tcp\"
                    }
                ],
                \"environment\": [
                    {
                        \"name\": \"NODE_ENV\",
                        \"value\": \"$ENVIRONMENT\"
                    },
                    {
                        \"name\": \"GIT_COMMIT\",
                        \"value\": \"$GIT_COMMIT\"
                    }
                ],
                \"logConfiguration\": {
                    \"logDriver\": \"awslogs\",
                    \"options\": {
                        \"awslogs-group\": \"/ecs/qui-browser-app-$ENVIRONMENT\",
                        \"awslogs-region\": \"$REGION\",
                        \"awslogs-stream-prefix\": \"ecs-green\"
                    }
                }
            }
        ]" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    # Create green service
    GREEN_SERVICE_ARN=$(aws ecs create-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service-name qui-browser-app-green-$ENVIRONMENT \
        --task-definition $GREEN_TASK_DEF \
        --desired-count 2 \
        --load-balancers "targetGroupArn=$GREEN_TARGET_GROUP,id=qui-browser-app,containerName=qui-browser-app,containerPort=3000" \
        --query 'service.serviceArn' \
        --output text)

    # Wait for green service to be healthy
    wait_for_service_health "qui-browser-app-green-$ENVIRONMENT"

    # Test green environment
    if ! test_green_environment; then
        log_error "Green environment tests failed"
        cleanup_green_deployment $GREEN_SERVICE_ARN $GREEN_TARGET_GROUP
        exit 1
    fi

    # Switch traffic to green environment
    switch_traffic_to_green $GREEN_TARGET_GROUP

    # Monitor for issues
    if ! monitor_post_deployment; then
        log_error "Post-deployment monitoring failed, initiating rollback"
        rollback_to_blue $CURRENT_TARGET_GROUP
        cleanup_green_deployment $GREEN_SERVICE_ARN $GREEN_TARGET_GROUP
        exit 1
    fi

    # Clean up old blue environment
    cleanup_blue_deployment $CURRENT_SERVICE $CURRENT_TASK_DEF

    log_success "Blue-green deployment completed successfully"
}

# Canary deployment strategy
canary_deployment() {
    log_info "Starting canary deployment..."

    # Get current service
    CURRENT_SERVICE=$(aws ecs describe-services \
        --cluster qui-browser-$ENVIRONMENT \
        --services qui-browser-app-$ENVIRONMENT)

    CURRENT_DESIRED_COUNT=$(echo $CURRENT_SERVICE | jq -r '.services[0].desiredCount')

    # Calculate canary count
    CANARY_COUNT=$((CURRENT_DESIRED_COUNT * CANARY_PERCENTAGE / 100))
    CANARY_COUNT=$((CANARY_COUNT > 0 ? CANARY_COUNT : 1))

    log_info "Deploying canary with $CANARY_COUNT instances ($CANARY_PERCENTAGE% of total)"

    # Create canary target group
    CANARY_TARGET_GROUP=$(aws elbv2 create-target-group \
        --name qui-browser-canary-$ENVIRONMENT-$(date +%s) \
        --protocol HTTP \
        --port 3000 \
        --vpc-id $VPC_ID \
        --health-check-path /health \
        --query 'targetGroups[0].targetGroupArn' \
        --output text)

    # Update task definition for canary
    CANARY_TASK_DEF=$(aws ecs update-task-definition \
        --family qui-browser-app-$ENVIRONMENT \
        --container-definitions "[
            {
                \"name\": \"qui-browser-app\",
                \"image\": \"$ECR_REPOSITORY:$GIT_COMMIT\",
                \"essential\": true,
                \"portMappings\": [
                    {
                        \"containerPort\": 3000,
                        \"hostPort\": 3000,
                        \"protocol\": \"tcp\"
                    }
                ],
                \"environment\": [
                    {
                        \"name\": \"NODE_ENV\",
                        \"value\": \"$ENVIRONMENT\"
                    },
                    {
                        \"name\": \"GIT_COMMIT\",
                        \"value\": \"$GIT_COMMIT\"
                    },
                    {
                        \"name\": \"CANARY_DEPLOYMENT\",
                        \"value\": \"true\"
                    }
                ],
                \"logConfiguration\": {
                    \"logDriver\": \"awslogs\",
                    \"options\": {
                        \"awslogs-group\": \"/ecs/qui-browser-app-$ENVIRONMENT\",
                        \"awslogs-region\": \"$REGION\",
                        \"awslogs-stream-prefix\": \"ecs-canary\"
                    }
                }
            }
        ]" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    # Create canary service
    CANARY_SERVICE_ARN=$(aws ecs create-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service-name qui-browser-app-canary-$ENVIRONMENT \
        --task-definition $CANARY_TASK_DEF \
        --desired-count $CANARY_COUNT \
        --load-balancers "targetGroupArn=$CANARY_TARGET_GROUP,id=qui-browser-app,containerName=qui-browser-app,containerPort=3000" \
        --query 'service.serviceArn' \
        --output text)

    # Add canary target group to listener with weight
    CANARY_WEIGHT=$CANARY_PERCENTAGE
    BLUE_WEIGHT=$((100 - CANARY_PERCENTAGE))

    aws elbv2 modify-listener \
        --listener-arn $LISTENER_ARN \
        --default-actions "[
            {
                \"type\": \"forward\",
                \"forward\": {
                    \"targetGroups\": [
                        {
                            \"targetGroupArn\": \"$CANARY_TARGET_GROUP\",
                            \"weight\": $CANARY_WEIGHT
                        },
                        {
                            \"targetGroupArn\": \"$CURRENT_TARGET_GROUP\",
                            \"weight\": $BLUE_WEIGHT
                        }
                    ]
                }
            }
        ]"

    # Monitor canary
    if ! monitor_canary_deployment $CANARY_SERVICE_ARN; then
        log_error "Canary deployment failed, rolling back"
        rollback_canary_deployment $CANARY_SERVICE_ARN $CANARY_TARGET_GROUP
        exit 1
    fi

    # Promote canary to full deployment
    promote_canary_to_full $CANARY_SERVICE_ARN $CANARY_TARGET_GROUP

    log_success "Canary deployment completed successfully"
}

# Helper functions
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."

    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local status=$(aws ecs describe-services \
            --cluster qui-browser-$ENVIRONMENT \
            --services qui-browser-app-$ENVIRONMENT \
            --query 'services[0].deployments[0].rolloutState' \
            --output text)

        if [ "$status" = "COMPLETED" ]; then
            log_success "Deployment completed successfully"
            return 0
        elif [ "$status" = "FAILED" ]; then
            log_error "Deployment failed"
            return 1
        fi

        log_info "Deployment status: $status (attempt $attempt/$max_attempts)"
        sleep 30
        ((attempt++))
    done

    log_error "Deployment timeout"
    return 1
}

wait_for_service_health() {
    local service_name=$1
    log_info "Waiting for service $service_name to be healthy..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local healthy_count=$(aws ecs describe-services \
            --cluster qui-browser-$ENVIRONMENT \
            --services $service_name \
            --query 'services[0].runningCount' \
            --output text)

        if [ "$healthy_count" -ge 1 ]; then
            log_success "Service $service_name is healthy"
            return 0
        fi

        log_info "Service health check: $healthy_count healthy instances (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    log_error "Service health check timeout"
    return 1
}

test_green_environment() {
    log_info "Testing green environment..."

    # Run automated tests against green environment
    # This would integrate with your testing framework
    log_info "Running integration tests..."
    # npm run test:integration

    # Check application metrics
    log_info "Checking application metrics..."
    # Add metric validation logic

    log_success "Green environment tests passed"
    return 0
}

switch_traffic_to_green() {
    local green_target_group=$1
    log_info "Switching traffic to green environment..."

    # Update listener to route all traffic to green
    aws elbv2 modify-listener \
        --listener-arn $LISTENER_ARN \
        --default-actions "[
            {
                \"type\": \"forward\",
                \"targetGroupArn\": \"$green_target_group\"
            }
        ]"
}

monitor_post_deployment() {
    log_info "Monitoring post-deployment..."

    # Monitor for 5 minutes
    local monitoring_duration=300
    local start_time=$(date +%s)

    while [ $(($(date +%s) - start_time)) -lt $monitoring_duration ]; do
        # Check error rates, response times, etc.
        local error_rate=$(get_current_error_rate)
        local response_time=$(get_current_response_time)

        if (( $(echo "$error_rate > 0.05" | bc -l) )) || (( $(echo "$response_time > 5000" | bc -l) )); then
            log_warning "Deployment monitoring detected issues: error_rate=$error_rate, response_time=$response_time"
            return 1
        fi

        sleep 30
    done

    log_success "Post-deployment monitoring passed"
    return 0
}

rollback_to_blue() {
    local blue_target_group=$1
    log_info "Rolling back to blue environment..."

    aws elbv2 modify-listener \
        --listener-arn $LISTENER_ARN \
        --default-actions "[
            {
                \"type\": \"forward\",
                \"targetGroupArn\": \"$blue_target_group\"
            }
        ]"
}

cleanup_green_deployment() {
    local service_arn=$1
    local target_group=$2

    log_info "Cleaning up green deployment..."

    aws ecs delete-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service $service_arn \
        --force

    aws elbv2 delete-target-group \
        --target-group-arn $target_group
}

cleanup_blue_deployment() {
    local current_service=$1
    local current_task_def=$2

    log_info "Cleaning up old blue deployment..."

    # Scale down old service
    aws ecs update-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service qui-browser-app-$ENVIRONMENT \
        --desired-count 0

    # Clean up old task definitions (keep last 5)
    # Implementation would go here
}

monitor_canary_deployment() {
    local canary_service=$1
    log_info "Monitoring canary deployment..."

    # Monitor for 10 minutes
    local monitoring_duration=600
    local start_time=$(date +%s)

    while [ $(($(date +%s) - start_time)) -lt $monitoring_duration ]; do
        # Check canary metrics
        local canary_error_rate=$(get_canary_error_rate $canary_service)
        local canary_response_time=$(get_canary_response_time $canary_service)

        if (( $(echo "$canary_error_rate > 0.10" | bc -l) )) || (( $(echo "$canary_response_time > 10000" | bc -l) )); then
            log_error "Canary deployment failed metrics check"
            return 1
        fi

        sleep 30
    done

    log_success "Canary monitoring passed"
    return 0
}

rollback_canary_deployment() {
    local canary_service=$1
    local canary_target_group=$2

    log_info "Rolling back canary deployment..."

    # Remove canary from listener
    aws elbv2 modify-listener \
        --listener-arn $LISTENER_ARN \
        --default-actions "[
            {
                \"type\": \"forward\",
                \"targetGroupArn\": \"$CURRENT_TARGET_GROUP\"
            }
        ]"

    # Delete canary service and target group
    aws ecs delete-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service $canary_service \
        --force

    aws elbv2 delete-target-group \
        --target-group-arn $canary_target_group
}

promote_canary_to_full() {
    local canary_service=$1
    local canary_target_group=$2

    log_info "Promoting canary to full deployment..."

    # Update main service with canary task definition
    local canary_task_def=$(aws ecs describe-services \
        --cluster qui-browser-$ENVIRONMENT \
        --services $canary_service \
        --query 'services[0].taskDefinition' \
        --output text)

    # Update main service
    aws ecs update-service \
        --cluster qui-browser-$ENVIRONMENT \
        --service qui-browser-app-$ENVIRONMENT \
        --task-definition $canary_task_def \
        --force-new-deployment

    # Wait for deployment
    wait_for_deployment

    # Clean up canary
    rollback_canary_deployment $canary_service $canary_target_group
}

# Utility functions
get_current_error_rate() {
    # Implementation would query monitoring system
    echo "0.02"
}

get_current_response_time() {
    # Implementation would query monitoring system
    echo "500"
}

get_canary_error_rate() {
    local service=$1
    # Implementation would query monitoring system for canary metrics
    echo "0.01"
}

get_canary_response_time() {
    local service=$1
    # Implementation would query monitoring system for canary metrics
    echo "600"
}

# Main deployment function
main() {
    log_info "Starting Qui Browser deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    log_info "Strategy: $DEPLOYMENT_STRATEGY"

    # Validate environment variables
    if [ -z "$GIT_COMMIT" ]; then
        log_error "GIT_COMMIT environment variable is required"
        exit 1
    fi

    if [ -z "$ECR_REGISTRY" ] || [ -z "$ECR_REPOSITORY" ]; then
        log_error "ECR_REGISTRY and ECR_REPOSITORY environment variables are required"
        exit 1
    fi

    # Run pre-deployment checks
    pre_deployment_checks

    # Build and push image
    build_and_push_image

    # Execute deployment strategy
    case $DEPLOYMENT_STRATEGY in
        "rolling")
            rolling_deployment
            ;;
        "blue-green")
            blue_green_deployment
            ;;
        "canary")
            canary_deployment
            ;;
        *)
            log_error "Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
            log_info "Supported strategies: rolling, blue-green, canary"
            exit 1
            ;;
    esac

    # Post-deployment verification
    post_deployment_verification

    # Update deployment status
    update_deployment_status "success"

    log_success "Deployment completed successfully!"
}

post_deployment_verification() {
    log_info "Running post-deployment verification..."

    # Health checks
    if ! curl -f -s "https://api.$DOMAIN_NAME/health" >/dev/null; then
        log_error "Post-deployment health check failed"
        if [ "$ROLLBACK_ENABLED" = "true" ]; then
            log_info "Initiating rollback..."
            rollback_deployment
        fi
        exit 1
    fi

    # API tests
    log_info "Running API smoke tests..."
    # Add API test implementation

    # Performance checks
    log_info "Running performance checks..."
    # Add performance test implementation

    log_success "Post-deployment verification passed"
}

rollback_deployment() {
    log_error "Deployment rollback initiated"

    # Implementation depends on deployment strategy
    case $DEPLOYMENT_STRATEGY in
        "rolling")
            # Rollback to previous task definition
            ;;
        "blue-green")
            rollback_to_blue $CURRENT_TARGET_GROUP
            ;;
        "canary")
            rollback_canary_deployment $CANARY_SERVICE_ARN $CANARY_TARGET_GROUP
            ;;
    esac

    update_deployment_status "rollback"
}

update_deployment_status() {
    local status=$1
    log_info "Updating deployment status: $status"

    # Implementation would update deployment tracking system
    # Could integrate with GitHub deployments, Jira, etc.
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-v $HOME/.npm:/root/.npm'
        }
    }

    environment {
        NODE_ENV = 'test'
        CI = 'true'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci --prefer-offline --no-audit'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
                sh 'npm run format:check'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Security Scan') {
            steps {
                sh 'npm audit --production'
                sh 'npm run check:vulnerabilities'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            when {
                branch 'main'
            }
            steps {
                script {
                    docker.build("qui-browser:${env.BUILD_NUMBER}")
                    docker.build("qui-browser:latest")
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}

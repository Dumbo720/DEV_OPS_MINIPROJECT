pipeline {
    agent any

    environment {
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Lint') {
            steps {
                bat 'npm run lint'
            }
        }

        stage('Sample Tests') {
            steps {
                bat 'npm run test:sample'
            }
        }

        stage('Selenium Smoke Test') {
            steps {
                bat 'npm run test:ui'
            }
        }

        stage('SAM Build') {
            when {
                expression { return fileExists('template.yaml') }
            }
            steps {
                bat 'sam build'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
        }
    }
}

/**
 * PM2 Ecosystem Configuration
 * Production deployment configuration for PM2 process manager
 */

module.exports = {
  apps: [
    {
      name: 'qui-browser-production',
      script: './server-production.js',
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
        HOST: '0.0.0.0',
        ENABLE_HTTPS: 'false',
        ENABLE_PROFILING: 'true',
        ENABLE_AUDIT_LOG: 'true',
        SESSION_TIMEOUT: 3600000, // 1 hour
        CACHE_MAX_SIZE: 10000,
        CACHE_TTL: 300000, // 5 minutes
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8000,
        ENABLE_PROFILING: 'true',
        ENABLE_AUDIT_LOG: 'true',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8000,
        ENABLE_HTTPS: 'true',
        TLS_CERT_PATH: './certs/staging-cert.pem',
        TLS_KEY_PATH: './certs/staging-key.pem',
        ENABLE_PROFILING: 'true',
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Performance
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      // Monitoring
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'tests', 'docs'],
      // Graceful shutdown
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000,
      // Advanced
      cron_restart: '0 3 * * *', // Restart daily at 3 AM
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'qui-browser-lightweight',
      script: './server-lightweight.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8001,
        HOST: '0.0.0.0',
      },
      error_file: './logs/lightweight-error.log',
      out_file: './logs/lightweight-out.log',
      max_memory_restart: '256M',
      autorestart: true,
      watch: false,
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server-1', 'production-server-2'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/qui-browser.git',
      path: '/var/www/qui-browser',
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up production environment"',
      'post-setup': 'npm install && pm2 start ecosystem.config.js --env production',
      ssh_options: ['StrictHostKeyChecking=no', 'PasswordAuthentication=no'],
    },
    staging: {
      user: 'deploy',
      host: 'staging-server',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/qui-browser.git',
      path: '/var/www/qui-browser-staging',
      'post-deploy': 'npm install && npm run test && pm2 reload ecosystem.config.js --env staging',
    },
  },
};

// PM2 进程管理（不用 Docker 时的替代方案）
// 用法：pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'yitong-server',
      script: 'apps/server/dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        CHAT_WS_PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        CHAT_WS_PORT: 3001,
      },
    },
  ],
};

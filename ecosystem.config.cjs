module.exports = {
  apps: [
    {
      name: "claude-teams-web",
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 8386,
      },
    },
    {
      name: "claude-teams-cron",
      script: "npx",
      args: "tsx scripts/cron-worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

import { buildApp } from './index.js';

const HOST = process.env.API_HOST ?? '0.0.0.0';
const PORT = Number(process.env.API_PORT) || 3001;

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`🚀 API server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

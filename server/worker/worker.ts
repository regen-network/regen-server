import { run, Runner } from 'graphile-worker';

export async function main(pgPool): Promise<Runner> {
  // Run a worker to execute jobs:
  const runner = await run({
    pgPool,
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000,
    taskDirectory: `${__dirname}/dist`,
  });
  return runner;
}

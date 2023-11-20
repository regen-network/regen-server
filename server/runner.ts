import { Runner } from 'graphile-worker';
import { main as workerMain } from './worker/worker';
import { pgPool } from 'common/pool';

const runnerPromise: Promise<Runner> = new Promise((resolve, reject) => {
  workerMain(pgPool)
    .then(res => {
      resolve(res);
    })
    .catch(err => {
      console.error(err);
      reject(err);
      process.exit(1);
    });
});

export { runnerPromise };

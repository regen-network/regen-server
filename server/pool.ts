import { Pool, Client, PoolConfig } from 'pg';
import * as fs from 'fs';
import { main as workerMain } from './worker/worker';
import { pgPool } from 'common/utils';

const runnerPromise = new Promise((resolve, reject) => {
  workerMain(pgPool)
    .then((res) => {
      resolve(res);
    })
    .catch((err) => {
      console.error(err);
      reject(err);
      process.exit(1);
    });
});

exports.runnerPromise = runnerPromise;

import * as express from 'express';
import { expressSharp, HttpAdapter, S3Adapter } from 'express-sharp';
import KeyvRedis from '@keyv/redis';
import Keyv from 'keyv';
import Redis from 'ioredis';

class InvalidRedisURLError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRedisURLError';
  }
}

export default function imageOptimizer(): express.Router {
  let imageAdapter;
  let imageCache = null;

  const redisUrl = process.env.REDIS_URL;
  if (process.env.REDIS_URL) {
    let redis: Redis;
    let keyvRedis: KeyvRedis;
    if (redisUrl.startsWith('rediss://')) {
      console.log('Attempting to connect to Redis with TLS..');
      const options = { tls: { rejectUnauthorized: false } };
      redis = new Redis(redisUrl, options);
      // there is a bug in KeyvRedis which required me to also
      // pass tls options there, otherwise it gets overridden.
      // without this, you will see ECONNRESET errors when the
      // application tries to connect to redis.
      keyvRedis = new KeyvRedis(redis, options);
    } else if (redisUrl.startsWith('redis://')) {
      redis = new Redis(redisUrl);
      keyvRedis = new KeyvRedis(redis);
    } else {
      throw new InvalidRedisURLError(
        `REDIS_URL must start with redis:// or rediss://, it's value was ${redisUrl}`,
      );
    }
    redis.on('error', function (err) {
      console.error('Error from ioredis.Redis:', err);
    });
    imageCache = new Keyv({ store: keyvRedis, namespace: 'image' });
    // Handle DB connection errors
    imageCache.on('error', function (err) {
      console.log('Error from keyv.Keyv:', err);
    });
  }

  if (process.env.AWS_ACCESS_KEY_ID) {
    const bucketName = process.env.AWS_S3_BUCKET;
    imageAdapter = new S3Adapter(bucketName);
    console.log('Using S3 image adapter');
  } else {
    imageAdapter = new HttpAdapter({
      prefixUrl: process.env.IMAGE_STORAGE_URL,
    });
  }

  return expressSharp({
    cache: imageCache,
    imageAdapter,
  });
}

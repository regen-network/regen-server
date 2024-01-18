import * as fs from 'fs';
import * as express from 'express';
import { expressSharp, HttpAdapter, S3Adapter } from 'express-sharp';
import { KeyvAnyRedis } from 'keyv-anyredis';
import Keyv from 'keyv';
import Redis from 'ioredis';
import KeyvBrotli from '@keyv/compress-brotli';

class InvalidRedisURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRedisURLError';
  }
}

class InvalidCacheBackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCacheBackendError';
  }
}

export default function imageOptimizer(): express.Router {
  return null;
  // let imageAdapter: S3Adapter | HttpAdapter;
  // let imageCache = null;
  // const imageCachingBackend = process.env.IMAGE_CACHING_BACKEND || 'postgres';
  // const redisUrl = process.env.REDISCLOUD_URL;
  // let redis: Redis;
  // let keyvRedis: KeyvAnyRedis;
  // switch (imageCachingBackend) {
  //   case 'postgres':
  //     console.log('using postgres as the backend for image caching');
  //     console.log(
  //       "the cache info will be stored in the 'utilities.keyv' table",
  //     );
  //     // the staging and production postgres database requires an SSL connection.
  //     // therefore we must include ssl options to the Keyv constructor.
  //     //
  //     // you can view our database configurations in the parameter group for our databases in AWS RDS.
  //     // i.e. you will be able to see client SSL settings that we are using.
  //     //
  //     // more info available here:
  //     // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html
  //     if (process.env.NODE_ENV === 'production') {
  //       console.log('connecting to postgres for image caching with ssl...');
  //       imageCache = new Keyv(process.env.DATABASE_URL, {
  //         compression: new KeyvBrotli(),
  //         ssl: {
  //           ca: fs.readFileSync(
  //             `${__dirname}/../../config/rds-combined-ca-bundle.pem`,
  //           ),
  //         },
  //         table: 'utilities.keyv',
  //       });
  //     } else {
  //       imageCache = new Keyv(process.env.DATABASE_URL, {
  //         compression: new KeyvBrotli(),
  //         table: 'utilities.keyv',
  //       });
  //     }
  //     imageCache.on('error', function (err) {
  //       console.log('Error from keyv.Keyv:', err);
  //     });
  //     break;
  //   case 'redis':
  //     console.log('using redis as the backend for image caching');
  //     console.log(redisUrl);
  //     if (redisUrl.startsWith('rediss://')) {
  //       console.log('Attempting to connect to Redis with TLS..');
  //       const options = { tls: { rejectUnauthorized: false } };
  //       redis = new Redis(redisUrl, options);
  //       // there is a bug in KeyvRedis which required me to also
  //       // pass tls options there, otherwise it gets overridden.
  //       // without this, you will see ECONNRESET errors when the
  //       // application tries to connect to redis.
  //       keyvRedis = new KeyvAnyRedis(redis);
  //     } else if (redisUrl.startsWith('redis://')) {
  //       redis = new Redis(redisUrl);
  //       keyvRedis = new KeyvAnyRedis(redis);
  //     } else {
  //       throw new InvalidRedisURLError(
  //         `REDISCLOUD_URL must start with redis:// or rediss://, it's value was ${redisUrl}`,
  //       );
  //     }
  //     redis.on('error', function (err) {
  //       console.error('Error from ioredis.Redis:', err);
  //     });
  //     imageCache = new Keyv({
  //       store: keyvRedis,
  //       namespace: 'image',
  //       compression: new KeyvBrotli(),
  //     });
  //     // Handle DB connection errors
  //     imageCache.on('error', function (err) {
  //       console.log('Error from keyv.Keyv:', err);
  //     });
  //     break;
  //   default:
  //     throw new InvalidCacheBackendError(
  //       `${imageCachingBackend} is not supported, use redis or postgres.`,
  //     );
  // }

  // if (process.env.AWS_ACCESS_KEY_ID) {
  //   const bucketName = process.env.AWS_S3_BUCKET;
  //   imageAdapter = new S3Adapter(bucketName);
  //   console.log(
  //     `Using S3 image adapter, images will be read from bucket: ${bucketName}`,
  //   );
  // } else {
  //   imageAdapter = new HttpAdapter({
  //     prefixUrl: process.env.IMAGE_STORAGE_URL,
  //   });
  // }

  // return expressSharp({
  //   cache: imageCache,
  //   imageAdapter,
  // });
}

type GetS3ImageCachedUrlParams = {
  url: string;
  reqProtocol: string;
  reqHost: string;
};

export function getS3ImageCachedUrl({
  url,
  reqProtocol,
  reqHost,
}: GetS3ImageCachedUrlParams) {
  return url.replace(
    process.env.IMAGE_STORAGE_URL,
    `${reqProtocol}://${reqHost}/marketplace/v1/image`,
  );
}

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
  'image/svg+xml',
];

import * as express from 'express';
import * as bodyParser from 'body-parser';
import { expressSharp, HttpAdapter, S3Adapter } from 'express-sharp';
const Keyv = require('keyv');

export default function imageOptimizer(): express.Router {
  let imageAdapter;
  let imageCache = null;
  
  if (process.env.REDIS_URL) {
    imageCache = new Keyv(process.env.REDIS_URL, { namespace: 'image' });
    // Handle DB connection errors
    imageCache.on('error', err => console.log('Redis Connection Error', err));
  }
  
  if (process.env.AWS_ACCESS_KEY_ID) {
    const bucketName = process.env.AWS_S3_BUCKET
    imageAdapter = new S3Adapter(bucketName)
    console.log('Using S3 image adapter');
  } else {
    imageAdapter = new HttpAdapter({ prefixUrl: process.env.IMAGE_STORAGE_URL });
  }
  

  const router = expressSharp({
    cache: imageCache,
    imageAdapter,
  });

  // router.get('/image', bodyParser.json(), (request, response: express.Response) => {
    
  // });

  router.post('/image', bodyParser.json(), (request, response: express.Response) => {
    console.log('***REQUEST*** : ', request);

    response.set('imageUrl', 'test');
    return response;
  });

  return router;
}



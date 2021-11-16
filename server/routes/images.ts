import * as express from 'express';
import * as bodyParser from 'body-parser';
const S3 = require('aws-sdk/clients/s3')
const { Readable } = require('stream');

const bucketName = process.env.AWS_S3_BUCKET
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey
})

const router = express.Router();

interface MulterRequest extends express.Request {
  files: any;
  file: any;
}

router.post('/images', bodyParser.json(), (request, response: express.Response) => {

  const mult  = (request as MulterRequest);
  // console.log('***files*** : ', mult.files);

  // // Configure the file stream and obtain the upload parameters
  const fileStream = Readable.from(mult.files.image.data);

  const uploadParams = {
    Bucket: `${bucketName}/projects/test`,
    Key: `${mult.files.image.name}.jpg`,
    Body: fileStream
  };

  fileStream.on('error', function(err) {
    console.log('XOXOXOXOXOXOXOXOXOX  File Error: ', err);
  });

  // console.log('***uploadParams*** : ', uploadParams);
  
  // call S3 to retrieve upload file to specified bucket
  s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log("s3 Error", err);
      response.status(500).send({Error: err});
    } if (data) {
      console.log("Upload Success", data);
      response.set('imageUrl', data.Location);
      response.send({imageUrl: data.Location})
    }
  });

});

module.exports = router;

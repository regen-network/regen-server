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

interface FilesRequest extends express.Request {
  files: {
    image: {
      data: File,
      name: string,
    }
  };
}

router.post('/file', bodyParser.json(), (request, response: express.Response) => {
  const image  = (request as FilesRequest).files.image;
  const key  = request.body.filePath;
  const fileStream = Readable.from(image.data);

  const uploadParams = {
    Bucket: `${bucketName}/${key}`,
    Key: `${image.name}`,
    Body: fileStream
  };

  fileStream.on('error', function(err) {
    console.log('File Error: ', err);
  });

  s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log('s3 Error', err);
      response.status(500).send({Error: err});
    } if (data) {
      response.send({imageUrl: data.Location})
    }
  });
});

router.delete('/images/:projectId/:key', bodyParser.json(), (request, response: express.Response) => {
  const projectId = request.params.projectId;
  const key = request.params.key;

  const deleteParams = {
    Bucket: `${bucketName}/projects/${projectId}`,
    Key: key,
  };

  s3.deleteObject(deleteParams, function (err, data) {
    if (err) {
      console.log('s3 Error', err);
      response.status(500).send(err);
    } if (data) {
      response.send('File successfully deleted')
    }
  });
});

module.exports = router;

import * as express from 'express';
import * as bodyParser from 'body-parser';
const S3 = require('aws-sdk/clients/s3')

const bucketName = process.env.AWS_S3_BUCKET
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey
})

const multer  = require('multer');
const fs = require('fs');
const path = require('path');

const { Readable } = require('stream');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '/uploads/'));
  },
  filename: function(req, file, cb) {
    cb(null, new Date().toISOString() + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // reject a file
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: fileFilter
});

const router = express.Router();

interface MulterRequest extends express.Request {
  files: any;
  file: any;
}

router.post('/images', bodyParser.json(), (request, response: express.Response) => {

  // console.log('***REQUEST*** : ', request.file);
  const mult  = (request as MulterRequest);
  // console.log('***files*** : ', mult.files);

  const fileStream = Readable.from(mult.files.image.data.toString());

  var uploadParams = {Bucket: `${bucketName}/projects/`, Key: '', Body: ''};

  // // Configure the file stream and obtain the upload parameters

  fileStream.on('error', function(err) {
    console.log('XOXOXOXOXOXOXOXOXOX  File Error: ', err);
  });


  uploadParams.Body = fileStream;
  uploadParams.Key = mult.files.image.name;

  console.log('***uploadParams*** : ', uploadParams);

  
  // call S3 to retrieve upload file to specified bucket
  s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log("s3 Error", err);
    } if (data) {
      console.log("Upload Success", data.Location);
      response.set('imageUrl', data.Location);
      response.send({imageUrl: data.Location})
    }
  });

});

module.exports = router;

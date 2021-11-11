import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as AWS from 'aws-sdk';
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
// const upload = multer({ dest: 'uploads/' });

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
    fileSize: 1024 * 1024 * 5
  },
  fileFilter: fileFilter
});

const router = express.Router();

interface MulterRequest extends express.Request {
  files: any;
  file: any;
}



AWS.config.update({region: 'us-west-2'});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
// call S3 to retrieve upload file to specified bucket

router.post('/images', upload.single('xyz'), (request, response: express.Response) => {

  // console.log('***REQUEST*** : ', request);
  const mult  = (request as MulterRequest);
  console.log('***request*** : ', request);
  
  // var file = request.files;
  // console.log('***file*** : ', file);
  
  var uploadParams = {Bucket: process.env.AWS_S3_BUCKET, Key: '', Body: ''};
  
  // // Configure the file stream and obtain the upload parameters
  var fileStream = fs.createReadStream(mult.files.image.data);
  fileStream.on('error', function(err) {
    console.log('XOXOXOXOXOXOXOXOXOX  File Error: ', err);
  });
  // console.log('***fileStream*** : ', fileStream);


  uploadParams.Body = fileStream;
  uploadParams.Key = 'hello';
  
  // call S3 to retrieve upload file to specified bucket
  s3.upload (uploadParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    } if (data) {
      console.log("Upload Success", data.Location);
      response.set('imageUrl', data.Location);
    }
  });

  response.send('okok')
});

module.exports = router;

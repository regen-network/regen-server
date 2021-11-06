import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as AWS from 'aws-sdk';
const multer = require('multer');
const upload = multer({dest: 'uploads/'})

const router = express.Router();

interface MulterRequest extends express.Request {
  files: any;
}



AWS.config.update({region: 'us-west-2'});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
// call S3 to retrieve upload file to specified bucket


router.post('/images', upload.single('image'), (request, response: express.Response) => {

  const file  = (request as unknown as MulterRequest).files;
  console.log('***REQUEST*** : ', file);
  // var file = request.files;
  // console.log('***file*** : ', file);
  
  var uploadParams = {Bucket: process.env.AWS_S3_BUCKET, Key: '', Body: ''};
  
  // // Configure the file stream and obtain the upload parameters
  var fs = require('fs');
  var fileStream = fs.createReadStream(file.image);
  fileStream.on('error', function(err) {
    console.log('File Error', err);
  });
  uploadParams.Body = fileStream;
  var path = require('path');
  uploadParams.Key = path.basename(file);
  
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

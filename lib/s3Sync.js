var s3    = require('s3'),
    https = require('https'),
    http  = require('http'),
    async = require('async'),
    client;

module.exports = {
  createClient: function(options, accessKey, secretKey) {
    options.client.s3Options = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    };

    console.log(options);

    client = s3.createClient(options.client);

    http.globalAgent.maxSockets = https.globalAgent.maxSockets = 20;
  },

  download: function(params, callback) {
    console.log(params);
    var downloader = client.downloadDir(params);

    downloader.on('error', function(err) {
      console.error("unable to sync:", err);
    });

    downloader.on('end', function() {
      if (callback) {
        callback();
      }
    });
  },

  upload: function(params, callback, error) {
    var uploader = client.uploadDir(params);

    uploader.on('error', function(err) {
      console.error("unable to sync:", err.stack);
      if (error) {
        error();
      }
    });
    uploader.on('end', function() {
      console.log("done uploading");
      if (callback) {
        callback();
      }
    });
  },

  deleteDir: function(params, callback, error) {
    var eraser = client.deleteDir(params);

    eraser.on('error', function(err) {
      console.error("unable to delete:", err.stack);
      if (error) {
        error();
      }
    });
    eraser.on('end', function() {
      console.log("done erasing");
      if (callback) {
        callback();
      }
    });
  },

  moveDir: function(params, destParams, callback) {
    var list = client.listObjects({s3Params: params}, true),
        files;

    var done = function(err) {
      if (err) console.log(err);
      
      callback();
    };

    list.on('data', function(data) {
      async.each(data.Contents, function(file, cb) {
        var moveParams = {
          Bucket: destParams.Bucket,
          CopySource: destParams.Bucket + '/' + file.Key,
          Key: file.Key.replace(params.Prefix, destParams.Prefix)
        };
        var mover = client.moveObject(moveParams);

        mover.on('end', function(data) {
          console.log('moved: ', data);
          cb();
        });
      }, done);
    });
  },

  uploadFile: function(params, callback, error) {
    var uploader = client.uploadFile(params);

    uploader.on('error', function(err) {
      console.error("unable to upload:", err.stack);
      if (error) {
        error();
      }
    });

    uploader.on('end', function() {
      console.log("done uploading file.");
      if (callback) {
        callback();
      }
    });
  }
};
var s3    = require('s3'),
    https = require('https'),
    http  = require('http'),
    client;

module.exports = {
  createClient: function(options, accessKey, secretKey) {
    options.client.s3Options = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    };

    console.log(options);

    client = s3.createClient(options);

    // http.globalAgent.maxSockets = https.globalAgent.maxSockets = 20;
  },

  download: function(params, callback, error) {
    var downloader = client.downloadDir(params);

    downloader.on('error', function(err) {
      console.error("unable to sync:", err.stack);
      if (error) {
        error();
      }
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
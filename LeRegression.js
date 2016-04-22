var args = process.argv.slice(2);
var s3 = require('s3');
var s3config = require(args[0]);
var isRemoteReference = false;
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    child;

s3config.client.s3Options = {
  accessKeyId: args[1],
  secretAccessKey: args[2]
};

var client = s3.createClient(s3config.client);


/**
 * STEPS:
 * 1. ✔︎ Check for reference folder (non empty s3 bucket)
 * 2. ✔︎ Download it if there is one
 * 3. Delete local regression SS folder if it exists
 * 4. ✔︎ Run regression tests on Browserstack
 * 5. ✔︎ Upload regression folder
 * 6. If there was no reference folder, duplicate regression one on s3
 * 7. Remove Compare folder if it exists
 * 8. Compare if there is a reference folder
 * 9. Upload compare folder
 * 10. Build HTML file
 * 11. Upload HTML
 * 12. Do some kind of magic to tell github or something
 * 13. If we're on master or if it's been approved idk, make regression folder the new reference folder on s3
 */

init();


function init() {
  downloadRemoteReference();
  takeScreenshots();
}

/**
 * STEP 1
 */
// This may be overkill
// function checkForRemoteReference() {
//   var list = client.listObjects({
//     s3Params: {
//       Bucket: s3config.bucket.name
//     }
//   });

//   list.on('error', function(err) {
//     console.error("unable to sync:", err.stack);
//   });
//   list.on('end', function() {
//     console.log("done listing", list.dirsFound, list.objectsFound);
//     if (list.objectsFound) {
//       isRemoteReference = true;
//       downloadRemoteReference();
//     }
//   });
// }

/**
 * STEP 2
 */
function downloadRemoteReference() {
  var params = {
    localDir: "./test/reference",

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "reference/"
    },
  },
  downloader = client.downloadDir(params);

  downloader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  downloader.on('progress', function() {
    console.log("progress", downloader.progressAmount, downloader.progressTotal, downloader.progressAmount, downloader.progressTotal, downloader.progressMd5Amount, downloader.progressMd5Total, downloader.deleteAmount, downloader.deleteTotal, downloader.filesFound, downloader.objectsFound, downloader.doneFindingFiles, downloader.doneFindingObjects, downloader.doneMd5);
  });
  downloader.on('end', function() {
    console.log("done downloading");
  });
}

/**
 * STEP 4
 */
function takeScreenshots() {
  child = exec('protractor ./config/regression-desktop.conf.js & protractor ./config/regression-mobile.conf.js & wait', // command line argument directly in string
    function (error, stdout, stderr) {      // one easy function to capture data/errors
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      uploadRegressionDirectory();
      if (error !== null) {
        console.log('exec error: ' + error);
      }
  });
}

/**
 * STEP 5
 */
function uploadRegressionDirectory() {
  var params = {
    localDir: "./test/regression",

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "regression/"
    },
  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  uploader.on('progress', function() {
    console.log("progress", uploader.progressAmount, uploader.progressTotal);
  });
  uploader.on('end', function() {
    console.log("done uploading");
    if (!isRemoteReference) {
    }
    checkForLocalReference();
  });
}

/**
 * STEP 6
 */
function duplicateRemoteRegression() {
  // Need to make this much better so we duplicate it on s3 instead or re-uploading the whole thing
  var params = {
    localDir: "./test/regression",

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "reference/"
    },
  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  uploader.on('progress', function() {
    console.log("progress", uploader.progressAmount, uploader.progressTotal);
  });
  uploader.on('end', function() {
    process.exit();
    console.log("done uploading");
  });
}

/**
 * STEP 8.1
 */
function checkForLocalReference() {
  fs.exists('test/reference', function(exists) {
    if (exists) {
      console.log('reference!');
      compareScreenshots();
    } else {
      console.log('no reference!');
      duplicateRemoteRegression();
    }
  });
}

/**
 * STEP 8.2
 */
function compareScreenshots() {
  var refPath = path.join(__dirname, './test/reference');
  var regPath = path.join(__dirname, './test/regression');

  child = execFile('./compare.sh', [refPath, regPath], // command line argument directly in string
    function (error, stdout, stderr) {      // one easy function to capture data/errors
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }
  });
}

// var params = {
//   localFile: "testDump/test.txt",

//   s3Params: {
//     Bucket: s3config.bucket.name,
//     Key: "test/testfile.txt"
//   },
// };
// var downloader = client.downloadFile(params);
// downloader.on('error', function(err) {
//   console.error("unable to download:", err.stack);
// });
// downloader.on('progress', function() {
//   console.log("progress", downloader.progressAmount, downloader.progressTotal);
// });
// downloader.on('end', function() {
//   console.log("done downloading");
// });

var params = {
  localDir: "./test/reference",

  s3Params: {
    Bucket: s3config.bucket.name,
    Prefix: "reference/"
  },
};

// Download a directory
// var downloader = client.downloadDir(params);
// downloader.on('error', function(err) {
//   console.error("unable to sync:", err.stack);
// });
// downloader.on('progress', function() {
//   console.log("progress", downloader.progressAmount, downloader.progressTotal, downloader.progressAmount, downloader.progressTotal, downloader.progressMd5Amount, downloader.progressMd5Total, downloader.deleteAmount, downloader.deleteTotal, downloader.filesFound, downloader.objectsFound, downloader.doneFindingFiles, downloader.doneFindingObjects, downloader.doneMd5);
// });
// downloader.on('fileDownloadStart', function() {
//   console.log("gneuh");
// });
// downloader.on('fileDownloadStart', function() {
//   console.log("gneuh");
// });
// downloader.on('end', function() {
//   console.log("done downloading");
// });

//Check if a reference exists
// client.s3.headObject({
//   Bucket: s3config.bucket.name,
//   Key: 'regression'
// }, function(err, data) {
//   if (err) {
//     console.log(err);
//     // file does not exist (err.statusCode == 404)
//     return;
//   }
//   console.log('yes');
//   // file exists
// });

var params = {
  localDir: "./test",

  s3Params: {
    Bucket: s3config.bucket.name,
    Prefix: "test/"
  },
};

//Upload a directory
// var uploader = client.uploadDir(params);
// uploader.on('error', function(err) {
//   console.error("unable to sync:", err.stack);
// });
// uploader.on('progress', function() {
//   console.log("progress", uploader.progressAmount, uploader.progressTotal);
// });
// uploader.on('end', function() {
//   console.log("done uploading");
// });

// var mustache = require('mustache');

// var view = {
//   title: "Joe",
//   calc: function() {
//     return 2 + 4;
//   }
// };

// var template = "{{title}} spends {{calc}}";

// var html = mustache.to_html(template, view);

// console.log(html);
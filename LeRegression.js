var args = process.argv.slice(2);
var s3 = require('s3');
var s3config = require(args[0]);
var isRemoteReference = false;
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec,
    execFile = require('child_process').execFile,
    child;
var refPath = path.join(__dirname, './test/reference');
var regPath = path.join(__dirname, './test/regression');
var comparePath = path.join(__dirname, './test/compare');
var rimraf = require('rimraf');
var handlebars = require('handlebars');
var dirTree = require('directory-tree');
var AWS = require('aws-sdk');

s3config.client.s3Options = {
  accessKeyId: args[1],
  secretAccessKey: args[2]
};

var client = s3.createClient(s3config.client);
// 
var s3 = new AWS.S3();

//

/**
 * STEPS:
 * 1. ✔︎ Check for reference folder (non empty s3 bucket)
 * 2. ✔︎ Download it if there is one
 * 3. ✔︎ Delete local regression SS folder if it exists
 * 4. ✔︎ Run regression tests on Browserstack
 * 5. ✔︎ Upload regression folder
 * 6. ✔︎ If there was no reference folder, duplicate regression one on s3
 * 7. ✔︎ Remove Compare folder if it exists
 * 8. ✔︎ Compare if there is a reference folder
 * 9. ✔︎ Upload compare folder
 * 10. ✔︎ Build HTML file
 * 11. Upload HTML
 * 12. Do some kind of magic to tell github or something
 * 13. If we're on master or if it's been approved idk, make regression folder the new reference folder on s3
 */

init();

function setACL(localFile, stat, callback) {
  // call callback like this:
  var s3Params = { // if there is no error
    // ACL: 'public-read', // just an example
  };
  // pass `null` for `s3Params` if you want to skip uploading this file.
  callback(null, s3Params);
}

function test() {
  var params = {Bucket: 'leregression', Key: 'test.html', Body: 'Hello!'};

  s3.putObject(params, function(err, data) {

      if (err)       

          console.log(err);     

      else console.log("Successfully uploaded data to myBucket/myKey");   

   });
}

function init() {
  // test();
  clean();
  // buildHTMLFile();
}

function clean() {
  // This is awful but can be fixed easily. later though
  rimraf(refPath, function() {
    rimraf(regPath, function() {
      rimraf(comparePath, function() {
        downloadRemoteReference();
        takeScreenshots();
      });
    });
  });
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
    localDir: refPath,

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "reference/"
    },

    getS3Params: setACL
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
  child = exec('node_modules/protractor/bin/protractor ./config/regression-desktop.conf.js & node_modules/protractor/bin/protractor ./config/regression-mobile.conf.js & wait', // command line argument directly in string
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
    localDir: regPath,

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "regression/"
    },

    getS3Params: setACL
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
    localDir: regPath,

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "reference/"
    },

    getS3Params: setACL
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
  fs.exists(refPath, function(exists) {
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
  child = execFile('./compare.sh', [refPath, regPath], // command line argument directly in string
    function (error, stdout, stderr) {      // one easy function to capture data/errors
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      uploadComparedFiles();
      buildHTMLFile();
      if (error !== null) {
        console.log('exec error: ' + error);
      }
  });
}

/**
 * STEP 9
 */
function uploadComparedFiles() {
  var params = {
    localDir: comparePath,

    s3Params: {
      Bucket: s3config.bucket.name,
      Prefix: "compare/"
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
    
  });
}

/**
 * STEP 10 or something
 */
function buildHTMLFile() {
  var view = {
    "data": {
      "images": [
        "Home.png",
        "Home2.png"
      ]
    }
  };

  var fileStructure = dirTree('test/compare/');

  console.log(fileStructure.children[0]);

  fs.readFile(path.join(__dirname, 'view/template.html'), function(err, data){
    if (!err) {
      // make the buffer into a string
      var source = data.toString();
      // call the render function
      renderToString(source, fileStructure);
    } else {
      // handle file read error
    }
  });

  // this will be called after the file is read
  function renderToString(source, data) {
    var template = handlebars.compile(source);
    var outputString = template(data);
    console.log(outputString);
    fs.writeFile("view/rendered.html", outputString, function(err) {
      if(err) {
          return console.log(err);
      }

      console.log("The file was saved!");
      uploadHTML();
    }); 
  }

  function uploadHTML() {
    var params = {
      localFile: "view/rendered.html",

      s3Params: {
        Bucket: s3config.bucket.name,
        Key: "compare.html",
        ACL: 'public-read'
      },
    };
    var uploader = client.uploadFile(params);
    uploader.on('error', function(err) {
      console.error("unable to upload:", err.stack);
    });
    uploader.on('progress', function() {
      console.log("progress", uploader.progressMd5Amount,
                uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', function() {
      console.log("done uploading");
    });
  }

  // var template = path.join(__dirname, 'view/template.html');

  // var compiledTemplate = handlebars.compile(template);
  // console.log(compiledTemplate(view));

  // , view)
  //   .on('data', function (data) {
  //     // console.log(data);
  //     console.log(data.toString());
  //   });

  // var html = mustache.to_html(template, view);

  // console.log(html);
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
  localDir: refPath,

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
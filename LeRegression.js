#!/usr/bin/env node

var s3                = require('s3'),
    fs                = require('fs'),
    path              = require('path'),
    exec              = require('child_process').exec,
    https             = require('https'),
    rimraf            = require('rimraf'),
    dirTree           = require('directory-tree'),
    execFile          = require('child_process').execFile,
    handlebars        = require('handlebars'),
    program           = require('commander'),
    refPath           = '/tmp/leregression/reference/',
    regPath           = '/tmp/leregression/regression/',
    comparePath       = '/tmp/leregression/compare',
    isRemoteReference = false,
    githubToken,
    commitHash,
    threshold,
    s3config,
    options,
    config,
    client;

program
  .option('-c, --config-file [config-file]', 'Configuration JSON')
  .option('-a, --access-key-id [access-key-id]', 'S3 Access Key')
  .option('-s, --secret-access-key [secret-access-key]', 'S3 Secret Access Key. These should be set as env variables in your CI environment')
  .option('-h, --commit-hash [commit-hash]', 'Hash of the current commit')
  .option('-t, --github-token [github-token]', 'GitHub access token')
  .parse(process.argv);

config = JSON.parse(fs.readFileSync(program.configFile, 'utf8'));

threshold = config.threshold;
s3config = config.s3config;

s3config.client.s3Options = {
  accessKeyId: program.accessKeyId,
  secretAccessKey: program.secretAccessKey
};

commitHash  = program.commitHash;
githubToken = program.githubToken;

options = {
  host: 'api.github.com',
  path: config.repository + '/commits/' + commitHash + '/statuses',
  headers: {
    'User-Agent': 'LeRegression',
    'Authorization': 'token ' + githubToken
  }
};

client = s3.createClient(s3config.client);

init();

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
 * 12. ✔︎ Do some kind of magic to tell github or something
 * 13. If we're on master or if it's been approved idk, make regression folder the new reference folder on s3
 */

function init() {
  rimraf('/tmp/leregression/', function() {
    fs.mkdirSync('/tmp/leregression/');
    fs.createReadStream(config.sitemap).pipe(fs.createWriteStream('/tmp/leregression/sitemap.json'));
    fs.createReadStream(path.join(__dirname, 'spec/regression.spec.js')).pipe(fs.createWriteStream('/tmp/leregression/regression.spec.js'));
    clean();
  });
}

function clean() {
  // This is awful but can be fixed easily. later though
  rimraf(refPath, function() {
    rimraf(regPath, function() {
      downloadRemoteReference();
      takeScreenshots();
    });
  });
}

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


  },
  downloader = client.downloadDir(params);

  downloader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  downloader.on('end', function() {
    console.log("done downloading");
  });
}

/**
 * STEP 4
 */
function takeScreenshots() {
  var command = '';

  for (var i = 0; i < config.capabilities.length; i++) {
    var capability = config.capabilities[i];
    command += (process.env.PROTRACTOR_BIN || 'protractor') + ' ' + capability + ' & ';
  }
  command += 'wait';

  var child = exec(command,
    function (error, stdout, stderr) {
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
      Prefix: "regression/",
      ACL: 'public-read'
    },


  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
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
      Prefix: "reference/",
      ACL: 'public-read'
    },


  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
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
  var fileStructure = dirTree(refPath),
      child,
      callbackCount = 0,
      count = 0;

  console.log(fileStructure);

  function computeResult(resolution, image) {
    return function (error, stdout, stderr) {
      console.log(stderr);
      callbackCount++;
      if (stderr < threshold) {
        rimraf(path.join(comparePath, resolution, image), function() {
          console.log('✔︎ No regression');
        });
      } else {
        console.log('✘ Regression detected!');
      }

      if (callbackCount === count) {
        uploadComparedFiles();
        buildHTMLFile();
      }
    };
  }

  rimraf(comparePath, function() {
    fs.mkdirSync(comparePath);

    for (var i = 0; i < fileStructure.children.length; i++) {
      var resolution = fileStructure.children[i].name;

      fs.mkdirSync(path.join(comparePath, resolution));

      for (var j = 0; j < fileStructure.children[i].children.length; j++) {
        var image = fileStructure.children[i].children[j].name;

        count++;

        exec('compare -metric AE -fuzz 15% ' +
             path.join(refPath, resolution, image) + ' ' +
             path.join(regPath, resolution, image) + ' ' +
             path.join(comparePath, resolution, image),
             computeResult(resolution, image));
      }
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
      Prefix: "compare/",
      ACL: 'public-read'
    },
  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  uploader.on('end', function() {
    console.log("done uploading");

  });
}

/**
 * STEP 10 or something
 */
function buildHTMLFile() {
  var fileStructure = dirTree(comparePath);
  console.log(fileStructure);

  if (!fileStructure.children.length) {
    process.exit();
  }

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

    data.hash  = commitHash;
    data.token = githubToken;

    var outputString = template(data);
    console.log(outputString);
    fs.writeFile("/tmp/rendered.html", outputString, function(err) {
      if(err) {
          return console.log(err);
      }

      console.log("The file was saved!");
      uploadHTML();
    });
  }

}

function uploadHTML() {
  var params = {
    localFile: "/tmp/rendered.html",

    s3Params: {
      Bucket: s3config.bucket.name,
      Key: 'compare'+ commitHash +'.html',
      ACL: 'public-read'
    },
  };

  var uploader = client.uploadFile(params);

  uploader.on('error', function(err) {
    console.error("unable to upload:", err.stack);
  });

  uploader.on('end', function() {
    console.log("done uploading");
    getGitStatus();
  });
}

function getGitStatus() {
  var callback = function(response) {
    var output = '';

    response.on('data', function(data) {
      output += data;
    });

    response.on('end', function() {
      if (JSON.parse(output)[0].state === 'pending') {
        console.log('Awaiting user input from Github');
        setTimeout(function() {
          getGitStatus();
        }, 3600);
      } else {
        // everything is good
        postGitStatus(JSON.parse(output)[0].state);
      }
    });
  };

  https.request(options, callback).end();
}

function postGitStatus(status) {
  options.method = 'POST';

  var request = https.request(options);

  var url = 's3-eu-west-1.amazonaws.com/leregression/compare' + commitHash +
            '.html';

  var content = {
    'status': status,
    'target_url': url,
    'context': 'LeRegression'
  };

  switch (status) {

    case 'success':
      content.description = 'Regression tests passed!';
      break;

    case 'pending':
      content.description = 'Awaiting user input!';
      break;

    case 'failure':
      content.description = 'Regression tests failed!';
      break;

  }

  request.write(JSON.stringify(content));
  request.end();
}

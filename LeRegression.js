#!/usr/bin/env node

var s3Sync            = require('./lib/s3Sync'),
    folders           = require('./lib/folders'),
    image             = require('./lib/image'),
    html              = require('./lib/html'),
    github            = require('./lib/github'),
    path              = require('path'),
    fs                = require('fs'),
    https             = require('https'),
    rimraf            = require('rimraf'),
    dirTree           = require('directory-tree'),
    program           = require('commander'),
    isRemoteReference = false,
    config;

program
  .option('-c, --config-file [config-file]', 'Configuration JSON')
  .option('-a, --access-key-id [access-key-id]', 'S3 Access Key')
  .option('-s, --secret-access-key [secret-access-key]', 'S3 Secret Access Key. These should be set as env variables in your CI environment')
  .option('-h, --commit-hash [commit-hash]', 'Hash of the current commit')
  .option('-t, --github-token [github-token]', 'GitHub access token')
  .option('-r, --reset-reference', 'The script will only create reference files')
  .parse(process.argv);

init();

function init() {
  config = JSON.parse(fs.readFileSync(program.configFile, 'utf8'));

  s3Sync.createClient(config.s3config, program.accessKeyId, program.secretAccessKey);

  if (program.githubToken) {
    github.setup({
      'repository': config.repository,
      'commitHash': program.commitHash,
      'bucketName': config.s3config.bucket.name,
      'githubToken': program.githubToken
    });
  }

  if (program.resetReference) {
    folders.createSafely('/tmp/leregression/', function() {
      resetReference();
      return;
    });
  }

  folders.createSafely('/tmp/leregression/', function() {
    folders.move(config.sitemap, '/tmp/leregression/sitemap.json');
    folders.move(path.join(__dirname, 'spec/regression.spec.js'), '/tmp/leregression/regression.spec.js');

    clean();
  });
}

function clean() {
  console.log('Cleaning existing files');
  rimraf(folders.refPath, function() {
    if (!program.resetReference) {
      console.log('Downloading existing reference if there is one');
      downloadRemoteReference();
    }
  });
  rimraf(folders.regPath, function() {
    takeScreenshots();
  });
}

function resetReference() {
  console.log('resetting reference...');
  var regParams = {
    Bucket: config.s3config.bucket.name,
    Prefix: "regression/"
  };

  var refParams = {
    Bucket: config.s3config.bucket.name,
    Prefix: "reference/"
  };

  s3Sync.deleteDir(refParams, function() {
    s3Sync.moveDir(regParams, refParams, function() {
      console.log('Done!');
      process.exit();
    });  
  });
  
}

function downloadRemoteReference() {
  var params = {
    localDir: folders.refPath,

    s3Params: {
      Bucket: config.s3config.bucket.name,
      Prefix: "reference/"
    }
  };

  s3Sync.download(params, function() {
    console.log("done downloading reference");
  });
}

function takeScreenshots() {
  image.takeScreenshots(config.capabilities, function() {
    checkForLocalReference();
  });
}

function uploadRegressionDirectory() {
  console.log('uploading screenshots...');

  var params = {
    localDir: folders.regPath,

    s3Params: {
      Bucket: config.s3config.bucket.name,
      Prefix: "regression/",
      ACL: 'public-read'
    }
  };

  s3Sync.upload(params);
}

function uploadReferenceDirectory() {
  console.log('uploading reference...');

  var params = {
    localDir: folders.regPath,

    s3Params: {
      Bucket: config.s3config.bucket.name,
      Prefix: "reference/",
      ACL: 'public-read'
    }
  };

  s3Sync.upload(params, function() {
    process.exit();
  });
}

function checkForLocalReference() {
  fs.exists(folders.refPath, function(exists) {
    if (exists) {
      console.log('Reference found.');
      uploadRegressionDirectory();
      compareScreenshots();
    } else {
      console.log('No reference found.');
      uploadReferenceDirectory();
    }
  });
}

function compareScreenshots() {
  image.compareScreenshots(
    folders.refPath, 
    folders.regPath, 
    folders.comparePath, 
    config.threshold,
    buildHTMLFile
  );
}

function buildHTMLFile() {
  var params = {
    comparePath: folders.comparePath,
    commitHash : program.commitHash,
    token      : program.githubToken,
    repoPath   : github.getPath()
  };

  uploadComparedFiles();

  html.buildHTMLFile(params, function() {
    uploadHTML();
  });
}

function uploadComparedFiles() {
  console.log('uploading compared files...');

  var params = {
    localDir: folders.comparePath,

    s3Params: {
      Bucket: config.s3config.bucket.name,
      Prefix: "compare/",
      ACL: 'public-read'
    }
  };

  s3Sync.upload(params);
}

function uploadHTML() {
  var params = {
    localFile: "/tmp/rendered.html",

    s3Params: {
      Bucket: config.s3config.bucket.name,
      Key: 'compare'+ program.commitHash +'.html',
      ACL: 'public-read'
    },
  };

  s3Sync.uploadFile(params, function() {
    if (program.githubToken) {
      github.postGitStatus('pending', program.commitHash, config.s3config.bucket.name);
      github.getGitStatus();
    } else {
      process.exit();
    }
  });
}

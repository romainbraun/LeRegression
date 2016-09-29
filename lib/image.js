var dirTree = require('directory-tree'),
    folders = require('./folders'),
    exec    = require('child_process').exec,
    fs      = require('fs'),
    rimraf  = require('rimraf'),
    path    = require('path');

module.exports = {

  takeScreenshots: function(capabilities, callback) {
    var command = '';

    console.log('Taking screenshots...');

    for (var i = 0; i < capabilities.length; i++) {
      var capability = capabilities[i];

      command += (process.env.PROTRACTOR_BIN || 'protractor') + ' ' + capability + ' & ';
    }

    command += 'wait';

    exec(command, function (error, stdout, stderr) {
      console.log(error, stdout, stderr);
      console.log('Done!');

      if (callback && !error) {
        callback();
      }

      if (error !== null) {
        console.log('exec error: ' + error);
      }
    });
  },

  compareScreenshots: function(refPath, regPath, comparePath, threshold, callback) {
    var fileStructure = dirTree(refPath),
      child,
      callbackCount = 0,
      count = 0;

    console.log('comparing screenshots...');

    folders.createSafely(comparePath, function() {

      for (var i = 0; i < fileStructure.children.length; i++) {
        var resolution = fileStructure.children[i].name;

        fs.mkdirSync(path.join(comparePath, resolution));

        for (var j = 0; j < fileStructure.children[i].children.length; j++) {
          var image = fileStructure.children[i].children[j].name;

          count++;

          exec('compare -metric AE -fuzz 20% ' +
               path.join(refPath, resolution, image) + ' ' +
               path.join(regPath, resolution, image) + ' ' +
               path.join(comparePath, resolution, image),
               computeResult(resolution, image));
        }

      }

      checkForCompletion();

    });

    function checkForCompletion() {
      if (callbackCount && callbackCount === count) {
        console.log('Done comparing.');
        if (callback) {
          callback();
        }
      } else {
        setTimeout(checkForCompletion, 1000);
      }
    }

    function computeResult(resolution, image) {
      return function (error, stdout, stderr) {
        if (stderr < threshold) {
          rimraf(path.join(comparePath, resolution, image), function() {
            console.log('✔︎ No regression');
            callbackCount++;
          });
        } else {
          console.log('✘ Regression detected!');
          callbackCount++;
        }
      };
    }
  }
};
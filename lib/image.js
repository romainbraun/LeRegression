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
      console.log(stdout, stderr);
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
      var currentColumn = 0,
          currentRow = 0,
          rowCount = fileStructure.children.length,
          columnCount = fileStructure.children[currentRow].children.length;

      fs.mkdirSync(path.join(comparePath, fileStructure.children[currentRow].name));

      function compareScreenshot() {
        if (currentColumn >= columnCount) {
          currentColumn = 0;
          currentRow++;

          if (currentRow >= rowCount) {
            callback();
            return;
          }

          fs.mkdirSync(path.join(comparePath, fileStructure.children[currentRow].name));
        }

        var resolution = fileStructure.children[currentRow].name;
        var image = fileStructure.children[currentRow].children[currentColumn].name;

        exec('compare -metric AE -fuzz 20% ' +
               path.join(refPath, resolution, image) + ' ' +
               path.join(regPath, resolution, image) + ' ' +
               path.join(comparePath, resolution, image),
               computeResult(resolution, image));
      }

      function computeResult(resolution, image) {
        return function (error, stdout, stderr) {
          console.log('stderr: ',  stderr);

          if (stderr < threshold) {
            rimraf(path.join(comparePath, resolution, image), function() {
              console.log('✔︎ No regression');
              // callbackCount++;
            });
          } else {
            console.log('✘ Regression detected!');
            // callbackCount++;
          }
          currentColumn++;
          compareScreenshot();
        };
      }

      // for (var i = 0; i < fileStructure.children.length; i++) {
      //   var resolution = fileStructure.children[i].name;

      //   fs.mkdirSync(path.join(comparePath, resolution));

      //   for (var j = 0; j < fileStructure.children[i].children.length; j++) {
      //     var image = fileStructure.children[i].children[j].name;

      //     // count++;

      //     exec('compare -metric AE -fuzz 20% ' +
      //          path.join(refPath, resolution, image) + ' ' +
      //          path.join(regPath, resolution, image) + ' ' +
      //          path.join(comparePath, resolution, image),
      //          computeResult(resolution, image));
      //   }

      // }

      // checkForCompletion();
      compareScreenshot();
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

    
  }
};
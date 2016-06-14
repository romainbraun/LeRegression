var rimraf = require('rimraf'),
    fs     = require('fs');

module.exports = {
  refPath: '/tmp/leregression/reference/',

  regPath: '/tmp/leregression/regression/',

  comparePath: '/tmp/leregression/compare/',

  createSafely: function(path, callback) {
    rimraf(path, function() {
      fs.mkdir(path, callback);
    });
  },

  move: function(original, destination) {
    fs.createReadStream(original).pipe(fs.createWriteStream(destination));
  }
};
var dirTree    = require('directory-tree'),
    fs         = require('fs'),
    handlebars = require('handlebars'),
    path       = require('path');

module.exports = {

  buildHTMLFile: function(params, callback) {
    var fileStructure = dirTree(params.comparePath);

    if (!fileStructure || !fileStructure.children.length) {
      console.log('Regression checks all passed.');

      process.exit();
    }

    console.log('building HTML file');

    fs.readFile(path.join(__dirname, '../view/template.html'), function(err, data){
      if (!err) {
        var source = data.toString();

        renderToString(source, fileStructure, callback);
      } else {
        console.log('error reading template file');
      }
    });

    function renderToString(source, data, callback) {
      var template = handlebars.compile(source);

      data.hash  = params.commitHash;
      data.token = params.token;
      data.path = params.repoPath;

      var outputString = template(data);

      fs.writeFile("/tmp/rendered.html", outputString, function(err) {
        if(err) {
          return console.log(err);
        } else if (callback) {
          callback();
        }
      });
    }
  }
};
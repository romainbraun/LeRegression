var https = require('https'),
    options;

module.exports = {
  setup: function(params) {
    options = {
      host: 'api.github.com',
      path: '/repos/' + params.repository + '/statuses/' + params.commitHash,
      headers: {
        'User-Agent': params.bucketName,
        'Authorization': 'token ' + params.githubToken
      }
    };
  },

  getPath: function(){
    return options.path;
  },

  getGitStatus: function() {
    var that = this;

    var callback = function(response) {
      var output = '';

      response.on('data', function(data) {
        output += data;
      });

      response.on('end', function() {
        var data = JSON.parse(output);

        for (var i = 0; i < data.length; i++) {
          if (
            data[i].status.context === 'LeRegression' &&
            data[i].status.state !== 'pending'
          ) {
            that.postGitStatus(data[i].status.state);
          } else {
            console.log('Awaiting user input from Github');

            setTimeout(that.getGitStatus, 3600);
          }
        }

      });
    };

    https.request(options, callback).end();
  },

  postGitStatus: function(status, commitHash, bucketName) {
  options.method = 'POST';

  var request = https.request(options);
  var url = 'http://' + bucketName + '.s3.amazonaws.com/compare' + commitHash +
            '.html';

  var content = {
    'state': status,
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
};
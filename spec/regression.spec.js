var fs = require('fs');
var siteMap = require('/tmp/leregression/sitemap.json');

describe('Regression', function() {
  var browserName, browserSize;
  var capture = function (name) {
    name = name.replace(/ /g, '_');
    return browser.takeScreenshot().then(function (png) {
        var image_path = '/tmp/leregression/regression/' +
                          browserName +
                          browserSize +
                          '/' +
                          name +
                          '.png';
        var stream = fs.createWriteStream(image_path);
        stream.write(new Buffer(png, 'base64'));
        stream.end();
        return image_path;
    });
  };

  beforeAll(function() {
    try {
      fs.mkdirSync('/tmp/leregression/regression/');
    } catch(e) {
      if ( e.code != 'EEXIST' ) throw e;
    }

    browser.getCapabilities().then(function (cap) {
      browserName = cap.get('browserName');

      browser.driver.manage().window().getSize().then(function(size) {

        browserSize = size.width + 'x' + size.height;

        try {
          fs.mkdirSync('/tmp/leregression/regression/' + browserName + browserSize);
        } catch(e) {
          if ( e.code != 'EEXIST' ) throw e;
        }

      });

    });

  });

  function runTest(name, page) {
    return function() {
      browser.get(browser.params.env.hostname + page.url);
      browser.waitForAngular().then(function() {
        if (page.wait) {
          setTimeout(capture.bind(null, name), page.wait);
          browser.sleep(page.wait);
        } else {
          capture(name);
        }
      });
    };
  }

  for (var name in siteMap) {
    it('should navigate to ' + name, runTest(name, siteMap[name]));
  }
});
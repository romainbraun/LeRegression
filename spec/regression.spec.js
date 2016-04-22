var fs = require('fs');
var siteMap = require('../config/sitemap.json');

describe('Regression', function() {
  var browserName, browserSize;
  var capture = function (name) {
    name = name.replace(/ /g, '_');
    return browser.takeScreenshot().then(function (png) {
        var image_path = 'test/regression/' +
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
      fs.mkdirSync('test/regression/');
    } catch(e) {
      if ( e.code != 'EEXIST' ) throw e;
    }

    browser.getCapabilities().then(function (cap) {
      browserName = cap.caps_.browserName;

      browser.driver.manage().window().getSize().then(function(size) {

        browserSize = size.width + 'x' + size.height;

        try {
          fs.mkdirSync('test/regression/' + browserName + browserSize);
        } catch(e) {
          if ( e.code != 'EEXIST' ) throw e;
        }

      });

    });

  });

  function runTest(name, location) {
    return function() {
      browser.get(browser.params.env.hostname + location);
      browser.waitForAngular();
      capture(name);
    };
  }

  for (var name in siteMap) {
    it('should navigate to ' + name, runTest(name, siteMap[name]));
  }
});
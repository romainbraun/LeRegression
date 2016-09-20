var fs = require('fs');
var siteMap = require('/tmp/leregression/sitemap.json');

describe('Regression', function() {
  var browserName, browserSize;

  var capture = function (name) {
    name = name.replace(/ /g, '_');
    console.log('about to screen');
    return browser.takeScreenshot().then(function (png) {
        var image_path = '/tmp/leregression/regression/' +
                          browserName +
                          browserSize +
                          '/' +
                          name +
                          '.png';
        var stream = fs.createWriteStream(image_path);
        stream.on('finish', function() {
          console.log('screen!');
          return image_path;  
        });
        stream.write(new Buffer(png, 'base64'));
        stream.end();
        
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
      console.log('wha');
      browser
        .get(browser.params.env.hostname + page.url)
        .then(browser.waitForAngular.bind(browser))
        .then(function() {
          if (page.wait) {
            console.log('capture');
            setTimeout(function() {
              console.log('expect');
              expect(capture(name)).toBeTruthy();
            }, page.wait);
            browser.sleep(page.wait + 100);
            console.log('slept');
          } else {
            console.log('capture');
            expect(capture(name)).toBeTruthy();
          }
      });
    };
  }

  for (var name in siteMap) {
    it('should navigate to ' + name, runTest(name, siteMap[name]));
  }
});
exports.config = {

  seleniumAddress: 'http://hub.browserstack.com/wd/hub',

  suites: {
    'regression': '../spec/regression.spec.js',
  },

  multiCapabilities: [{
    browserName: 'chrome'
  }],

  framework: 'jasmine2',

  jasmineNodeOpts: {
    showColors: true
  },

  params: {
    env: {
      hostname: 'https://www.google.co.uk'
    }
  }

};
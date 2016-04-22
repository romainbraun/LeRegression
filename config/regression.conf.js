exports.config = {

  seleniumAddress: 'http://localhost:4444/wd/hub',

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
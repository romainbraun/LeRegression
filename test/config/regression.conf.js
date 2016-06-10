exports.config = {

  seleniumAddress: 'http://localhost:4444/wd/hub',

  suites: {
    'regression': '/tmp/leregression/regression.spec.js',
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
      hostname: 'https://www.madewithangular.com/'
    }
  }

};
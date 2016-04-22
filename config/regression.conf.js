exports.config = {

  seleniumAddress: 'http://hub.browserstack.com/wd/hub',

  suites: {
    'regression': '../spec/regression.spec.js',
  },

  multiCapabilities: [{
    'browserstack.user' : 'jacksaunders1',
    'browserstack.key' : 'ij3uWAekxQxDsxnvrVxm',
    browserName: 'chrome'
  }],

  framework: 'jasmine2',

  jasmineNodeOpts: {
    showColors: true
  },

  params: {
    env: {
      hostname: 'https://qa.vizibl.co'
    }
  }

};
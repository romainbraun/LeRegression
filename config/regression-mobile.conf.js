var functions = require('../../lib/functions.js'),
    base = require('./regression.conf.js');

exports.config = base.config;

exports.config.onPrepare = function() {
  browser.driver.manage().window().setSize(337, 800);
  functions.login(browser, 'testemail+brucewayne@oldstlabs.com', 'viztest');
};
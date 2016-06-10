var base = require('./regression.conf.js');

exports.config = base.config;

exports.config.onPrepare = function() {
  browser.driver.manage().window().setSize(1280, 800);
};
const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to be within the app directory
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

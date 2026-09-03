/* One place that knows where Playwright is installed. */
try { module.exports = require('playwright'); }
catch(e){ module.exports = require(process.env.PLAYWRIGHT_PATH ||
  '/home/claude/.npm-global/lib/node_modules/playwright'); }

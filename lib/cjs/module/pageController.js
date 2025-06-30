const { createCursor } = require('ghost-cursor');
const { checkTurnstile } = require('./turnstile.js');
const kill = require('tree-kill');

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function pageController(
  page, // 直接传递页面对象
  options = {},
  browser = null,
  xvfbsession = null,
  chrome = null,
  pid = null,
  plugins = [],
  killProcess = false,
  proxy = {}
) {
  const { turnstile = false, logger = console } = options;
  
  // 验证 page 参数
  if (!page) {
    logger.error('Page is undefined in pageController');
    throw new Error('Page is undefined');
  }

  let solveStatus = turnstile;

  page.on('close', () => {
    solveStatus = false;
    logger.log("Page closed");
  });

  if (browser) {
    browser.on('disconnected', async () => {
      solveStatus = false;
      logger.log("Browser disconnected");
      if (killProcess === true) {
        logger.log("Cleaning up resources...");
        if (xvfbsession) {
          try { 
            xvfbsession.stopSync(); 
            logger.log("Stopped Xvfb session");
          } catch (err) { 
            logger.error(`Error stopping Xvfb: ${err.message}`);
          } 
        }
        if (chrome) {
          try { 
            chrome.kill(); 
            logger.log("Killed Chrome process");
          } catch (err) { 
            logger.error(`Error killing Chrome: ${err.message}`);
          }
        }
        if (pid) {
          try { 
            kill(pid, 'SIGKILL', () => { }); 
            logger.log("Killed process tree");
          } catch (err) { 
            logger.error(`Error killing process: ${err.message}`);
          }
        }
      }
    });
  }

  async function turnstileSolver() {
    logger.log(`Turnstile solver ${solveStatus ? 'enabled' : 'disabled'}`);
    while (solveStatus) {
      await checkTurnstile({ page }).catch(() => { });
      await new Promise(r => setTimeout(r, 1000));
    }
    return
  }

  if (solveStatus) {
    turnstileSolver();
  }

  if (proxy && proxy.username && proxy.password) {
    logger.log("Authenticating with proxy credentials");
    await page.authenticate({ username: proxy.username, password: proxy.password });
  }

  if (plugins && plugins.length > 0) {
    logger.log(`Initializing ${plugins.length} plugins`);
    for (const plugin of plugins) {
      try {
        if (plugin.onPageCreated) {
          plugin.onPageCreated(page);
        }
      } catch (err) {
        logger.error(`Plugin error: ${err.message}`);
      }
    }
  }

  logger.log("Injecting stealth scripts");
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(MouseEvent.prototype, 'screenX', {
      get: function () {
        return this.clientX + window.screenX;
      }
    });

    Object.defineProperty(MouseEvent.prototype, 'screenY', {
      get: function () {
        return this.clientY + window.screenY;
      }
    });
  });

  const cursor = createCursor(page);
  page.realCursor = cursor;
  page.realClick = cursor.click;
  logger.log("Cursor initialized");

  return page;
}

module.exports = { pageController };
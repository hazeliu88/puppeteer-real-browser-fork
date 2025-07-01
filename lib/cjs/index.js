const puppeteer = require("rebrowser-puppeteer-core");
const { pageController } = require("./module/pageController.js");
const { BitBrowserManager } = require("./module/bitBrowserManager.js");
const { BitBrowserHelper, BitBrowserLogger } = require("./module/bitBrowserHelper.js");
const BitBrowserAPI = require("./module/bitBrowserAPI.js");
let Xvfb;
try {
  Xvfb = require("xvfb");
} catch {
  // ignore
}

async function connect({
  args = [],
  headless = false,
  customConfig = {},
  proxy = {},
  turnstile = false,
  connectOption = {},
  disableXvfb = false,
  plugins = [],
  ignoreAllFlags = false,
  bitBrowser = null,  // 比特浏览器配置
  debug = false       // 调试模式
} = {}) {
  const { launch, Launcher } = await import("chrome-launcher");
  let xvfbsession = null;
  let chrome;
  let browser;
  let page;
  let logger = new BitBrowserLogger(debug);

  if (bitBrowser) {
    logger.log("Using BitBrowser connection");
    
    try {
      // 创建比特浏览器API实例
      const bitAPI = new BitBrowserAPI({
        apiUrl: bitBrowser.apiUrl || 'http://127.0.0.1:54345',
        debug: bitBrowser.debug || debug
      });
      
      let browserId;
      
      // 如果提供了浏览器ID，直接使用
      if (bitBrowser.browserId) {
        browserId = bitBrowser.browserId;
        logger.log(`Using existing browser ID: ${browserId}`);
      } 
      // 否则创建新浏览器
      else {
        browserId = await bitAPI.createOrUpdateBrowser({
          name: bitBrowser.name || `puppeteer-${Date.now()}`,
          fingerprint: bitBrowser.fingerprint || {
            coreVersion: '124'
          },
          proxy: bitBrowser.proxy || {}
        });
        logger.log(`Created new browser with ID: ${browserId}`);
      }
      
      // 打开浏览器
      const browserInfo = await bitAPI.openBrowser(browserId);
      logger.log(`Opened BitBrowser at ${browserInfo.http}`);
      
      // 连接到浏览器
      logger.log(`Connecting to WebSocket: ${browserInfo.wsUrl}`);
      browser = await puppeteer.connect({
        browserWSEndpoint: browserInfo.wsUrl,
        ...connectOption
      });
      
      logger.log(`Connected to BitBrowser ${browserId}`);
      
      // 获取或创建页面
      logger.log('Getting pages...');
      const pages = await browser.pages();
      logger.log(`!!!!!!!!pages: ${pages}`)
      pages.forEach((item,index)=>{
        logger.log(`idx: ${index}, item: ${item}`)
      })

      logger.log(`Found ${pages.length} pages`);
      
      page = pages[0] || await browser.newPage();
      logger.log(`Page acquired: ${page}`);
      
      // 添加页面错误监听器
      page.on('error', error => {
        logger.error(`Page error: ${error.message}`);
      });
      
      page.on('pageerror', error => {
        logger.error(`Page error: ${error.message}`);
      });
      
      page.on('requestfailed', request => {
        logger.error(`Request failed: ${request.url()} ${request.failure().errorText}`);
      });
    } catch (err) {
      logger.error(`BitBrowser connection failed: ${err.message}`);
      if (err.response) {
        logger.error(`Response data: ${JSON.stringify(err.response.data)}`);
      }
      if (err.stack) {
        logger.error(`Stack trace: ${err.stack}`);
      }
      throw err;
    }
  } 
  // 原版Chrome启动逻辑
  else {
    if (plugins && plugins.length) {
      const puppeteerExtra = require("puppeteer-extra");
      const pluginArray = [...plugins];
      pluginArray.forEach((plugin) => {
        if (plugin !== undefined) {
          puppeteerExtra.use(plugin);
        }
      });
      puppeteer = puppeteerExtra;
    }
    
    let flags = [];
    if (!ignoreAllFlags) {
      flags = [
        "--no-sandbox",
        "--ignore-certificate-errors",
        "--ignore-ssl-errors",
        "--ignore-certificate-errors-spki-list",
        "--disable-infobars",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-default-apps",
        "--disable-translate",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-features=IsolateOrigins,site-per-process,backForwardCache",
        "--disable-breakpad",
        "--window-size=1920,1080",
        "--disable-popup-blocking",
        "--allow-insecure-localhost",
        "--allow-http-screen-capture",
        "--enable-features=NetworkService",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--no-first-run",
      ];
    }
    
    if (proxy.host && proxy.port) {
      if (proxy.username && proxy.password) {
        flags.push(
          `--proxy-server=http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        );
      } else {
        flags.push(`--proxy-server=${proxy.host}:${proxy.port}`);
      }
    }
    
    const newArgs = flags.concat(args);
    
    if (!disableXvfb) {
      const headless = process.env.ENABLE_XVFB !== "false";
      if (headless) {
        xvfbsession = new Xvfb({
          silent: true,
          xvfb_args: ["-screen", "0", "1280x720x24", "-ac"],
        });
        xvfbsession.startSync();
      }
    }
    
    if (Object.keys(customConfig).length) {
      chrome = await launch({ ...customConfig, chromeFlags: newArgs });
    } else {
      chrome = await launch({
        port: 9222,
        chromeFlags: newArgs,
        chromePath: process.env.CHROME_PATH,
        userDataDir: process.env.CHROME_DATA_DIR || undefined,
        handleSIGINT: false,
        enableExtensions: false,
      });
    }
    
    const response = await fetch(
      `http://127.0.0.1:${chrome.port}/json/version?t=${Date.now()}`
    );
    const data = await response.json();
    logger.log(`******* json result: ${data}`)
    browser = await puppeteer.connect({
      browserWSEndpoint: data.webSocketDebuggerUrl,
      ...connectOption,
    });
    
    page = await browser.newPage();
  }
  if (!page) {
    logger.error('Page is undefined, creating new page...');
    page = await browser.newPage();
  }
  await new Promise(resolve => setTimeout(resolve, 2000));


  const pageWithCursor = await pageController(
        page,
        {
          turnstile,
          logger
        },
        browser,        // browser 对象
        null,           // xvfbsession (比特浏览器不需要)
        null,           // chrome (比特浏览器不需要)
        null,           // pid (比特浏览器不需要)
        plugins || [],  // 插件
        false,          // killProcess (比特浏览器不需要)
        proxy           // 代理
      );
  
  pageWithCursor.browser = browser;
  if (chrome) {
    pageWithCursor.$chrome = chrome;
  }
  pageWithCursor.$xvfb = xvfbsession;
  pageWithCursor.$logger = logger;
  
  return {
    browser,
    page: pageWithCursor,
    $chrome: chrome,
    $xvfb: xvfbsession,
  };
}

// 导出比特浏览器API和管理器
module.exports = { 
  connect,
  BitBrowserAPI,
  BitBrowserManager
};
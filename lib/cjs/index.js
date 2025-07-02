const puppeteer = require("rebrowser-puppeteer-core");
const { pageController } = require("./module/pageController.js");
const { BitBrowserManager } = require("./module/bitBrowserManager.js");
const {
  BitBrowserHelper,
  BitBrowserLogger,
} = require("./module/bitBrowserHelper.js");
const BitBrowserAPI = require("./module/bitBrowserAPI.js");
let Xvfb;
try {
  Xvfb = require("xvfb");
} catch {
  // ignore
}

// 默认配置 - 使用 const 定义
const defaultFingerprint = {
  coreVersion: "136",
  os: "win",
  platform: "windows",
  deviceMemory: 8,
  hardwareConcurrency: 4,
  resolution: "1920x1080",
  timezone: "Asia/Shanghai",
  language: "en-US,en",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  canvas: "noise",
  webgl: "noise",
  audioContext: "noise",
  fonts: ["Arial", "Times New Roman", "Courier New"],
};

const defaultConnectOption = {
  turnstile: true,
  debug: true,
  stealth: true,
  evasion: {
    webDriver: true,
    webgl: true,
    fonts: true,
    audio: true,
    canvas: true,
    mediaDevices: true,
    webRTC: true,
    iframe: true,
    plugins: true,
    languages: true,
    userAgent: true,
    deviceMemory: true,
    hardwareConcurrency: true,
    recaptcha: true,
  },
};

const defaultBitBrowserConfig = {
  apiUrl: "http://127.0.0.1:54345",
  name: `puppeteer-browser-${Date.now()}`,
  fingerprint: defaultFingerprint,
  proxy: {},
};

// 深度合并对象函数
function deepMerge(target, source) {
  if (typeof target !== "object" || typeof source !== "object") return source;

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === "object" &&
        !Array.isArray(source[key]) &&
        source[key] !== null
      ) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
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
  bitBrowser = null, // 比特浏览器配置
  debug = false, // 调试模式
} = {}) {
  const { launch, Launcher } = await import("chrome-launcher");
  let xvfbsession = null;
  let chrome;
  let browser;
  let page;
  let logger = new BitBrowserLogger(debug);

  // 合并默认配置和用户配置
  const finalBitBrowser = bitBrowser
    ? deepMerge({ ...defaultBitBrowserConfig }, bitBrowser)
    : null;
  const finalConnectOption = deepMerge(
    { ...defaultConnectOption },
    connectOption
  );

  if (finalBitBrowser) {
    logger.log("Using BitBrowser connection");

    try {
      // 创建比特浏览器API实例
      const bitAPI = new BitBrowserAPI({
        apiUrl: finalBitBrowser.apiUrl || "http://127.0.0.1:54345",
        debug: finalBitBrowser.debug || debug,
      });

      let browserId;

      // 如果提供了浏览器ID，直接使用
      if (finalBitBrowser.browserId) {
        browserId = finalBitBrowser.browserId;
        logger.log(`Using existing browser ID: ${browserId}`);
      }
      // 否则创建新浏览器
      else {
        browserId = await bitAPI.createOrUpdateBrowser({
          name: finalBitBrowser.name || `puppeteer-${Date.now()}`,
          fingerprint: finalBitBrowser.fingerprint || defaultFingerprint,
          proxy: finalBitBrowser.proxy || {},
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
        ...finalConnectOption,
      });

      logger.log(`Connected to BitBrowser ${browserId}`);

      // 获取或创建页面
      logger.log("Getting pages...");
      const pages = await browser.pages();
      logger.log(`Found ${pages.length} pages`);

      // page = pages[0] || (await browser.newPage());
      // logger.log(`Page acquired: ${page}`);

      // for (const p of pages) {
      //   await p.close().catch(() => {});
      // }
      page = await browser.newPage();
      logger.log(`Created new page: ${page}`);
      // 导航到空白页避免干扰
      await page.goto("about:blank", { waitUntil: "domcontentloaded" });

      // 可选：关闭其他页面（如果需要）
      if (pages.length > 0) {
        logger.log(`Closing ${pages.length} existing pages...`);
        for (const p of pages) {
          if (p !== page) {
            // 不要关闭我们刚创建的页面
            await p.close().catch((err) => {
              logger.warn(`Failed to close page: ${err.message}`);
            });
          }
        }
      }
      // 添加页面错误监听器
      page.on("error", (error) => {
        logger.error(`Page error: ${error.message}`);
      });

      page.on("pageerror", (error) => {
        logger.error(`Page error: ${error.message}`);
      });

      page.on("requestfailed", (request) => {
        logger.error(
          `Request failed: ${request.url()} ${request.failure().errorText}`
        );
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
    browser = await puppeteer.connect({
      browserWSEndpoint: data.webSocketDebuggerUrl,
      ...finalConnectOption,
    });

    page = await browser.newPage();
  }

  if (!page) {
    logger.error("Page is undefined, creating new page...");
    page = await browser.newPage();
  }

  // 添加短暂等待，确保页面稳定
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const pageWithCursor = await pageController(
    page,
    {
      turnstile,
      logger,
    },
    browser, // browser 对象
    null, // xvfbsession (比特浏览器不需要)
    null, // chrome (比特浏览器不需要)
    null, // pid (比特浏览器不需要)
    plugins || [], // 插件
    false, // killProcess (比特浏览器不需要)
    proxy // 代理
  );

  pageWithCursor.browser = browser;
  pageWithCursor.$logger = logger;

  if (chrome) {
    pageWithCursor.$chrome = chrome;
  }

  pageWithCursor.$xvfb = xvfbsession;

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
  pageController,
  BitBrowserAPI,
  BitBrowserManager,
  // 导出默认配置以便用户参考
  defaultFingerprint,
  defaultConnectOption,
  defaultBitBrowserConfig,
};

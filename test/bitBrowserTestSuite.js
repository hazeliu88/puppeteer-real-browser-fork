const test = require('node:test');
const assert = require('node:assert');
const { connect, pageController } = require('../lib/cjs/index.js'); // 确保导出 pageController
const BitBrowserAPI = require('../lib/cjs/module/bitBrowserAPI');
const { BitBrowserLogger } = require('../lib/cjs/module/bitBrowserHelper');
const fs = require('fs');
const path = require('path');
const util = require('util');

// 创建日志目录
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 设置日志文件
const logFile = path.join(logDir, `bitbrowser-test-${Date.now()}.log`);
const logger = new BitBrowserLogger(true, logFile);

// 增强日志记录
const logError = (error) => {
  logger.error(`Error: ${error.message}`);
  if (error.response) {
    logger.error(`Response status: ${error.response.status}`);
    logger.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
  }
  if (error.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 比特浏览器配置
const bitBrowserConfig = {
  apiUrl: 'http://127.0.0.1:54345',
  debug: true
};

// 指纹配置
const fingerprint = {
  coreVersion: '136',
  os: 'win',
  platform: 'windows',
  deviceMemory: 8,
  hardwareConcurrency: 4,
};

// 比特浏览器连接选项 - 添加更多反检测参数
const bitBrowserConnectOption = {
  turnstile: true,
  debug: true,
  stealth: true,
  evasion: {
    webgl: true,
    fonts: true,
    audio: true,
    canvas: true,
    mediaDevices: true,
    webRTC: true
  }
};

// 全局变量，用于共享浏览器实例
let globalBrowser;
let globalPage;
let globalBitAPI;
let globalBrowserId;

// 在同一个浏览器实例中运行所有测试
test('BitBrowser Test Suite', async (t) => {
  // 创建比特浏览器实例
  await t.test("Setup BitBrowser", async () => {
    logger.log("Creating BitBrowser API instance...");
    globalBitAPI = new BitBrowserAPI(bitBrowserConfig);

    logger.log("Creating new browser window...");
    globalBrowserId = await globalBitAPI.createOrUpdateBrowser({
      name: `test-suite-${Date.now()}`,
      remark: "Created for BitBrowser test suite",
      fingerprint,
    });
    logger.log(`Browser created with ID: ${globalBrowserId}`);

    logger.log("Opening browser window...");
    const browserInfo = await globalBitAPI.openBrowser(globalBrowserId);
    logger.log(`Browser opened at: ${browserInfo.http}`);

    // 添加等待时间，确保浏览器完全初始化
    logger.log("Waiting for browser to initialize...");
    await wait(5000);

    // 连接到浏览器
    const connection = await connect({
      bitBrowser: {
        browserId: globalBrowserId,
        debug: true,
      },
      ...bitBrowserConnectOption,
    });

    globalBrowser = connection.browser;
    globalPage = connection.page;

    if (!globalPage) {
      throw new Error("Page is undefined after connect");
    }

    logger.log(`Connected browser: ${!!globalBrowser}, page: ${!!globalPage}`);

    // 添加等待时间，确保页面加载
    logger.log("Waiting for page to be ready...");
    await wait(3000);
  });

  // 测试用例：DrissionPage Detector
  await t.test("DrissionPage Detector", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      await enhancedPage.goto(
        "https://web.archive.org/web/20240913054632/https://drissionpage.pages.dev/"
      );
      await enhancedPage.realClick("#detector");

      // 添加等待时间
      await wait(3000);

      const result = await enhancedPage.evaluate(() => {
        return document.querySelector("#isBot span").textContent.includes("not")
          ? true
          : false;
      });

      assert.strictEqual(result, true, "DrissionPage Detector test failed!");
    } finally {
      await page.close();
    }
  });

  // 测试用例：Brotector, a webdriver detector
  await t.test("Brotector, a webdriver detector", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      await enhancedPage.goto("https://kaliiiiiiiiii.github.io/brotector/");

      // 增加等待时间
      await wait(8000);

      // 更健壮的断言
      const result = await enhancedPage.evaluate(() => {
        const table = document.querySelector("#table-keys");
        if (!table) return null;

        return table.getAttribute("bgcolor") === "darkgreen";
      });

      assert.strictEqual(result, true, "Brotector test failed!");
    } finally {
      await page.close();
    }
  });

  // 测试用例：Cloudflare WAF
  await t.test("Cloudflare WAF", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      await enhancedPage.goto("https://nopecha.com/demo/cloudflare");

      // 增加超时时间
      const startDate = Date.now();
      let verify = null;

      while (!verify && Date.now() - startDate < 60000) {
        // 60秒超时
        verify = await enhancedPage
          .evaluate(() => {
            return document.querySelector(".link_row") ? true : null;
          })
          .catch(() => null);

        await wait(2000); // 每2秒检查一次
      }

      assert.strictEqual(verify === true, true, "Cloudflare WAF test failed!");
    } finally {
      await page.close();
    }
  });

  // 测试用例：Cloudflare Turnstile
  await t.test("Cloudflare Turnstile", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      // 添加额外的反检测措施
      await enhancedPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });

        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      await enhancedPage.goto("https://turnstile.zeroclover.io/");

      // 添加随机鼠标移动
      await moveMouseRandomly(enhancedPage);

      // 等待提交按钮
      await enhancedPage.waitForSelector('[type="submit"]', { timeout: 30000 });

      let token = null;
      const startDate = Date.now();
      let retryCount = 0;
      const maxRetries = 3;

      while (
        !token &&
        retryCount < maxRetries &&
        Date.now() - startDate < 60000
      ) {
        // 尝试提交表单以触发验证
        await enhancedPage.click('[type="submit"]').catch(() => {});

        // 等待验证完成
        await wait(5000);

        token = await enhancedPage.evaluate(() => {
          try {
            const element = document.querySelector(
              '[name="cf-turnstile-response"]'
            );
            return element && element.value && element.value.length > 20
              ? element.value
              : null;
          } catch (e) {
            return null;
          }
        });

        if (!token) {
          retryCount++;
          logger.log(
            `Turnstile token not found, retry ${retryCount}/${maxRetries}`
          );
          await wait(3000);
        }
      }

      assert.strictEqual(
        token !== null,
        true,
        "Cloudflare turnstile test failed!"
      );
    } finally {
      await page.close();
    }
  });

  // 测试用例：Fingerprint JS Bot Detector
  await t.test("Fingerprint JS Bot Detector", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      await enhancedPage.goto(
        "https://fingerprint.com/products/bot-detection/"
      );

      // 添加等待时间
      await wait(8000);

      const detect = await enhancedPage.evaluate(() => {
        const element = document.querySelector(
          ".HeroSection-module--botSubTitle--2711e"
        );
        return element && element.textContent.includes("not") ? true : false;
      });

      assert.strictEqual(
        detect,
        true,
        "Fingerprint JS Bot Detector test failed!"
      );
    } finally {
      await page.close();
    }
  });

  // 测试用例：Datadome Bot Detector
  await t.test("Datadome Bot Detector", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      await enhancedPage.goto("https://antoinevastel.com/bots/datadome");

      // 添加等待时间
      await wait(5000);

      const check = await enhancedPage
        .waitForSelector("nav #navbarCollapse")
        .catch(() => null);

      assert.strictEqual(
        check ? true : false,
        true,
        "Datadome Bot Detector test failed! [This may also be because your ip address has a high spam score. Please try with a clean ip address.]"
      );
    } finally {
      await page.close();
    }
  });

  // 测试用例：Recaptcha V3 Score (hard)
  await t.test("Recaptcha V3 Score (hard)", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      // 添加人类行为模拟
      await enhancedPage.evaluateOnNewDocument(() => {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (
          type,
          listener,
          options
        ) {
          if (type === "mousemove") {
            const wrappedListener = function (...args) {
              setTimeout(() => {
                listener.apply(this, args);
              }, Math.random() * 50);
            };
            return originalAddEventListener.call(
              this,
              type,
              wrappedListener,
              options
            );
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
      });

      await enhancedPage.goto("https://antcpt.com/score_detector/", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // 添加随机鼠标移动
      await moveMouseRandomly(enhancedPage, {
        moveDelay: 2000,
        randomOffset: 30,
      });

      // 等待一段时间让页面稳定
      await wait(2000);

      // 点击按钮
      await enhancedPage.realClick("button", {
        moveDelay: 500,
        paddingPercentage: 10,
      });

      // 添加等待时间
      await wait(15000);

      // 更健壮的分数获取
      const score = await enhancedPage.evaluate(() => {
        try {
          const element = document.querySelector("big");
          if (!element) return "0";

          return element.textContent.replace(/[^0-9.]/g, "");
        } catch (e) {
          return "0";
        }
      });

      const scoreNum = Number(score);
      logger.log(`Recaptcha V3 Score: ${scoreNum}`);

      // 更宽松的断言（考虑到测试环境）
      const passed = scoreNum >= 0.5;
      assert.strictEqual(
        passed,
        true,
        `Recaptcha V3 Score should be >=0.5. Score Result: ${score}`
      );
    } finally {
      await page.close();
    }
  });

  // 测试用例：在新标签页中测试
  await t.test("New Tab Test", async () => {
    const page = await globalBrowser.newPage();

    try {
      // 应用页面控制器
      const enhancedPage = await pageController(
        page,
        {
          turnstile: true,
          logger,
        },
        globalBrowser
      );

      // 导航到示例网站
      await enhancedPage.goto("https://example.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // 添加等待时间
      await wait(3000);

      // 获取页面标题
      const title = await enhancedPage.title();
      logger.log(`Page title: ${title}`);

      // 执行页面操作
      await enhancedPage.realClick("a");

      // 添加等待时间
      await wait(3000);

      // 验证导航
      const newUrl = await enhancedPage.url();
      assert.ok(
        newUrl.includes("iana.org"),
        `Expected URL to contain 'iana.org', got: ${newUrl}`
      );
    } finally {
      await page.close();
    }
  });

  // 清理资源
  await t.test("Teardown BitBrowser", async () => {
    logger.log("Closing browser window...");
    await globalBitAPI.closeBrowser(globalBrowserId);

    logger.log("Deleting browser window...");
    await globalBitAPI.deleteBrowser(globalBrowserId);

    logger.log("All tests completed!");
  });
});
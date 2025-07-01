const test = require('node:test');
const assert = require('node:assert');
const { connect } = require('../lib/cjs/index.js');
const BitBrowserAPI = require('../lib/cjs/module/bitBrowserAPI'); // 修复导入方式
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
  if (error.config) {
    logger.error(`Request config: ${util.inspect(error.config, { depth: null })}`);
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

// 比特浏览器连接选项
const bitBrowserConnectOption = {
  turnstile: true,
  debug: true
};

// 全局变量，用于共享浏览器实例
let globalBrowser;
let globalPage;
let globalBitAPI;
let globalBrowserId;

// 在同一个浏览器实例中运行所有测试
test('BitBrowser Test Suite', async (t) => {
  // 创建比特浏览器实例
  await t.test('Setup BitBrowser', async () => {
    logger.log('Creating BitBrowser API instance...');
    globalBitAPI = new BitBrowserAPI(bitBrowserConfig);
    
    logger.log('Creating new browser window...');
    globalBrowserId = await globalBitAPI.createOrUpdateBrowser({
      name: `test-suite-${Date.now()}`,
      remark: 'Created for BitBrowser test suite',
      fingerprint
    });
    logger.log(`Browser created with ID: ${globalBrowserId}`);
    
    logger.log('Opening browser window...');
    const browserInfo = await globalBitAPI.openBrowser(globalBrowserId);
    logger.log(`Browser opened at: ${browserInfo.http}`);
    
    // 添加等待时间，确保浏览器完全初始化
    logger.log('Waiting for browser to initialize...');
    await wait(5000);
    
    // 连接到浏览器
    const connection = await connect({
      bitBrowser: {
        browserId: globalBrowserId,
        debug: true
      },
      ...bitBrowserConnectOption
    });
    
    globalBrowser = connection.browser;
    globalPage = connection.page;
    
    if (!globalPage) {
      throw new Error('Page is undefined after connect');
    }
    
    logger.log(`Connected browser: ${!!globalBrowser}, page: ${!!globalPage}`);
    
    // 添加等待时间，确保页面加载
    logger.log('Waiting for page to be ready...');
    await wait(3000);
  });
  
  // 测试用例：DrissionPage Detector
  await t.test('DrissionPage Detector', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://web.archive.org/web/20240913054632/https://drissionpage.pages.dev/");
      await page.realClick("#detector");
      
      // 添加等待时间
      await wait(3000);
      
      const result = await page.evaluate(() => {
        return document.querySelector('#isBot span').textContent.includes("not") ? true : false;
      });
      
      assert.strictEqual(result, true, "DrissionPage Detector test failed!");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Brotector, a webdriver detector
  await t.test('Brotector, a webdriver detector', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://kaliiiiiiiiii.github.io/brotector/");
      
      // 添加等待时间
      await wait(5000);
      
      const result = await page.evaluate(() => {
        return document.querySelector('#table-keys').getAttribute('bgcolor');
      });
      
      assert.strictEqual(result === "darkgreen", true, "Brotector test failed!");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Cloudflare WAF
  await t.test('Cloudflare WAF', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://nopecha.com/demo/cloudflare");
      
      let verify = null;
      const startDate = Date.now();
      
      while (!verify && (Date.now() - startDate) < 30000) {
        verify = await page.evaluate(() => {
          return document.querySelector('.link_row') ? true : null;
        }).catch(() => null);
        
        await wait(1000);
      }
      
      assert.strictEqual(verify === true, true, "Cloudflare WAF test failed!");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Cloudflare Turnstile
  await t.test('Cloudflare Turnstile', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://turnstile.zeroclover.io/");
      await page.waitForSelector('[type="submit"]');
      
      let token = null;
      const startDate = Date.now();
      
      while (!token && (Date.now() - startDate) < 30000) {
        token = await page.evaluate(() => {
          try {
            const element = document.querySelector('[name="cf-turnstile-response"]');
            return element && element.value && element.value.length > 20 ? element.value : null;
          } catch (e) {
            return null;
          }
        });
        
        await wait(1000);
      }
      
      assert.strictEqual(token !== null, true, "Cloudflare turnstile test failed!");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Fingerprint JS Bot Detector
  await t.test('Fingerprint JS Bot Detector', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://fingerprint.com/products/bot-detection/");
      
      // 添加等待时间
      await wait(8000);
      
      const detect = await page.evaluate(() => {
        const element = document.querySelector('.HeroSection-module--botSubTitle--2711e');
        return element && element.textContent.includes("not") ? true : false;
      });
      
      assert.strictEqual(detect, true, "Fingerprint JS Bot Detector test failed!");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Datadome Bot Detector
  await t.test('Datadome Bot Detector', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://antoinevastel.com/bots/datadome");
      
      // 添加等待时间
      await wait(5000);
      
      const check = await page.waitForSelector('nav #navbarCollapse').catch(() => null);
      
      assert.strictEqual(check ? true : false, true, 
        "Datadome Bot Detector test failed! [This may also be because your ip address has a high spam score. Please try with a clean ip address.]");
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：Recaptcha V3 Score (hard)
  await t.test('Recaptcha V3 Score (hard)', async () => {
    const page = await globalBrowser.newPage();
    try {
      await page.goto("https://antcpt.com/score_detector/");
      
      // 添加等待时间
      await wait(3000);
      
      await page.realClick("button");
      
      // 添加等待时间
      await wait(8000);
      
      const score = await page.evaluate(() => {
        const element = document.querySelector('big');
        return element ? element.textContent.replace(/[^0-9.]/g, '') : '0';
      });
      
      const scoreNum = Number(score);
      assert.strictEqual(scoreNum >= 0.7, true, 
        `Recaptcha V3 Score (hard) should be >=0.7. Score Result: ${score}`);
    } finally {
      await page.close();
    }
  });
  
  // 测试用例：在新标签页中测试
  await t.test('New Tab Test', async () => {
    const page = await globalBrowser.newPage();
    try {
      // 导航到示例网站
      await page.goto("https://example.com", {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // 添加等待时间
      await wait(3000);
      
      // 获取页面标题
      const title = await page.title();
      logger.log(`Page title: ${title}`);
      
      // 执行页面操作
      await page.realClick('a');
      
      // 添加等待时间
      await wait(3000);
      
      // 验证导航
      const newUrl = await page.url();
      assert.ok(newUrl.includes('iana.org'), `Expected URL to contain 'iana.org', got: ${newUrl}`);
    } finally {
      await page.close();
    }
  });
  
  // 清理资源
  await t.test('Teardown BitBrowser', async () => {
    logger.log('Closing browser window...');
    await globalBitAPI.closeBrowser(globalBrowserId);
    
    logger.log('Deleting browser window...');
    await globalBitAPI.deleteBrowser(globalBrowserId);
    
    logger.log('All tests completed!');
  });
});
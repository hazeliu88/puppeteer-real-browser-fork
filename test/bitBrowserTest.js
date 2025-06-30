const { BitBrowserAPI, connect } = require('../lib/cjs/index');
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

async function runBitBrowserTest() {
  logger.log('Starting BitBrowser test...');
  
  let browserId; // 在外部声明browserId
  let bitAPI;
  
  try {
    // 1. 创建比特浏览器API实例
    logger.log('Creating BitBrowser API instance...');
    bitAPI = new BitBrowserAPI({
      apiUrl: 'http://127.0.0.1:54345', // 默认地址
      debug: true
    });
    
    // 2. 创建新浏览器窗口
    logger.log('Creating new browser window...');
    browserId = await bitAPI.createOrUpdateBrowser({
      name: 'puppeteer-test-browser',
      remark: 'Created for puppeteer-real-browser integration test',
      fingerprint: {
        coreVersion: '136', // 使用Chrome 120内核
        os: 'win',          // 模拟Windows系统
        platform: 'windows',
        deviceMemory: 8,    // 8GB内存
        hardwareConcurrency: 4, // 4核CPU
      }
    });
    logger.log(`Browser created with ID: ${browserId}`);
    
    // 3. 打开浏览器窗口
    logger.log('Opening browser window...');
    const browserInfo = await bitAPI.openBrowser(browserId);
    
    if (!browserInfo) {
      throw new Error('Browser info is undefined');
    }
    
    logger.log(`Browser opened at: ${browserInfo.http}`);
    logger.log(`WebSocket URL: ${browserInfo.wsUrl}`);
    
    // 添加等待时间，确保浏览器完全初始化
    logger.log('Waiting for browser to initialize...');
    await wait(5000); // 5秒等待
    
    // 4. 使用puppeteer-real-browser连接到比特浏览器
    logger.log('Connecting with puppeteer-real-browser...');
    const { browser: connectedBrowser, page } = await connect({
      bitBrowser: {
        browserId,
        debug: true
      },
      turnstile: true, // 启用真实点击
      debug: true      // 启用调试日志
    });
    
    if (!page) {
      throw new Error('Page is undefined after connect');
    }
    
    logger.log(`Connected browser: ${!!connectedBrowser}, page: ${!!page}`);
    
    // 添加等待时间，确保页面加载
    logger.log('Waiting for page to be ready...');
    await wait(3000);
    
    // 5. 使用页面进行自动化操作
    logger.log('Navigating to example.com...');
    try {
      await page.goto('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      logger.log('Navigation completed');
    } catch (error) {
      logger.error('Navigation failed:');
      logError(error);
      throw error;
    }
    
    // 获取页面标题
    const title = await page.title();
    logger.log(`Page title: ${title}`);
    
    // 截图
    const screenshotPath = path.join(logDir, `screenshot-${Date.now()}.png`);
    try {
      await page.screenshot({ path: screenshotPath });
      logger.log(`Screenshot saved to: ${screenshotPath}`);
    } catch (error) {
      logger.error('Screenshot failed:');
      logError(error);
    }
    
    // 执行页面操作（使用真实点击）
    logger.log('Clicking on page with real cursor...');
    try {
      // 等待链接出现
      await page.waitForSelector('a', { timeout: 10000 });
      await page.realClick('a', {
        moveDelay: 500, // 增加移动延迟
        paddingPercentage: 10 // 点击区域增加10%填充
      });
      logger.log('Click completed');
    } catch (error) {
      logger.error('Click failed:');
      logError(error);
    }
    
    // 等待新页面加载
    try {
      await page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      logger.log(`Navigated to: ${await page.url()}`);
    } catch (error) {
      logger.error('Navigation after click failed:');
      logError(error);
    }
    
    // 6. 关闭浏览器窗口
    logger.log('Closing browser window...');
    await bitAPI.closeBrowser(browserId);
    
    // 7. 删除浏览器窗口
    logger.log('Deleting browser window...');
    await bitAPI.deleteBrowser(browserId);
    
    logger.log('Test completed successfully!');
  } catch (error) {
    logger.error('Test failed:');
    logError(error);
    
    // 尝试关闭浏览器（如果可能）
    if (browserId && bitAPI) {
      try {
        logger.log('Attempting to close browser...');
        await bitAPI.closeBrowser(browserId);
      } catch (cleanupError) {
        logger.error('Browser close failed:');
        logError(cleanupError);
      }
      
      try {
        logger.log('Attempting to delete browser...');
        await bitAPI.deleteBrowser(browserId);
      } catch (cleanupError) {
        logger.error('Browser deletion failed:');
        logError(cleanupError);
      }
    }
    
    process.exit(1);
  }
}

// 运行测试
runBitBrowserTest();
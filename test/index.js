const { BitBrowserAPI, connect } = require('../lib/cjs/index');
const { BitBrowserLogger } = require('../lib/cjs/module/bitBrowserHelper');
const fs = require('fs');
const path = require('path');

// 创建日志目录
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 设置日志文件
const logFile = path.join(logDir, `bitbrowser-test-${Date.now()}.log`);
const logger = new BitBrowserLogger(true, logFile);

async function runBitBrowserTest() {
  logger.log('Starting BitBrowser test...');
  
  let browserId; // 在外部声明browserId
  
  try {
    // 1. 创建比特浏览器API实例
    logger.log('Creating BitBrowser API instance...');
    const bitAPI = new BitBrowserAPI({
      apiUrl: 'http://127.0.0.1:54345', // 默认地址
      debug: true
    });
    
    // 2. 创建新浏览器窗口
    logger.log('Creating new browser window...');
    browserId = await bitAPI.createOrUpdateBrowser({
      name: 'puppeteer-test-browser',
      remark: 'Created for puppeteer-real-browser integration test',
      fingerprint: {
        coreVersion: '124', // 使用Chrome 124内核
        os: 'win',          // 模拟Windows系统
        platform: 'windows',
        deviceMemory: 8,    // 8GB内存
        hardwareConcurrency: 4, // 4核CPU
        webglVendor: 'Intel Inc.', // WebGL供应商
        webglRenderer: 'Intel Iris Pro', // WebGL渲染器
      },
      proxy: {
        proxyMethod: 2,
        proxyType: 'http',
        host: 'proxy.example.com',
        port: '8080',
        proxyUserName: 'user',
        proxyPassword: 'pass'
      }
    });
    logger.log(`Browser created with ID: ${browserId}`);
    
    // 3. 打开浏览器窗口
    logger.log('Opening browser window...');
    const browserInfo = await bitAPI.openBrowser(browserId);
    logger.log(`Browser opened at: ${browserInfo.http}`);
    logger.log(`WebSocket URL: ${browserInfo.wsUrl}`);
    
    // 4. 使用puppeteer-real-browser连接到比特浏览器
    logger.log('Connecting with puppeteer-real-browser...');
    const { page } = await connect({
      bitBrowser: {
        browserId,
        debug: true
      },
      turnstile: true, // 启用真实点击
      debug: true      // 启用调试日志
    });
    
    // 5. 使用页面进行自动化操作
    logger.log('Navigating to example.com...');
    await page.goto('https://example.com');
    
    // 获取页面标题
    const title = await page.title();
    logger.log(`Page title: ${title}`);
    
    // 截图
    const screenshotPath = path.join(logDir, `screenshot-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    logger.log(`Screenshot saved to: ${screenshotPath}`);
    
    // 执行页面操作（使用真实点击）
    logger.log('Clicking on page with real cursor...');
    await page.realClick('a', {
      moveDelay: 300, // 移动延迟300ms
      paddingPercentage: 10 // 点击区域增加10%填充
    });
    
    // 等待新页面加载
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    logger.log(`Navigated to: ${await page.url()}`);
    
    // 测试表单输入
    logger.log('Testing form input...');
    await page.goto('https://httpbin.org/forms/post');
    
    // 输入姓名
    await page.type('input[name="custname"]', 'John Doe', { delay: 50 });
    
    // 选择披萨尺寸
    await page.select('select[name="size"]', 'medium');
    
    // 选择配料
    await page.click('input[value="cheese"]');
    await page.click('input[value="onion"]');
    
    // 输入地址
    await page.type('textarea[name="comments"]', '123 Main St, Anytown, USA', { delay: 30 });
    
    // 提交表单
    await page.realClick('button[type="submit"]');
    
    // 等待结果页面
    await page.waitForNavigation();
    const resultJson = await page.$eval('pre', el => el.textContent);
    logger.log('Form submission result:', resultJson);
    
    // 6. 关闭浏览器窗口
    logger.log('Closing browser window...');
    await bitAPI.closeBrowser(browserId);
    
    // 7. 删除浏览器窗口
    logger.log('Deleting browser window...');
    await bitAPI.deleteBrowser(browserId);
    
    logger.log('Test completed successfully!');
  } catch (error) {
    logger.error('Test failed:', error);
    
    // 尝试关闭浏览器（如果可能）
    if (browserId) {
      try {
        await bitAPI.closeBrowser(browserId);
        await bitAPI.deleteBrowser(browserId);
      } catch (cleanupError) {
        logger.error('Cleanup failed:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

// 运行测试
runBitBrowserTest();
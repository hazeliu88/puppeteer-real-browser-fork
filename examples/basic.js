// 使用try-catch实现双模式支持
try {
  // 尝试使用npm包方式导入
  const {
    connect,
    defaultFingerprint,
    defaultConnectOption,
  } = require("puppeteer-real-browser-bit");
  runExample({ connect, defaultFingerprint, defaultConnectOption });
} catch (e) {
  console.log("检测到本地开发模式，使用相对路径导入...");
  // 使用本地相对路径导入
  const {
    connect,
    defaultFingerprint,
    defaultConnectOption,
  } = require("../lib/cjs/index");
  runExample({ connect, defaultFingerprint, defaultConnectOption });
}

async function runExample({
  connect,
  defaultFingerprint,
  defaultConnectOption,
}) {
  try {
    console.log("使用默认指纹配置:");
    console.log(defaultFingerprint);

    console.log("\n使用默认连接选项:");
    console.log(defaultConnectOption);

    // 1. 连接到比特浏览器（使用默认配置）
    const { browser, page } = await connect({
      debug: true, // 启用调试模式
      bitBrowser: {
        // 使用默认配置，可以留空或覆盖部分配置
        fingerprint: {
          // 覆盖部分指纹配置
          language: "en-US,en",
          timezone: "America/New_York",
        },
      },
    });

    // 2. 导航到Google
    await page.goto("https://www.google.com", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // 3. 处理可能的Cookie同意提示
    try {
      // 尝试点击同意按钮（不同地区可能有不同提示）
      await page.waitForSelector('button:has-text("I agree")', {
        timeout: 2000,
      });
      await page.click('button:has-text("I agree")');
      console.log("点击了同意按钮");
    } catch (e) {
      // 没有找到同意按钮，继续
    }

    // 4. 打印页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);

    // 5. 搜索关键词 - 更健壮的选择器
    try {
      // 尝试多种可能的搜索框选择器
      const searchSelectors = [
        'textarea[name="q"]',
        'input[name="q"]',
        'textarea[title="Search"]',
        'input[title="Search"]',
        'textarea[aria-label="Search"]',
        'input[aria-label="Search"]',
      ];

      let searchBoxFound = false;
      for (const selector of searchSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.type(selector, "Puppeteer Real Browser");
          searchBoxFound = true;
          break;
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!searchBoxFound) {
        throw new Error("未找到搜索框");
      }

      await page.keyboard.press("Enter");
    } catch (error) {
      console.error("搜索失败:", error.message);
      // 直接导航到搜索结果页作为备选方案
      await page.goto(
        "https://www.google.com/search?q=Puppeteer+Real+Browser",
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        }
      );
    }

    // 6. 等待结果加载 - 更健壮的选择器
    try {
      await page.waitForSelector("#search", { timeout: 10000 });
    } catch (e) {
      // 尝试其他可能的结果容器选择器
      await page.waitForSelector('[role="main"]', { timeout: 5000 });
    }

    // 7. 获取搜索结果 - 更健壮的方法
    const results = await page.evaluate(() => {
      const resultElements = Array.from(document.querySelectorAll("h3"));
      return resultElements.map((el) => el.textContent);
    });

    console.log("搜索结果:");
    results.slice(0, 5).forEach((result, i) => {
      console.log(`${i + 1}. ${result}`);
    });

    // 8. 截图保存
    await page.screenshot({ path: "google-search-results.png" });
    console.log("截图已保存");

    // 9. 关闭浏览器
    await browser.close();
    console.log("浏览器已关闭");
  } catch (error) {
    console.error("运行出错:", error);
  }
}
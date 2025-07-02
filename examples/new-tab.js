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

// 实际运行的示例代码
async function runExample({
  connect,
  defaultFingerprint,
  defaultConnectOption,
}) {
  try {
    // 1. 连接到比特浏览器
    const { browser } = await connect({
      debug: true,
      bitBrowser: {},
    });

    console.log("已连接到浏览器");

    // 2. 创建第一个新标签页
    const googlePage = await browser.newPage();
    console.log("已创建Google标签页");

    // 3. 导航到Google
    await googlePage.goto("https://www.google.com", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("已导航到Google");

    // 4. 在Google搜索
    await googlePage.type('textarea[name="q"]', "Puppeteer Real Browser");
    await googlePage.keyboard.press("Enter");

    // 5. 等待结果加载
    await googlePage.waitForSelector("#search", { timeout: 10000 });

    // 6. 创建第二个新标签页
    const examplePage = await browser.newPage();
    console.log("已创建Example标签页");

    // 7. 导航到Example.com
    await examplePage.goto("https://example.com");
    console.log("已导航到example.com");

    // 8. 获取页面内容
    const content = await examplePage.$eval("h1", (el) => el.textContent);
    console.log(`Example.com标题: ${content}`);

    // 9. 在两个标签页之间切换
    console.log("切换回Google标签页");
    await googlePage.bringToFront();

    // 10. 获取Google搜索结果
    const results = await googlePage.$$eval("h3", (elements) =>
      elements.map((el) => el.textContent)
    );

    console.log("Google搜索结果:");
    results.slice(0, 3).forEach((result, i) => {
      console.log(`${i + 1}. ${result}`);
    });

    // 11. 截图保存
    await googlePage.screenshot({ path: "google-results.png" });
    await examplePage.screenshot({ path: "example-com.png" });
    console.log("截图已保存");

    // 12. 关闭浏览器
    await browser.close();
    console.log("浏览器已关闭");
  } catch (error) {
    console.error("运行出错:", error);
  }
}

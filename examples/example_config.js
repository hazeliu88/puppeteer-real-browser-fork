// 使用try-catch实现双模式支持
try {
  const { connect, defaultFingerprint } = require("puppeteer-real-browser-bit");
  runExample({ connect, defaultFingerprint });
} catch (e) {
  console.log("检测到本地开发模式，使用相对路径导入...");
  const { connect, defaultFingerprint } = require("../index");
  runExample({ connect, defaultFingerprint });
}

// 实际运行的示例代码
async function runExample({ connect, defaultFingerprint }) {
  try {
    // 自定义配置
    const { browser, page } = await connect({
      debug: true,
      bitBrowser: {
        fingerprint: {
          ...defaultFingerprint, // 使用默认配置作为基础
          os: "mac",
          platform: "macos",
          resolution: "2560x1440",
          language: "zh-CN,zh",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        connectOption: {
          evasion: {
            recaptcha: false,
          },
        },
      },
    });

    // 2. 导航到Google
    await page.goto("https://www.google.com");

    // 3. 打印页面标题
    console.log(await page.title());

    // 4. 关闭浏览器
    await browser.close();
    console.log("浏览器已关闭");
  } catch (error) {
    console.error("运行出错:", error);
  }
}

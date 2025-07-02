// 默认指纹配置
exports.defaultFingerprint = {
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

// 默认连接选项
exports.defaultConnectOption = {
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

// 默认比特浏览器配置
exports.defaultBitBrowserConfig = {
  apiUrl: "http://127.0.0.1:54345",
  name: `puppeteer-browser-${Date.now()}`,
  fingerprint: this.defaultFingerprint,
  proxy: {},
};

declare module "puppeteer-real-browser" {
  import type { Browser, Page } from "rebrowser-puppeteer-core";
  import type { GhostCursor } from "ghost-cursor";
  import { Builder } from "selenium-webdriver";
  import { Options as ChromeOptions } from "selenium-webdriver/chrome";

  export function connect(options: Options): Promise<ConnectResult>;
  export const BitBrowserAPI: typeof BitBrowserAPI;
  export const BitBrowserManager: typeof BitBrowserManager;

  interface PageWithCursor extends Page {
    realClick: GhostCursor["click"];
    realCursor: GhostCursor;
  }

  type ConnectResult = {
    browser: Browser;
    page: PageWithCursor;
    $chrome?: any;
    $xvfb?: any;
  };

  interface Options {
    args?: string[];
    headless?: boolean;
    customConfig?: import("chrome-launcher").Options;
    proxy?: ProxyOptions;
    turnstile?: boolean;
    connectOption?: import("rebrowser-puppeteer-core").ConnectOptions;
    disableXvfb?: boolean;
    plugins?: import("puppeteer-extra").PuppeteerExtraPlugin[];
    ignoreAllFlags?: boolean;
    bitBrowser?: BitBrowserOptions;
    debug?: boolean;
  }

  interface ProxyOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
  }
  
  interface BitBrowserOptions {
    apiUrl?: string;
    browserId?: string;
    name?: string;
    fingerprint?: FingerprintOptions;
    proxy?: ProxyOptions;
    debug?: boolean;
  }
  
  interface FingerprintOptions {
    coreVersion?: string;
    [key: string]: any;
  }
  
  // 比特浏览器API接口
  interface BitBrowserAPI {
    new(options?: { apiUrl?: string; debug?: boolean }): BitBrowserAPI;
    createOrUpdateBrowser(config: BrowserConfig): Promise<string>;
    partialUpdateBrowser(ids: string[], updates: Partial<BrowserConfig>): Promise<any>;
    openBrowser(browserId: string): Promise<BrowserInfo>;
    closeBrowser(browserId: string): Promise<void>;
    deleteBrowser(browserId: string): Promise<void>;
    getBrowserInstance(browserId: string): Promise<WebDriver>;
    getPuppeteerInstance(browserId: string): Promise<{ browser: Browser; page: Page }>;
  }
  
  interface BrowserConfig {
    name?: string;
    remark?: string;
    proxyMethod?: number;
    proxyType?: string;
    host?: string;
    port?: string;
    proxyUserName?: string;
    fingerprint?: FingerprintOptions;
  }
  
  interface BrowserInfo {
    id: string;
    http: string;
    driver: string;
    [key: string]: any;
  }
  
  interface WebDriver extends Builder {
    // Selenium WebDriver 方法
  }
  
  // 比特浏览器管理器接口
  interface BitBrowserManager {
    new(options?: BitBrowserManagerOptions): BitBrowserManager;
    launch(): Promise<void>;
    newTab(url?: string): Promise<TabInfo>;
    listTabs(): Promise<TabInfo[]>;
    closeTab(tabId: string): Promise<void>;
    activateTab(tabId: string): Promise<void>;
    close(): void;
    isRunning(): boolean;
  }
  
  interface BitBrowserManagerOptions {
    host?: string;
    port?: number;
    executablePath?: string;
    userDataDir?: string;
    headless?: boolean;
    debug?: boolean;
    proxy?: ProxyOptions;
    windowSize?: string;
  }
  
  interface TabInfo {
    id: string;
    url: string;
    title: string;
    webSocketDebuggerUrl: string;
    [key: string]: any;
  }
}
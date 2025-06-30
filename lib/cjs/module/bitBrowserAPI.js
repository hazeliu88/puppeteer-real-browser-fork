const axios = require('axios');
const { BitBrowserLogger } = require('./bitBrowserHelper.js');

class BitBrowserAPI {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'http://127.0.0.1:54345';
    this.headers = {
      'Content-Type': 'application/json'
    };
    this.logger = new BitBrowserLogger(options.debug);
  }

  /**
   * 创建或更新浏览器窗口
   * @param {Object} config - 浏览器配置
   * @returns {Promise<string>} 浏览器ID
   */
  async createOrUpdateBrowser(config) {
    try {
      const payload = {
        name: config.name || `browser-${Date.now()}`,
        remark: config.remark || '',
        proxyMethod: config.proxyMethod || 2,
        proxyType: config.proxyType || 'noproxy',
        host: config.host || '',
        port: config.port || '',
        proxyUserName: config.proxyUserName || '',
        browserFingerPrint: config.fingerprint || {
          coreVersion: '124'
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/browser/update`,
        payload,
        { headers: this.headers }
      );

      const browserId = response.data.data.id;
      this.logger.log(`Created/updated browser with ID: ${browserId}`);
      return browserId;
    } catch (error) {
      this.logger.error('Browser creation/update failed', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 打开浏览器窗口
   * @param {string} browserId - 浏览器ID
   * @returns {Promise<Object>} 浏览器信息
   */
  async openBrowser(browserId) {
    try {
      const payload = { id: browserId };
      const response = await axios.post(
        `${this.apiUrl}/browser/open`,
        payload,
        { headers: this.headers }
      );

      const browserInfo = response.data.data;
      this.logger.log(`Opened browser ${browserId} at ${browserInfo.http}`);
      
      // 获取WebSocket调试URL
      const wsUrl = `ws://${browserInfo.http}/devtools/browser`;
      browserInfo.wsUrl = wsUrl;
      this.logger.log(`WebSocket debugger URL: ${wsUrl}`);
      
      return browserInfo;
    } catch (error) {
      this.logger.error('Browser opening failed', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 关闭浏览器窗口
   * @param {string} browserId - 浏览器ID
   * @returns {Promise<void>}
   */
  async closeBrowser(browserId) {
    try {
      const payload = { id: browserId };
      await axios.post(
        `${this.apiUrl}/browser/close`,
        payload,
        { headers: this.headers }
      );
      this.logger.log(`Closed browser ${browserId}`);
    } catch (error) {
      this.logger.warn('Browser close failed', error.response?.data || error.message);
    }
  }

  /**
   * 删除浏览器窗口
   * @param {string} browserId - 浏览器ID
   * @returns {Promise<void>}
   */
  async deleteBrowser(browserId) {
    try {
      const payload = { id: browserId };
      await axios.post(
        `${this.apiUrl}/browser/delete`,
        payload,
        { headers: this.headers }
      );
      this.logger.log(`Deleted browser ${browserId}`);
    } catch (error) {
      this.logger.warn('Browser deletion failed', error.response?.data || error.message);
    }
  }

  /**
   * 获取浏览器实例 (Puppeteer)
   * @param {string} browserId - 浏览器ID
   * @returns {Promise<Object>} { browser, page } Puppeteer 实例
   */
  async getPuppeteerInstance(browserId) {
    try {
      const browserInfo = await this.openBrowser(browserId);
      
      // 使用 Puppeteer
      const puppeteer = require('puppeteer-core');
      
      const browser = await puppeteer.connect({
        browserWSEndpoint: browserInfo.wsUrl,
        defaultViewport: null
      });
      
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      
      this.logger.log(`Created Puppeteer instance for browser ${browserId}`);
      return { browser, page };
    } catch (error) {
      this.logger.error(`Failed to create Puppeteer instance: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BitBrowserAPI;
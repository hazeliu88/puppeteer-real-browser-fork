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

      // 检查响应结构
      if (!response.data || !response.data.data || !response.data.data.id) {
        throw new Error('Invalid API response structure');
      }

      const browserId = response.data.data.id;
      this.logger.log(`Created/updated browser with ID: ${browserId}`);
      return browserId;
    } catch (error) {
      this.logger.error('Browser creation/update failed', error.response?.data || error.message);
      throw error;
    }
  }

  async openBrowser(browserId, maxRetries = 3, retryDelay = 2000) {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const payload = { id: browserId };
        const response = await axios.post(
          `${this.apiUrl}/browser/open`,
          payload,
          { 
            headers: this.headers,
            timeout: 100000 // 10秒超时
          }
        );

        // 记录完整的响应数据
        this.logger.log(`Open browser response: ${JSON.stringify(response.data)}`);
        
        // 检查响应结构
        if (!response.data || !response.data.data) {
          throw new Error('Invalid API response structure');
        }
        
        const browserInfo = response.data.data;
        
        if (!browserInfo.http) {
          throw new Error('Browser info does not contain http address');
        }
        
        this.logger.log(`Opened browser ${browserId} at ${browserInfo.http}`);
        
        // 获取WebSocket URL
        const wsUrl = await this.getWebSocketUrl(browserInfo.http, maxRetries, retryDelay);
        browserInfo.wsUrl = wsUrl;
        this.logger.log(`WebSocket debugger URL: ${wsUrl}`);
        
        return browserInfo;
      } catch (error) {
        retries++;
        this.logger.error(`Browser open failed (attempt ${retries}/${maxRetries}): ${error.message}`);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async getWebSocketUrl(httpAddress, maxRetries = 5, retryDelay = 1000) {
    const debugUrl = `http://${httpAddress}/json/version`;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await axios.get(debugUrl, { timeout: 2000 });
        
        if (!response.data || !response.data.webSocketDebuggerUrl) {
          throw new Error('Invalid WebSocket URL response');
        }
        
        const webSocketUrl = response.data.webSocketDebuggerUrl;
        this.logger.log(`Found WebSocket URL: ${webSocketUrl}`);
        return webSocketUrl;
      } catch (error) {
        retries++;
        this.logger.log(`Retrying WebSocket URL detection (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 如果无法获取 WebSocket URL，使用默认格式
    const fallbackUrl = `ws://${httpAddress}/devtools/browser`;
    this.logger.warn(`Using fallback WebSocket URL: ${fallbackUrl}`);
    return fallbackUrl;
  }

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
      this.logger.error('Browser deletion failed', error.response?.data || error.message);
    }
  }
}

module.exports = BitBrowserAPI;
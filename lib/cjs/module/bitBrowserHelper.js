const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class BitBrowserLogger {
  constructor(debug = false, logFile) {
    this.debug = debug;
    this.logFile = logFile;
    if (logFile) {
      // 确保日志目录存在
      const dir = path.dirname(logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // 创建文件流
      this.stream = fs.createWriteStream(logFile, { flags: 'a' });
    }
  }

  log(message) {
    if (this.debug) {
      console.log(message);
    }
    if (this.stream) {
      this.stream.write(`[LOG] ${message}\n`);
    }
  }

  error(message) {
    if (this.debug) {
      console.error(message);
    }
    if (this.stream) {
      this.stream.write(`[ERROR] ${message}\n`);
    }
  }

  warn(message) {
    if (this.debug) {
      console.warn(message);
    }
    if (this.stream) {
      this.stream.write(`[WARN] ${message}\n`);
    }
  }
}

class BitBrowserHelper {
    constructor(options = {}, logger = new BitBrowserLogger()) {
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 54321;
        this.tabId = options.tabId || null;
        this.logger = logger;
        this.apiEndpoint = `http://${this.host}:${this.port}`;
    }
    
    async getTab() {
        try {
            // 获取所有标签页
            const tabs = await this.httpGetJson(`${this.apiEndpoint}/json/list`);
            this.logger.log(`Found ${tabs.length} tabs`);
            
            // 查找指定标签页或获取第一个
            let tab = this.tabId 
                ? tabs.find(t => t.id === this.tabId) 
                : tabs[0];
            
            if (!tab) {
                if (this.tabId) {
                    throw new Error(`Tab ${this.tabId} not found`);
                }
                // 如果没有标签页，创建一个新的
                this.logger.log('No tabs found, creating new tab');
                const newTab = await this.newTab();
                tab = newTab;
            }
            
            this.logger.log(`Using tab: ${tab.id}`);
            return tab;
        } catch (err) {
            this.logger.error(`Failed to get tab: ${err.message}`);
            throw err;
        }
    }
    
    async newTab(url = 'about:blank') {
        try {
            const tab = await this.httpGetJson(`${this.apiEndpoint}/json/new?${url ? `url=${encodeURIComponent(url)}` : ''}`);
            this.logger.log(`Created new tab with id: ${tab.id}`);
            return tab;
        } catch (err) {
            this.logger.error(`Failed to create new tab: ${err.message}`);
            throw err;
        }
    }
    
    async httpGetJson(url) {
        return new Promise((resolve, reject) => {
            this.logger.log(`HTTP GET: ${url}`);
            
            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP error! status: ${res.statusCode}`));
                }

                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }
}

module.exports = { BitBrowserHelper, BitBrowserLogger };
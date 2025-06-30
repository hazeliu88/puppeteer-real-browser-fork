const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { BitBrowserHelper, BitBrowserLogger } = require('./bitBrowserHelper.js');

class BitBrowserManager {
    constructor(options = {}) {
        this.options = Object.assign({
            host: '127.0.0.1',
            port: 54321,
            executablePath: this.getDefaultExecutablePath(),
            userDataDir: this.getDefaultUserDataDir(),
            headless: false,
            debug: false,
            proxy: null,
            windowSize: '1920,1080'
        }, options);
        
        this.logger = new BitBrowserLogger(this.options.debug);
        this.process = null;
        this.apiEndpoint = `http://${this.options.host}:${this.options.port}`;
        this.helper = new BitBrowserHelper({ 
            host: this.options.host, 
            port: this.options.port 
        }, this.logger);
    }
    
    // 获取平台默认的可执行路径
    getDefaultExecutablePath() {
        switch (os.platform()) {
            case 'win32':
                return path.join(process.env.LOCALAPPDATA, 'BitBrowser', 'BitBrowser.exe');
            case 'darwin':
                return '/Applications/BitBrowser.app/Contents/MacOS/BitBrowser';
            case 'linux':
                return '/opt/BitBrowser/BitBrowser';
            default:
                return 'BitBrowser';
        }
    }
    
    // 获取默认用户数据目录
    getDefaultUserDataDir() {
        switch (os.platform()) {
            case 'win32':
                return path.join(process.env.LOCALAPPDATA, 'BitBrowser', 'User Data');
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'BitBrowser');
            case 'linux':
                return path.join(os.homedir(), '.config', 'BitBrowser');
            default:
                return path.join(os.tmpdir(), 'bitbrowser-user-data');
        }
    }
    
    // 启动比特浏览器
    async launch() {
        return new Promise((resolve, reject) => {
            if (this.isRunning()) {
                this.logger.log('BitBrowser is already running');
                return resolve();
            }
            
            // 确保用户数据目录存在
            if (!fs.existsSync(this.options.userDataDir)) {
                fs.mkdirSync(this.options.userDataDir, { recursive: true });
                this.logger.log(`Created user data directory: ${this.options.userDataDir}`);
            }
            
            const args = [
                `--remote-debugging-port=${this.options.port}`,
                `--user-data-dir="${this.options.userDataDir}"`,
                `--window-size=${this.options.windowSize}`
            ];
            
            if (this.options.proxy) {
                args.push(`--proxy-server=${this.options.proxy.host}:${this.options.proxy.port}`);
            }
            
            if (this.options.headless) {
                args.push('--headless');
            }
            
            this.logger.log(`Launching BitBrowser: ${this.options.executablePath} ${args.join(' ')}`);
            
            this.process = spawn(`"${this.options.executablePath}"`, args, {
                shell: true,
                stdio: 'ignore',
                detached: true
            });
            
            this.process.unref();
            
            // 监听进程退出
            this.process.on('error', (err) => {
                this.logger.error(`Failed to start BitBrowser: ${err.message}`);
                reject(err);
            });
            
            this.process.on('exit', (code) => {
                this.logger.log(`BitBrowser exited with code ${code}`);
                this.process = null;
            });
            
            // 检查浏览器是否准备好
            const checkReady = () => {
                this.httpGetJson(`${this.apiEndpoint}/json/version`)
                    .then(() => {
                        this.logger.log('BitBrowser is ready');
                        resolve();
                    })
                    .catch(() => {
                        setTimeout(checkReady, 1000);
                    });
            };
            
            setTimeout(checkReady, 2000);
        });
    }
    
    // 创建新标签页
    async newTab(url = 'about:blank') {
        await this.ensureRunning();
        return this.helper.newTab(url);
    }
    
    // 获取所有标签页
    async listTabs() {
        await this.ensureRunning();
        return this.helper.httpGetJson(`${this.apiEndpoint}/json/list`);
    }
    
    // 关闭标签页
    async closeTab(tabId) {
        await this.ensureRunning();
        return this.helper.httpGetJson(`${this.apiEndpoint}/json/close/${tabId}`);
    }
    
    // 激活标签页
    async activateTab(tabId) {
        await this.ensureRunning();
        return this.helper.httpGetJson(`${this.apiEndpoint}/json/activate/${tabId}`);
    }
    
    // 关闭浏览器
    close() {
        if (this.process) {
            this.logger.log('Closing BitBrowser');
            process.kill(-this.process.pid);
            this.process = null;
        }
    }
    
    // 检查浏览器是否在运行
    isRunning() {
        return !!this.process;
    }
    
    // 确保浏览器正在运行
    async ensureRunning() {
        if (!this.isRunning()) {
            await this.launch();
        }
    }
    
    // 通用HTTP GET请求
    async httpGetJson(url) {
        return new Promise((resolve, reject) => {
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

module.exports = { BitBrowserManager };
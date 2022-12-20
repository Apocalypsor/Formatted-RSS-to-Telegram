const config = require('../config').config;
let puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
const logger = require('../logger');

const options = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        `--user-agent=${config.userAgent}`
    ],
    headless: true,
    ignoreHTTPSErrors: true,
};

let proxyUri;
if (config.proxy) {
    proxyUri = `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`;
}


module.exports = async () => {
    const {addExtra} = require('puppeteer-extra');
    puppeteer = addExtra(puppeteer);

    puppeteer.use(require('puppeteer-extra-plugin-stealth')());

    let browser;
    if (proxyUri) {
        if (config.proxy.auth.username && config.proxy.auth.password) {
            // only proxies with authentication need to be anonymized
            if (proxyUri.startsWith('http:')) {
                options.args.push(`--proxy-server=${await proxyChain.anonymizeProxy(proxyUri)}`);
            } else {
                logger.warn('SOCKS/HTTPS proxy with authentication is not supported by puppeteer, continue without proxy');
            }
        } else {
            // Chromium cannot recognize socks5h and socks4a, so we need to trim their postfixes
            options.args.push(`--proxy-server=${proxyUri.replace('socks5h://', 'socks5://').replace('socks4a://', 'socks4://')}`);
        }
    }


    browser = await puppeteer.connect({
        browserWSEndpoint: config.puppeteerWSEndpoint,
    });

    setTimeout(() => {
        browser.close();
    }, 30000);

    return browser;
};
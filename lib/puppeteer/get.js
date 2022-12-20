const he = require('he');

const puppeteerGet = (url) => async () => {
    const browser = await require('./puppeteer')();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        request.resourceType() === 'document' ? request.continue() : request.abort();
    });
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
    });
    const html = await page.evaluate(() => document.documentElement.innerHTML);
    // noinspection ES6MissingAwait
    browser.close();
    return he.decode(html);
};

module.exports = {
    puppeteerGet,
};
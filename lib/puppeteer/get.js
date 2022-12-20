const he = require('he');
const logger = require("../logger");

const puppeteerGet = (url) => async () => {
    const browser = await require('./puppeteer')();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        request.resourceType() === 'document' ? request.continue() : request.abort();
    });
    await page.goto(url, {
        waitUntil: 'networkidle2',
    });

    await page.screenshot({path: `${__dirname}/../../logs/screenshots/${encodeURIComponent(url)}.png`, fullPage: true});
    logger.debug(`Screenshot saved for ${url}`);
    const html = await page.evaluate(() => document.documentElement.innerHTML);
    // noinspection ES6MissingAwait
    browser.close();
    return he.decode(html);
};

module.exports = {
    puppeteerGet,
};
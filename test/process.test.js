const processLib = require('../lib/process');

describe('test process', function () {
    test('test empty rssItem', async function () {
        const rssItem = {
            url: 'https://www.google.com/'
        };
        await processLib.process(rssItem);
    })
});
const processLib = require('../lib/process');

describe('test process', function () {
    test('test empty rssItem', async function () {
        const rssItem = {
            name: 'test',
            url: 'https://www.google.com/',
            sendTo: 'DovStream',
            text: 'test',
        };
        try {

            await processLib.process(rssItem);
        } catch (e) {
            expect(e).not.toBeNull();
        }
    });
});
const {parseRSSFeed, parseFullRSSFeed} = require('../lib/parser');

describe('test parse', function () {
    test('test parse', async function () {
        const rssContent = await parseRSSFeed('https://www.reddit.com/r/programming/.rss');
        expect(rssContent).not.toBeNull();
    });

    test('test full parse', async function () {
        const rssContent = await parseFullRSSFeed('https://www.reddit.com/r/programming/.rss');
        expect(rssContent).not.toBeNull();
    });
});
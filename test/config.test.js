const configLib = require('../lib/config');
const Config = require("../model/config");
const RSSModel = require("../model/rss");


describe('test config parser', () => {
    it('should parse config', () => {
        const config = configLib.checkConfig('../test/samples/config.yaml');
        expect(config).toStrictEqual(new Config({
            expireTime: '6h',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
            telegraphAccessToken: '123abc',
            notifyTelegramChatId: '123abc',
            telegram: [
                {
                    name: 'default',
                    token: '123abc',
                    chatId: '123abc',
                    parseMode: 'MarkdownV2',
                    disableNotification: true,
                    disableWebPagePreview: true
                },
                {
                    name: 'test',
                    token: '123abc',
                    chatId: '123abc',
                    parseMode: 'Markdown',
                    disableNotification: false,
                    disableWebPagePreview: false
                }
            ]
        }));
    });

    it('should throw error when config file not found', () => {
        expect(() => configLib.checkConfig('notfound.yaml')).toThrowError('Config file not found');
    });

    it('should parse rss', () => {
        const rss = configLib.checkRSS('../test/samples/rss.yaml');
        expect(rss).toStrictEqual(new RSSModel.RSS({
            rss: [
                new RSSModel.RSSItem({
                    name: 'test',
                    url: 'https://example.com/rss',
                    rules: [
                        {
                            obj: 'summary',
                            type: 'regex',
                            matcher: '原价：(.+) -> 现价：(.+)',
                            dest: 'price'
                        }
                    ],
                    filters: [
                        {
                            obj: 'title',
                            type: 'out',
                            matcher: '降价'
                        }
                    ],
                    text: '标题：{title}\n链接：{link}\n价格：{price}\n',
                    sendTo: 'telegram',
                    telegraph: false,
                    fullText: false,
                }),
                new RSSModel.RSSItem({
                    name: 'test1',
                    url: 'https://example.com/rss',
                    rules: [],
                    filters: [],
                    text: '123aaa',
                    sendTo: 'telegram',
                    telegraph: false,
                    fullText: false,
                }),
                new RSSModel.RSSItem({
                    name: 'test1',
                    url: 'https://example.com/rss',
                    rules: [],
                    filters: [],
                    text: '123aaa',
                    sendTo: 'email',
                    telegraph: false,
                    fullText: false,
                }),
                new RSSModel.RSSItem({
                    name: 'test1',
                    url: 'https://example.com/rss1',
                    rules: [],
                    filters: [],
                    text: '123aaa',
                    sendTo: 'telegram',
                    telegraph: false,
                    fullText: false,
                }),
                new RSSModel.RSSItem({
                    name: 'test1',
                    url: 'https://example.com/rss1',
                    rules: [],
                    filters: [],
                    text: '123aaa',
                    sendTo: 'email',
                    telegraph: false,
                    fullText: false,
                })
            ]
        }));
    });
});
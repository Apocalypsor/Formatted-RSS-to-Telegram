const {escapeTemplate, render} = require('../lib/render');

describe('test escape', function () {
    test('test escapeTemplate', function () {
        const template = `
            🧬 App优惠：*{{ title }}*
            🚀 价格：{{ price[1] }} —\\> {{ price[2] }}
            🚀 平台：{{ platform }}
            🚀 描述：{% if "<" in description %}无{% else %}{{ description }}{% endif %}
            🎯 下载链接：[点击此处]({{ link }})
            #App优惠
        `;

        const parseMode = 'markdownv2';
        expect(escapeTemplate(template, parseMode)).toBe(`
            🧬 App优惠：*{{ title }}*
            🚀 价格：{{ price[1] }} —\\\\> {{ price[2] }}
            🚀 平台：{{ platform }}
            🚀 描述：{% if "<" in description %}无{% else %}{{ description }}{% endif %}
            🎯 下载链接：[点击此处]({{ link }})
            \\#App优惠
        `);
    });

    test('test render', function () {
        const template = `
            🎥 订阅更新：*{{ title }}*

            🏆 Youtuber：*{{ author }}*

            🎯 直达链接：[点击此处]({{ link }})

            #YouTube订阅
        `;
        const data = {
            author: "老高與小茉 Mr & Mrs Gao",
            title: "沒人可以看完這個影片，因為不超過2分鐘你就會睡著了 | 老高與小茉 Mr & Mrs Gao",
            "link": "https://www.youtube.com/watch?v=EyPi:09.000Z",
            id: "yt:video:EyPi1OlkCJE",
            "isoDate": "2022-12-14T12:15:09.000Z",
            rss_name: "Youtube 订阅",
            rss_url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCMUnInmOkrWN4gof9KlhNmQ"
        };

        const parseMode = 'markdownv2';
        expect(render(template, data, parseMode)).toBe(`
            🎥 订阅更新：*沒人可以看完這個影片，因為不超過2分鐘你就會睡著了 \\| 老高與小茉 Mr &amp; Mrs Gao*

            🏆 Youtuber：*老高與小茉 Mr &amp; Mrs Gao*

            🎯 直达链接：[点击此处](https://www\\.youtube.com/watch?v\\=EyPi:09.000Z)

            \\#YouTube订阅
        `);
    });
});
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
            🚀 价格： —\\\\> 
            🚀 平台：
            🚀 描述：无
            🎯 下载链接：[点击此处]()
            \\#App优惠
        `);
    });

    test('test render', function () {
        const template = `
            🧬 App优惠：*{{ title }}*
            #App优惠
        `;
        const data = {
            title: 'test'
        };
        const parseMode = 'markdownv2';
        expect(render(template, data, parseMode)).toBe(`
            🧬 App优惠：*test*
            \\#App优惠
        `);
    });
});
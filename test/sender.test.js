const sender = require('../lib/sender');
const {editStatus} = require("../model/status");

describe('test sender', () => {
    test('test send', async () => {
        const messageId = await sender.send('default', '🧬 App优惠：*test*\n            \\#App优惠');
        expect(messageId).toBeGreaterThan(0);
    });

    test('test edit', async () => {
        const messageId = await sender.send('default', '🧬 App优惠：*test*\n            \\#App优惠');
        const resStatus = await sender.edit('default', '123', messageId);
        expect(resStatus).toBe(editStatus.SUCCESS);
    });
})
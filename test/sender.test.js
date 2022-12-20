const sender = require('../lib/sender');
const {editStatus} = require("../model/status");
const {getSender} = require("../lib/sender");

describe('test sender', () => {
    test('test send', async () => {
        const messageId = await sender.send(getSender('default'), '🧬 App优惠：*test*\n            \\#App优惠');
        expect(messageId).toBeGreaterThan(0);
    });

    test('test edit', async () => {
        const messageId = await sender.send(getSender('default'), '🧬 App优惠：*test*\n            \\#App优惠');
        const resStatus = await sender.edit(getSender('default'), '123', messageId);
        expect(resStatus).toBe(editStatus.SUCCESS);
    });

    test('test edit not found', async () => {
        const resStatus = await sender.edit(getSender('default'), '123', -1);
        expect(resStatus).toBe(editStatus.NOT_FOUND);
    });
})
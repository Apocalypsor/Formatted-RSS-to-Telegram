const dbLib = require('../lib/db');

describe('test db', function () {
    test('test db', async function () {
        const db = await dbLib.init();
        const result = db.exec(`
            SELECT *
            FROM history;
        `);
        expect(result).not.toBeNull();
    });
});
const tool = require('../lib/tools');

describe('test tool', function () {
    test('test isInteger', async function () {
        expect(tool.isInteger(123)).toBe(true);
        expect(tool.isInteger('123')).toBe(true);
        expect(tool.isInteger('abcs')).toBe(false);
        expect(tool.isInteger(123.1)).toBe(true);
    });

    test('test isNumeric', async function () {
        const test = {
            '123': 10281409,
            'test1': {
                '123': 1571782,
            },
            'test2': {
                '0': 12909394,
            },
            'test3': [
                '123asdasd',
            ]
        }

        expect(tool.getObj(test, '123')).toBe(10281409);
        expect(tool.getObj(test, 'test1.123')).toBe(1571782);
        expect(tool.getObj(test, 'test2.0')).toBe(12909394);
        expect(tool.getObj(test, 'test3.0')).toBe('123asdasd');
    });
});
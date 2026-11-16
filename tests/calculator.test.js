const { add, divide } = require('../src/calculator');

describe('calculator', () => {
  test('adds two numbers', () => expect(add(2, 3)).toBe(5));
  test('divides two numbers', () => expect(divide(10, 4)).toBe(2.5));
  test('rejects division by zero', () => expect(() => divide(1, 0)).toThrow(RangeError));
  test('rejects non-numbers', () => expect(() => add('1', 2)).toThrow(TypeError));
});

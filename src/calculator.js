// Small piece of business logic so the unit tests cover real behaviour, not just HTTP plumbing.
function add(a, b) {
  assertNumbers(a, b);
  return a + b;
}

function divide(a, b) {
  assertNumbers(a, b);
  if (b === 0) throw new RangeError('Cannot divide by zero');
  return a / b;
}

function assertNumbers(...values) {
  if (values.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new TypeError('Arguments must be numbers');
  }
}

module.exports = { add, divide };

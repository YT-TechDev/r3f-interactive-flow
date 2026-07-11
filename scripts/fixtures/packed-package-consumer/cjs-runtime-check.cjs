const flow = require("r3f-interactive-flow");

const expected = JSON.parse(process.env.EXPECTED_RUNTIME_EXPORTS ?? "[]")
  .slice()
  .sort();
const actual = Object.keys(flow).sort();

const matches =
  expected.length === actual.length && expected.every((name, index) => name === actual[index]);

if (!matches) {
  console.error(
    `Expected runtime exports ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
  process.exit(1);
}

console.log(JSON.stringify(actual));

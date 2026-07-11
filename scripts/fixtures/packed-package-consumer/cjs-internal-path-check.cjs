const internalSpecifiers = [
  "r3f-interactive-flow/dist/index.js",
  "r3f-interactive-flow/src/index.ts"
];

let failed = false;

for (const specifier of internalSpecifiers) {
  try {
    require(specifier);
    console.error(`Expected "${specifier}" to be rejected by package exports, but it resolved.`);
    failed = true;
  } catch (err) {
    if (err.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      console.error(
        `Expected "${specifier}" to fail with ERR_PACKAGE_PATH_NOT_EXPORTED, got ${err.code}: ${err.message}`
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Internal paths correctly rejected (CJS).");

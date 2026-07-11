import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error"
    }
  },
  {
    files: [
      "scripts/fixtures/packed-package-consumer/**/*.cjs",
      "scripts/fixtures/packed-package-consumer/**/*.cts"
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);

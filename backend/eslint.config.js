import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "no-process-exit": "off",
      "prefer-const": "warn",
      "no-empty": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "warn"
    }
  },

  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.js",
      "coverage/**",
      "cloudflare/**",
      "shim-require.ts",
      "tsup.config.cjs"
    ]
  }
);
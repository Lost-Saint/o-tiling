import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint";

export default defineConfig(
  {
    name: "o-tiling/ignores",
    ignores: ["dist/**", "node_modules/**", "venv/**", "*.zip"],
  },
  {
    name: "o-tiling/linter-options",
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    name: "o-tiling/typescript",
    files: ["src/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        Uint8Array: "readonly",
        ARGV: "readonly",
        Debugger: "readonly",
        GIRepositoryLib: "readonly",
        global: "readonly",
        imports: "readonly",
        Intl: "readonly",
        log: "readonly",
        print: "readonly",
        printerr: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-array-constructor": "warn",
      "no-case-declarations": "off",
      "no-empty": "off",
      "no-undef": "off",
      "no-useless-assignment": "warn",
      "no-var": "warn",
      "no-unused-vars": "off",
      "prefer-const": "warn",
    },
  },
  {
    name: "o-tiling/declarations",
    files: ["src/**/*.d.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);

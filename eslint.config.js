import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const gjsGlobals = {
    global: 'readonly',
    log: 'readonly',
    Uint8Array: 'readonly',
    ARGV: 'readonly',
    Debugger: 'readonly',
    GIRepositoryLib: 'readonly',
    imports: 'readonly',
    Intl: 'readonly',
    print: 'readonly',
    printerr: 'readonly',
    window: 'readonly',
};

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**', 'venv/**', '*.zip'],
    },
    {
        files: ['src/**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
        ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: gjsGlobals,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
            '@typescript-eslint/restrict-plus-operands': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            'no-undef': 'off',
            'no-unused-vars': 'off',
        },
    },
);

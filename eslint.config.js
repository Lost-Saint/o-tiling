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
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
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

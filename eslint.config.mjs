import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        // Node.js files (hub, agent)
        files: ['apps/hub/**/*.ts', 'apps/agent/**/*.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        // Browser files (web app)
        files: ['apps/web/**/*.{ts,vue}'],
        languageOptions: {
            globals: globals.browser,
        },
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'vue/multi-word-component-names': 'off',
        },
    },
    {
        ignores: ['**/node_modules/**', '**/dist/**', '**/migrations/**'],
    }
)
import js from '@eslint/js';

const scopedFiles = [
    "./*.{js,ts}",     // Include JavaScript files in the root folder
    "lib/**/*.js" // Include JavaScript files in the lib folder and subfolders
];

export default [
    // Catches real bugs (unused vars, undefined names, unreachable code, ...) - the rules
    // below this only enforce formatting, they never checked correctness. Scoped to the same
    // files as the rest of this config on purpose: test/**, admin/** and other files outside
    // that scope were never linted before and pulling them in now would mix in a separate,
    // unrelated cleanup (different global environments, different conventions).
    { ...js.configs.recommended, files: scopedFiles },
    {
        files: scopedFiles,
        languageOptions: {
            ecmaVersion: 'latest',
            // These are CommonJS files (require/module.exports), not ES modules.
            sourceType: 'commonjs',
            globals: {
                // Mocha globals
                describe: 'readonly',
                it: 'readonly',
                before: 'readonly',
                after: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',

                // Node.js globals
                global: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly'
            }
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            'no-console': 'off',
            'no-var': 'error',
            'no-trailing-spaces': 'error',
            'prefer-const': 'error',
            quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ['error', 'always'],
            // create-adapter's default `no-unused-vars` is a bit too eager to flag intentionally
            // unused function arguments (e.g. callback signatures), so only flag unused vars.
            'no-unused-vars': ['error', { args: 'none' }],
        }
    }
];

export default [
    {
        files: [
          "./*.{js,ts}",     // Include JavaScript files in the root folder
          "lib/**/*.{js,ts}" // Include JavaScript files in the lib folder and subfolders
        ],            
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
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
                module: 'readonly'
            }
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            'no-console': 'off',
            'no-var': 'error',
            'no-trailing-spaces': 'error',
            'prefer-const': 'error',
            quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ['error', 'always']
        }
    }
];

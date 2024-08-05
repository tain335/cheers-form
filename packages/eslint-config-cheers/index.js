const prettierConfig = {
  // 一行最多 120 字符
  printWidth: 120,
  // 使用 2 个空格缩进
  tabWidth: 2,
  // 不使用缩进符，而使用空格
  useTabs: false,
  // 行尾需要有分号
  semi: true,
  // 使用单引号
  singleQuote: true,
  // 对象的 key 仅在必要时用引号
  quoteProps: 'as-needed',
  // jsx 不使用单引号，而使用双引号
  jsxSingleQuote: false,
  // 末尾需要有逗号
  trailingComma: 'all',
  // 大括号内的首尾需要空格
  bracketSpacing: true,
  // jsx 标签的反尖括号需要换行
  jsxBracketSameLine: false,
  // 箭头函数，只有一个参数的时候，也需要括号
  arrowParens: 'always',
  // 每个文件格式化的范围是文件的全部内容
  rangeStart: 0,
  rangeEnd: Infinity,
  // 不需要写文件开头的 @prettier
  requirePragma: false,
  // 不需要自动在文件开头插入 @prettier
  insertPragma: false,
  // 使用默认的折行标准
  proseWrap: 'preserve',
  // 根据显示样式决定 html 要不要折行
  htmlWhitespaceSensitivity: 'css',
  // vue 文件中的 script 和 style 内不用缩进
  vueIndentScriptAndStyle: false,
  // 换行符使用 lf
  endOfLine: 'lf'
};

module.exports = {
  ignorePatterns: ['.eslintrc.js', 'prettier.config.js', 'config-overrides.js', 'scripts/**', 'i18n/**', 'lib', '**/node_modules/**', 'commitlint.config.js', 'config-overrides.js', 'jest.config.js', 'vite.config.js'],
  extends: ['airbnb', 'prettier', 'plugin:prettier/recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended', 'plugin:i18next/recommended'],
  env: {
    browser: true
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      typescript: {
        alwaysTryTypes: true,
        project: ['./packages/*/tsconfig.json', './tsconfig.json']
      },
    },
    react: {
      version: '17.0',
    },
    polyfills: ['Promise', 'URL'],
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {},
  plugins: ['react', 'import', 'prettier', '@typescript-eslint', 'i18next'],
  rules: {
    '@typescript-eslint/no-empty-function': 1,
    'import/prefer-default-export': 0,
    'react/jsx-no-useless-fragment': 0,
    'react/function-component-definition': 0,
    'react/jsx-filename-extension': 0,
    'react/require-default-props': 0,
    'react/jsx-props-no-spreading': 0,
    'react/no-unstable-nested-components': 0,
    'react/display-name': 0,
    'react/destructuring-assignment': 0,
    'import/extensions': 0,
    'no-use-before-define': 0,
    'prettier/prettier': [
      "error",
      prettierConfig
    ],
    "import/no-extraneous-dependencies": 0,
    "import/newline-after-import": [2, { "count": 1}],
    "no-constructor-return": 0,
    "@typescript-eslint/no-this-alias": 0,
    "no-await-in-loop": 0,
    "no-debugger": 1,
    "no-plusplus": 0,
    "no-bitwise": 0,
    "no-loop-func": 0,
    "no-param-reassign": 1,
    "@typescript-eslint/ban-ts-comment": 0,
    "import/order": [2, {
      "pathGroups": [
        {
          "pattern": "react",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "react-dom",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "react-router-dom",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "@src/**",
          "group": "index",
          "position": "before"
        },
        {
          "pattern": "@hooks/**",
          "group": "index",
          "position": "before"
        },
        {
          "pattern": "@utils/**",
          "group": "index",
          "position": "before"
        }
      ],
      "pathGroupsExcludedImportTypes": ["react", "react-router-dom", "react-dom"],
      "groups": ["external", "builtin", "index", "sibling", "parent", "internal", "object", "type"]
    }],
    "no-underscore-dangle": 0,
    "no-shadow": 0,
    "no-unused-vars": 0,
    "no-restricted-syntax": 0,
    "@typescript-eslint/no-shadow": 1,
    "@typescript-eslint/no-unused-vars": 1,
    "jsx-a11y/click-events-have-key-events": 0,
    "jsx-a11y/no-static-element-interactions": 0,
    "max-classes-per-file": 0,
    "class-methods-use-this": 0,
    "i18next/no-literal-string": 0,
    "react/prop-types": 0,
    "react/no-unused-prop-types": 1
  },
};

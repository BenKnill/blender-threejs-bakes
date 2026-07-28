import globals from "globals";

const sourceRules = {
  "no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
  "no-undef": "error",
  "prefer-const": "error",
  "no-var": "error",
  eqeqeq: ["error", "always"],
};

export default [
  {
    ignores: ["editor/vendor/**", "assets/glb/**", "renders/**"],
  },
  {
    files: ["editor/**/*.js", "physics/labs/*/demo/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      ...sourceRules,
      "max-lines": ["warn", { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: sourceRules,
  },
];

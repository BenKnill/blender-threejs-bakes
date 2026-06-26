import globals from "globals";

export default [
  {
    ignores: ["editor/vendor/**", "assets/glb/**", "renders/**"],
  },
  {
    files: ["editor/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "max-lines": ["warn", { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
];

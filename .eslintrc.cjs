module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2024: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  settings: {
    react: {
      version: "detect"
    }
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "react/react-in-jsx-scope": "off"
  },
  ignorePatterns: ["build/", "dist/", "pnpm-lock.yaml", "coverage/", "node_modules/"]
};

# Quick Start: Code Analysis & Documentation Tools

> **Quick reference guide** for implementing code quality tools in Meowstik. See [CODE_ANALYSIS_AND_DOCUMENTATION_TOOLS.md](./CODE_ANALYSIS_AND_DOCUMENTATION_TOOLS.md) for comprehensive details.

## Recommended Immediate Actions

### Phase 1: Essential Tools (Start Here) ⭐

**Time to Implement**: 1-2 hours

```bash
# 1. Install ESLint, Prettier, and TypeDoc
npm install --save-dev \
  eslint prettier typedoc \
  @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks \
  eslint-config-prettier eslint-plugin-prettier \
  eslint-plugin-n

# 2. Create configuration files (see examples below)

# 3. Add npm scripts
npm pkg set scripts.lint="eslint . --ext .ts,.tsx"
npm pkg set scripts.lint:fix="eslint . --ext .ts,.tsx --fix"
npm pkg set scripts.format="prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
npm pkg set scripts.format:check="prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\""
npm pkg set scripts.docs:generate="typedoc"

# 4. Run initial check
npm run lint
npm run format:check
```

---

## Essential Configuration Files

### `.eslintrc.json`

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": { "jsx": true },
    "project": "./tsconfig.json"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off"
  },
  "settings": {
    "react": { "version": "detect" }
  }
}
```

### `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### `.prettierignore`

```
node_modules
dist
build
.git
*.log
coverage
docs/api
```

### `typedoc.json`

```json
{
  "entryPoints": [
    "shared/schema.ts",
    "server/storage.ts",
    "server/routes/**/*.ts",
    "client/src/hooks/**/*.ts"
  ],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/node_modules/**", "**/dist/**"],
  "excludePrivate": true,
  "readme": "README.md",
  "name": "Meowstik API Documentation"
}
```

---

## Phase 2: Security Scanning 🛡️

**Time to Implement**: 30 minutes

```bash
# Install Semgrep (macOS)
brew install semgrep

# Or via pip
pip install semgrep

# Run security scan
semgrep --config=auto

# Add to package.json
npm pkg set scripts.security:scan="semgrep --config=auto"
```

---

## Phase 3: Pre-commit Hooks (Optional) 🪝

**Time to Implement**: 15 minutes

```bash
# Install husky and lint-staged
npm install --save-dev husky lint-staged
npx husky init

# Add lint-staged config to package.json manually:
# "lint-staged": {
#   "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
#   "*.{json,md}": ["prettier --write"]
# }

# Create .husky/pre-commit (recommended to create manually)
# Content: #!/bin/sh
#          npx lint-staged
chmod +x .husky/pre-commit
```

---

## Phase 4: CI/CD Integration 🚀

**Time to Implement**: 30 minutes

Create `.github/workflows/code-quality.yml`:

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run check
      
      - name: Security Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/security-audit
```

---

## Tool Summary

| Tool | Purpose | Priority | Install Time |
|------|---------|----------|--------------|
| **ESLint** | Code linting | ⭐ High | 10 min |
| **Prettier** | Code formatting | ⭐ High | 5 min |
| **TypeDoc** | Documentation | ⭐ High | 5 min |
| **Semgrep** | Security scanning | 🛡️ High | 10 min |
| **Husky** | Pre-commit hooks | 🔧 Medium | 5 min |
| **GitHub Actions** | CI/CD | 🚀 Medium | 15 min |

**Total Setup Time**: ~1-2 hours for complete implementation

---

## Common Commands

```bash
# Development workflow
npm run lint              # Check for issues
npm run lint:fix          # Auto-fix issues
npm run format            # Format all files
npm run format:check      # Check formatting
npm run check             # TypeScript check
npm run docs:generate     # Generate docs

# Security
npm run security:scan     # Run Semgrep
npm audit                 # Check dependencies

# Pre-commit
git add .
git commit -m "message"   # Triggers hooks automatically
```

---

## VS Code Integration (Recommended)

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

Required VS Code extensions:
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

---

## Troubleshooting

### "ESLint is running but not showing errors"
- Check `.eslintrc.json` exists
- Reload VS Code window
- Check ESLint output panel for errors

### "Prettier and ESLint conflict"
- Ensure `eslint-config-prettier` is installed
- Add `"prettier"` to extends array in `.eslintrc.json`

### "TypeDoc not generating docs"
- Ensure types are exported
- Add JSDoc/TSDoc comments to functions
- Check `typedoc.json` entry points

### "Pre-commit hooks not running"
- Run `npx husky install`
- Check `.husky/pre-commit` is executable

---

## Next Steps

1. ✅ Implement Phase 1 (Essential Tools)
2. ✅ Fix initial linting/formatting issues
3. ✅ Add TSDoc comments to key functions
4. ✅ Implement Phase 2 (Security)
5. ✅ Review security scan results
6. ✅ Set up pre-commit hooks
7. ✅ Configure CI/CD pipeline
8. ✅ Generate and review documentation

---

## Additional Resources

- [Full Tool Guide](./CODE_ANALYSIS_AND_DOCUMENTATION_TOOLS.md)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [TypeDoc Documentation](https://typedoc.org/)
- [Semgrep Documentation](https://semgrep.dev/)

---

*Last updated: January 2026*

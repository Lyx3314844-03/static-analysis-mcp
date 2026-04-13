# Contributing to Static Analysis MCP

Thank you for your interest in contributing to Static Analysis MCP! We welcome contributions from the community.

## 🎯 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it before contributing.

## 📋 How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/yourusername/static-analysis-mcp/issues)
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/yourusername/static-analysis-mcp/issues/new)
- Provide as much detail as possible: OS, Node.js version, steps to reproduce, etc.

### Suggesting Enhancements

- Open a new issue with the "enhancement" label
- Clearly describe the enhancement and its benefits
- Provide examples of how it would work

### Your First Code Contribution

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots if the PR changes UI
- Update documentation if needed
- Add tests for new features
- Follow the existing code style

## 💻 Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Python >= 3.8 (optional, for advanced features)

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/static-analysis-mcp.git
cd static-analysis-mcp

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev
```

## 📝 Code Style

We use ESLint and Prettier to enforce code style:

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Guidelines

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/security-utils.test.js

# Run tests with coverage (if configured)
npm run test:coverage
```

### Writing Tests

- Place test files in the `tests/` directory
- Name test files: `<module-name>.test.js`
- Use Node.js built-in test runner
- Test both success and error cases
- Mock external dependencies

## 📚 Documentation

- Update README.md if you change features
- Add JSDoc comments for new functions
- Update API documentation
- Include code examples

### Documentation Style

- Use clear, concise language
- Provide code examples
- Include parameter and return value descriptions
- Link to related documentation

## 🚀 Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a release tag
4. Publish to npm: `npm publish`
5. Create GitHub release

## ❓ Questions?

Feel free to open an issue with your question or reach out to the maintainers.

## 🙏 Thank You

We appreciate all contributions, big and small. Every contribution helps make this project better!

---

Happy coding! 🎉

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-14

### 🎉 Initial Release

#### Added
- **50+ MCP Tools** for comprehensive code analysis
  - Core analysis tools (analyze_file, analyze_files, analyze_directory, etc.)
  - Security analysis tools (analyze_security, analyze_bandit, analyze_eslint_security, etc.)
  - Complexity analysis tools (analyze_complexity, get_complexity_metrics, compare_complexity)
  - Code review tools (code_review, detect_errors)
  - Dependency analysis tools (check_dependencies, supply_chain_scan)
  - Log analysis tools (analyze_log_file, analyze_log_directory)
  - AI-powered tools (ai_fix_suggestion, multi_model_fix, predict_risks)
  - Project analysis tools (analyze_project, scan_project, auto_fix)
  - Utility tools (get_supported_rules, clear_cache, export_sarif, etc.)

- **Multi-Language Support** for 28+ programming languages
  - JavaScript, TypeScript, Python, Java, Go, Rust
  - C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala
  - R, Julia, Lua, Shell, SQL, HTML, CSS, YAML, JSON, XML, Markdown, Dart, Elixir

- **Security Vulnerability Detection**
  - SQL Injection, XSS, Command Injection
  - Path Traversal, Hardcoded Credentials
  - Insecure Cryptography, Prototype Pollution
  - Bandit-style, ESLint-plugin-security style, SonarQube-style, Semgrep-style analysis

- **Complexity Analysis**
  - Cyclomatic Complexity
  - Cognitive Complexity
  - Halstead Metrics
  - Maintainability Index
  - Nesting Depth Analysis

- **AI-Powered Features**
  - Automated Code Review (CodeRabbit-style)
  - AI Fix Suggestions with multiple LLM models
  - Risk Prediction and Technical Debt Analysis
  - GitHub PR Integration

- **Dependency Analysis**
  - Vulnerability Scanning
  - Outdated Package Detection
  - License Risk Analysis
  - Supply Chain Security

- **Integration & Collaboration**
  - GitHub PR Review
  - Slack Notifications
  - Web Dashboard
  - Team Dashboard
  - SARIF Export

- **Cross-Platform Support**
  - Windows (10/11)
  - macOS (12+)
  - Linux (Ubuntu/Debian/Fedora)

- **Security Features**
  - Path Traversal Protection
  - Symlink Protection
  - Input Validation
  - Secure Process Execution
  - Rate Limiting
  - Zero-Data-Retention Mode

- **Performance Optimizations**
  - 5-minute TTL caching with automatic invalidation
  - Parallel processing with multi-worker scanning
  - Streaming glob for memory efficiency
  - Incremental analysis
  - Configurable limits (maxFiles, timeout, workers)

- **Documentation**
  - Comprehensive README.md with ASCII art
  - Cross-platform installation guide
  - API examples for all tools
  - Contributing guidelines
  - Issue and PR templates

#### Technical Details
- Built with Node.js and MCP SDK
- Hybrid transport support (stdio + HTTP)
- Python integration for advanced features
- ESLint and TypeScript integration
- Comprehensive test suite
- CI/CD pipeline with GitHub Actions
- npm package with cross-platform compatibility

---

## [Unreleased]

### Planned Features
- [ ] Support for more programming languages
- [ ] Enhanced AI-powered analysis
- [ ] Real-time collaboration features
- [ ] Custom rule engine
- [ ] Plugin system
- [ ] GraphQL API
- [ ] WebSocket support for live updates
- [ ] Advanced reporting and analytics
- [ ] Integration with more CI/CD platforms
- [ ] Mobile app for code review

### Under Consideration
- WebAssembly support for performance
- Multi-cloud deployment options
- Enterprise SSO integration
- Custom branding for dashboards
- Advanced access control
- Audit logging

---

## Version Guidelines

### Semantic Versioning

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward compatible manner
- **PATCH** version when you make backward compatible bug fixes

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions or corrections
- `build:` - Build system or external dependency changes
- `ci:` - CI/CD configuration changes
- `chore:` - Other changes that don't modify src or test files

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/lan/static-analysis-mcp/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/lan/static-analysis-mcp/discussions)
- 📧 **Email**: 3314844@qq.com

---

**Thank you for using Static Analysis MCP!** 🎉

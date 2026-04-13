# Static Analysis MCP Server

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║    ███████╗██╗  ██╗██████╗  ██████╗ ███████╗███████╗     ║
║    ██╔════╝╚██╗██╔╝██╔══██╗██╔═══██╗██╔════╝██╔════╝     ║
║    ███████╗ ╚███╔╝ ██████╔╝██║   ██║███████╗█████╗       ║
║    ╚════██║ ██╔██╗ ██╔══██╗██║   ██║╚════██║██╔══╝       ║
║    ███████║██╔╝ ██╗██████╔╝╚██████╔╝███████║███████╗     ║
║    ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚══════╝╚══════╝     ║
║                                                          ║
║              ██████╗ ██╗   ██╗███████╗                    ║
║             ██╔═══██╗██║   ██║██╔════╝                    ║
║             ██║   ██║██║   ██║███████╗                    ║
║             ██║   ██║╚██╗ ██╔╝╚════██║                    ║
║             ╚██████╔╝ ╚████╔╝ ███████║                    ║
║              ╚═════╝   ╚═══╝  ╚══════╝                    ║
║                                                          ║
║                  Model Context Protocol                   ║
║                                                          ║
║     🚀 50+ MCP Tools  •  🌍 28+ Languages  •  🔒 Security║
║     📊 Code Quality  •  📈 Complexity  •  🤖 AI-Powered  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

<div align="center">

[![npm version](https://img.shields.io/npm/v/static-analysis-mcp.svg?style=flat-square)](https://www.npmjs.com/package/static-analysis-mcp)
[![npm downloads](https://img.shields.io/npm/dm/static-analysis-mcp.svg?style=flat-square)](https://www.npmjs.com/package/static-analysis-mcp)
[![npm downloads total](https://img.shields.io/npm/dt/static-analysis-mcp.svg?style=flat-square)](https://www.npmjs.com/package/static-analysis-mcp)
[![node version](https://img.shields.io/node/v/static-analysis-mcp.svg?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?style=flat-square)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg?style=flat-square)](https://www.python.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

**A comprehensive Model Context Protocol (MCP) server for multi-language static code analysis, security scanning, and AI-powered code review.**

[Installation](#-installation) • [Features](#-features) • [Tools](#-tools) • [API Reference](#-api-reference) • [Contributing](#-contributing) • [License](#-license)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Supported Languages](#-supported-languages)
- [Installation](#-installation)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
- [Quick Start](#-quick-start)
- [Tools Reference](#-tools-reference)
  - [Core Analysis Tools](#core-analysis-tools)
  - [Security Analysis Tools](#security-analysis-tools)
  - [Complexity Analysis Tools](#complexity-analysis-tools)
  - [Code Review Tools](#code-review-tools)
  - [Dependency Analysis Tools](#dependency-analysis-tools)
  - [Log Analysis Tools](#log-analysis-tools)
  - [AI-Powered Tools](#ai-powered-tools)
  - [Project Analysis Tools](#project-analysis-tools)
  - [Utility Tools](#utility-tools)
- [Configuration](#-configuration)
- [API Examples](#-api-examples)
- [Architecture](#-architecture)
- [Performance](#-performance)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Static Analysis MCP Server** is a production-ready Model Context Protocol server that provides enterprise-grade static code analysis capabilities. With **50+ powerful tools**, it supports:

- 🔍 **Multi-language static analysis** for 28+ programming languages
- 🛡️ **Security vulnerability detection** (SQL injection, XSS, command injection, etc.)
- 📊 **Code quality metrics** and maintainability analysis
- 📈 **Complexity analysis** (Cyclomatic, Cognitive, Halstead, Maintainability Index)
- 🤖 **AI-powered code review** with automated fix suggestions
- 🔒 **Dependency security scanning** and supply chain analysis
- 📝 **Log file analysis** with pattern detection
- 🌐 **GitHub PR integration** and Slack notifications
- 📊 **Web dashboard** and team collaboration features

---

## ✨ Features

### 📊 Code Quality Analysis
- ✅ Code style and formatting issues detection
- ✅ Potential errors and bugs identification
- ✅ Code smells and anti-patterns detection
- ✅ TODO/FIXME/HACK/BUG comment tracking
- ✅ Best practices enforcement
- ✅ Maintainability scoring

### 🔒 Security Vulnerability Detection
- 🚨 **SQL Injection** detection and prevention
- 🚨 **XSS (Cross-Site Scripting)** vulnerability scanning
- 🚨 **Command Injection** analysis
- 🚨 **Path Traversal** vulnerability detection
- 🚨 **Hardcoded Credentials** scanning
- 🚨 **Insecure Cryptography** algorithm detection
- 🚨 **Prototype Pollution** prevention
- 🚨 **Insecure Deserialization** detection
- 🚨 **Bandit-style** Python security analysis
- 🚨 **ESLint-plugin-security** JavaScript scanning
- 🚨 **SonarQube-style** multi-language security rules
- 🚨 **Semgrep-style** pattern-based security matching

### 📈 Complexity Analysis
- 📐 **Cyclomatic Complexity** measurement
- 🧠 **Cognitive Complexity** assessment
- 🔢 **Halstead Metrics** (Volume, Effort, Bugs, Difficulty)
- 🌲 **Nesting Depth** analysis
- 📏 **Function/Class Complexity** evaluation
- 📊 **Maintainability Index** calculation
- 📈 **Comparative Analysis** across files

### 🤖 AI-Powered Features
- 🤖 **Automated Code Review** (CodeRabbit-style)
- 💡 **AI Fix Suggestions** with multiple LLM models
- 🔮 **Risk Prediction** and technical debt analysis
- 🎯 **Smart Prioritization** of issues
- 📝 **Automated PR Reviews** on GitHub

### 🌍 Multi-Language Support (28+ Languages)
```
JavaScript • TypeScript • Python • Java • Go • Rust
C • C++ • C# • Ruby • PHP • Swift • Kotlin • Scala
R • Julia • Lua • Shell • SQL • HTML • CSS • YAML
JSON • XML • Markdown • Dart • Elixir • and more...
```

### 📦 Dependency Analysis
- 🔍 **Vulnerability Scanning** (like npm audit, pip-audit)
- 📅 **Outdated Package Detection**
- 📜 **License Risk Analysis**
- 📊 **Supply Chain Security**
- 🔧 **Automated Fix Suggestions**
- ✅ **Installation Verification**

### 📝 Log Analysis
- 🔍 **Error Pattern Detection**
- 🚨 **Security Event Monitoring**
- 📈 **Performance Issue Identification**
- 📊 **Statistical Analysis**
- 🔔 **Alert Pattern Matching**

### 🌐 Integration & Collaboration
- 🐙 **GitHub PR Review** integration
- 💬 **Slack Notifications** for security events
- 📊 **Web Dashboard** for interactive analysis
- 👥 **Team Dashboard** with multi-user support
- 📤 **SARIF Export** for CI/CD integration
- 📋 **Baseline Management** for quality tracking

---

## 🛠️ Tools Reference

This MCP server provides **50+ powerful tools** organized into 9 categories:

### Core Analysis Tools

| Tool | Description |
|------|-------------|
| `analyze_file` | Analyze a single source file for code quality issues |
| `analyze_files` | Analyze multiple source files simultaneously |
| `analyze_directory` | Analyze all source files in a directory tree |
| `analyze_code_snippet` | Analyze inline code snippets |
| `analyze_project` | Comprehensive project-level analysis with scores and action plans |
| `check_code_quality` | Deep code quality metrics analysis |
| `generate_report` | Generate analysis reports (summary or detailed) |
| `detect_language` | Detect programming language from file extension |

### Security Analysis Tools

| Tool | Description |
|------|-------------|
| `analyze_security` | General security vulnerability analysis |
| `analyze_security_comprehensive` | Comprehensive security analysis (Bandit + ESLint + Sonar + Semgrep) |
| `analyze_bandit` | Python security analysis (Bandit-style) |
| `analyze_eslint_security` | JavaScript security analysis (ESLint-plugin-security style) |
| `analyze_semgrep` | Multi-language pattern-based security analysis (Semgrep-style) |
| `analyze_sonar` | Multi-language security analysis (SonarQube-style) |
| `analyze_code_smells` | Code smell detection (SonarQube-style) |
| `get_security_rules` | Get all security analysis rules |
| `get_all_security_rules` | Get complete security rules from all engines |
| `deep_security_scan` | Deep security scanning with comprehensive reporting |

### Complexity Analysis Tools

| Tool | Description |
|------|-------------|
| `analyze_complexity` | Detailed complexity analysis report |
| `get_complexity_metrics` | Get complexity metrics for files/code |
| `compare_complexity` | Compare complexity across multiple files |

### Code Review Tools

| Tool | Description |
|------|-------------|
| `code_review` | CodeRabbit-style code review with fix suggestions |
| `detect_errors` | Detect syntax, logic, and type errors |
| `get_review_rules` | Get code review rules |

### Dependency Analysis Tools

| Tool | Description |
|------|-------------|
| `check_dependencies` | Check dependencies for vulnerabilities, outdated versions, and license issues |
| `get_dependency_fix_suggestions` | Get dependency upgrade recommendations |
| `get_dependency_types` | Get supported dependency check types |
| `check_package_installation` | Verify package installation status |
| `get_package_managers` | Get list of supported package managers |
| `supply_chain_scan` | Supply chain security scanning |

### Log Analysis Tools

| Tool | Description |
|------|-------------|
| `analyze_log_file` | Analyze log files for errors and patterns |
| `analyze_log_directory` | Analyze all log files in a directory |
| `get_log_patterns` | Get supported log patterns and security rules |

### AI-Powered Tools

| Tool | Description |
|------|-------------|
| `ai_fix_suggestion` | Generate AI-powered fix suggestions using LLMs |
| `multi_model_fix` | Compare multiple LLM models for code fixes |
| `predict_risks` | Predict project risks and technical debt |
| `incremental_scan` | Incremental analysis of changed files only |

### Project Analysis Tools

| Tool | Description |
|------|-------------|
| `analyze_project` | Native project-level analysis with scores |
| `scan_project` | Parallel project scanning (Python-based) |
| `auto_fix` | Automated code fix application (dry-run or apply) |
| `verify_installation` | Verify toolchain and environment setup |
| `github_review_pr` | Automated GitHub Pull Request review |

### Utility Tools

| Tool | Description |
|------|-------------|
| `get_supported_rules` | Get all supported analysis rules |
| `get_supported_languages` | Get supported programming languages (28+) |
| `get_supported_languages_extended` | Get extended language list (50+) |
| `clear_cache` | Clear analysis results cache |
| `create_baseline` | Create quality baseline for tracking |
| `compare_baseline` | Compare current results with baseline |
| `export_sarif` | Export results to SARIF format |
| `start_web_dashboard` | Launch interactive web dashboard |
| `start_team_dashboard` | Launch team collaboration dashboard |
| `send_slack_notification` | Send analysis results to Slack |
| `get_help` | Get detailed help and usage examples |

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.8 (optional, for advanced features)
- **npm** or **yarn** package manager

### Windows

```powershell
# Install globally
npm install -g static-analysis-mcp

# Or install locally in your project
npm install static-analysis-mcp

# Verify installation
static-analysis-mcp --help
```

### macOS

```bash
# Install globally
npm install -g static-analysis-mcp

# Or install locally in your project
npm install static-analysis-mcp

# Verify installation
static-analysis-mcp --help
```

### Linux

```bash
# Install globally
sudo npm install -g static-analysis-mcp

# Or install locally in your project
npm install static-analysis-mcp

# Verify installation
static-analysis-mcp --help
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/lan/static-analysis-mcp.git
cd static-analysis-mcp

# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Run tests
npm test
```

---

## ⚡ Quick Start

### 1. Basic MCP Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "npx",
      "args": ["static-analysis-mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 2. Local Development Configuration

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "node",
      "args": ["--experimental-modules", "src/index.js"],
      "cwd": "/path/to/static-analysis-mcp"
    }
  }
}
```

### 3. HTTP Transport Mode (Advanced)

```bash
# Start with HTTP transport
npm run start:hybrid

# Configuration
{
  "mcpServers": {
    "static-analysis": {
      "url": "http://127.0.0.1:3902/mcp"
    }
  }
}
```

---

## 📖 API Examples

### Example 1: Analyze a Single File

```json
{
  "tool": "analyze_file",
  "arguments": {
    "filePath": "./src/app.js",
    "useCache": true
  }
}
```

### Example 2: Security Analysis

```json
{
  "tool": "analyze_security",
  "arguments": {
    "code": "const query = 'SELECT * FROM users WHERE id = ' + userId;",
    "language": "javascript"
  }
}
```

### Example 3: Code Review

```json
{
  "tool": "code_review",
  "arguments": {
    "filePath": "./src/complex_module.py",
    "includeSuggestions": true
  }
}
```

### Example 4: Dependency Check

```json
{
  "tool": "check_dependencies",
  "arguments": {
    "projectPath": "/path/to/project",
    "checkVulnerabilities": true,
    "checkOutdated": true,
    "checkLicenses": true
  }
}
```

### Example 5: Project Analysis

```json
{
  "tool": "analyze_project",
  "arguments": {
    "projectPath": "/path/to/project",
    "maxFiles": 500,
    "extensions": [".js", ".ts", ".py"]
  }
}
```

---

## 🏗️ Architecture

```
static-analysis-mcp/
├── src/
│   ├── index.js                    # MCP Server Entry Point
│   ├── analyzer.js                 # Core Analysis Engine
│   ├── security.js                 # Security Detection Module
│   ├── complexity.js               # Complexity Analysis Module
│   ├── enhanced-analyzer.js        # Enhanced Multi-Engine Analyzer
│   ├── code-review.js              # Code Review Engine
│   ├── dependency-check.js         # Dependency Security Scanner
│   ├── package-checker.js          # Package Installation Checker
│   ├── log-analyzer.js             # Log Pattern Analyzer
│   ├── project-analyzer.js         # Project-Level Analyzer
│   ├── toolchain-doctor.js         # Toolchain Diagnostics
│   └── security-utils.js           # Security Utilities (Path Validation, Cache, etc.)
├── STATIC_ANALYSIS_TOOLS/          # Python Advanced Tools
│   ├── parallel_scanner.py         # Parallel Security Scanner
│   ├── auto_fix.py                 # Automated Fix Engine
│   ├── multi_model_fixer.py        # Multi-LLM Fix Comparison
│   ├── predictive_analytics.py     # Risk Prediction
│   ├── github_pr_reviewer.py       # GitHub PR Integration
│   ├── slack_integration.py        # Slack Notifications
│   ├── sarif_export.py             # SARIF Export
│   ├── web_dashboard.py            # Web Dashboard
│   ├── team_dashboard.py           # Team Collaboration
│   ├── supply_chain_scanner.py     # Supply Chain Security
│   └── ... (more tools)
├── scripts/                        # Automation Scripts
│   ├── auto_fix_all.py             # Batch Auto-Fix
│   ├── check_functions.py          # Function Validation
│   └── ... (more scripts)
├── tests/                          # Test Suite
│   ├── project-analyzer.test.js
│   ├── security-utils.test.js
│   └── ... (more tests)
├── package.json
├── pyproject.toml
├── requirements.txt
└── README.md
```

---

## ⚡ Performance

- **Caching System**: 5-minute TTL with automatic invalidation on file changes
- **Parallel Processing**: Multi-worker scanning for large projects
- **Streaming Glob**: Memory-efficient file discovery for large directories
- **Incremental Analysis**: Only analyze changed files
- **Configurable Limits**: maxFiles, timeout, and worker count controls
- **Benchmark**: Analyzes 100+ files in <5 seconds with 8 workers

---

## 🔒 Security

This MCP server implements multiple security layers:

- ✅ **Path Traversal Protection**: All file paths are validated against workspace root
- ✅ **Symlink Protection**: Symlinks are rejected by default
- ✅ **Input Validation**: Strict JSON schema validation for all tool inputs
- ✅ **Secure Process Execution**: Python scripts run with restricted permissions
- ✅ **No Secret Exposure**: Sensitive data is never logged or exposed
- ✅ **Rate Limiting**: Built-in rate limiting for API endpoints
- ✅ **Zero-Data-Retention**: Optional mode for privacy-sensitive environments

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

```bash
# Fork and clone the repository
git clone https://github.com/lan/static-analysis-mcp.git
cd static-analysis-mcp

# Create a feature branch
git checkout -b feature/amazing-feature

# Install dependencies
npm install

# Make your changes and test
npm test

# Commit your changes
git commit -m 'feat: add amazing feature'

# Push to your fork
git push origin feature/amazing-feature

# Open a Pull Request
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/security-utils.test.js

# Run with coverage (requires additional setup)
npm run test:coverage
```

### Code Style

We use ESLint for code quality:

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) - The protocol specification
- [ESLint](https://eslint.org/) - JavaScript linting engine
- [Bandit](https://github.com/PyCQA/bandit) - Python security analyzer inspiration
- [Semgrep](https://semgrep.dev/) - Pattern matching security tool
- [SonarQube](https://www.sonarqube.org/) - Code quality platform inspiration
- [CodeRabbit](https://coderabbit.ai/) - AI code review inspiration

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/lan/static-analysis-mcp/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/lan/static-analysis-mcp/discussions)
- 📧 **Email**: 3314844@qq.com
- 🐦 **Twitter**: [@lan](https://twitter.com/lan)

---

<div align="center">

**⭐ If this project helps you, please give it a star! ⭐**

Made with ❤️ by the Static Analysis MCP Community

</div>

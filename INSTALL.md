# 📦 Cross-Platform Installation Guide

<div align="center">

## Supported Operating Systems

![Windows](https://img.shields.io/badge/Windows-10/11-0078D6?style=for-the-badge&logo=windows)
![macOS](https://img.shields.io/badge/macOS-12+-000000?style=for-the-badge&logo=apple)
![Linux](https://img.shields.io/badge/Linux-Ubuntu/Debian/Fedora-FCC624?style=for-the-badge&logo=linux)

</div>

---

## 🚀 Quick Installation

### Windows

#### Method 1: Global Installation (Recommended)

```powershell
# Install globally
npm install -g static-analysis-mcp

# Verify installation
static-analysis-mcp --help

# Check version
static-analysis-mcp --version
```

#### Method 2: Local Project Installation

```powershell
# Navigate to your project
cd C:\path\to\your\project

# Install locally
npm install static-analysis-mcp

# Run with npx
npx static-analysis-mcp --help
```

#### Method 3: From Source

```powershell
# Clone repository
git clone https://github.com/yourusername/static-analysis-mcp.git
cd static-analysis-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev
```

---

### macOS

#### Method 1: Global Installation (Recommended)

```bash
# Install globally
npm install -g static-analysis-mcp

# Verify installation
static-analysis-mcp --help

# Check version
static-analysis-mcp --version
```

#### Method 2: Local Project Installation

```bash
# Navigate to your project
cd /path/to/your/project

# Install locally
npm install static-analysis-mcp

# Run with npx
npx static-analysis-mcp --help
```

#### Method 3: From Source

```bash
# Clone repository
git clone https://github.com/yourusername/static-analysis-mcp.git
cd static-analysis-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev
```

---

### Linux (Ubuntu/Debian)

#### Method 1: Global Installation (Recommended)

```bash
# Install globally (may require sudo)
sudo npm install -g static-analysis-mcp

# Verify installation
static-analysis-mcp --help

# Check version
static-analysis-mcp --version
```

#### Method 2: Local Project Installation (No sudo required)

```bash
# Navigate to your project
cd /path/to/your/project

# Install locally
npm install static-analysis-mcp

# Run with npx
npx static-analysis-mcp --help
```

#### Method 3: From Source

```bash
# Clone repository
git clone https://github.com/yourusername/static-analysis-mcp.git
cd static-analysis-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev
```

---

### Linux (Fedora/RHEL/CentOS)

```bash
# Install Node.js if not already installed
sudo dnf install nodejs npm

# Install globally
sudo npm install -g static-analysis-mcp

# Or install locally
npm install static-analysis-mcp
npx static-analysis-mcp --help
```

---

## 🔧 MCP Configuration

### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "npx",
      "args": ["static-analysis-mcp"]
    }
  }
}
```

### For Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "npx",
      "args": ["static-analysis-mcp"]
    }
  }
}
```

### For VS Code (with MCP extension)

Add to your `settings.json`:

```json
{
  "mcp.servers": {
    "static-analysis": {
      "command": "npx",
      "args": ["static-analysis-mcp"]
    }
  }
}
```

### For Local Development

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

### HTTP Transport Mode (Advanced)

```bash
# Start server
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

## ✅ Verify Installation

### Test 1: Check Version

```bash
static-analysis-mcp --version
```

Expected output: `1.0.0`

### Test 2: Show Help

```bash
static-analysis-mcp --help
```

Expected output: List of all available tools and options

### Test 3: Analyze Sample File

```bash
# Create a test file with security issues
cat > test.js << 'EOF'
const query = 'SELECT * FROM users WHERE id = ' + userId;
eval(userInput);
console.log(process.env.SECRET_KEY);
EOF

# Run analysis
static-analysis-mcp analyze_file --filePath test.js
```

Expected output: Security vulnerabilities detected

### Test 4: Check Supported Languages

```bash
# In your MCP client, call:
get_supported_languages
```

Expected output: List of 28+ supported languages

---

## 🐛 Troubleshooting

### Issue: "command not found: static-analysis-mcp"

**Solution:**
```bash
# Check if npm global bin is in PATH
echo $PATH

# Add to ~/.bashrc or ~/.zshrc
export PATH="$(npm prefix -g)/bin:$PATH"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

### Issue: Permission denied (Linux/macOS)

**Solution:**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g static-analysis-mcp

# Option 2: Fix npm permissions (recommended)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g static-analysis-mcp
```

### Issue: Node.js version too old

**Solution:**
```bash
# Check Node.js version
node --version

# Update Node.js using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Or update using package manager
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node
```

### Issue: Python tools not available

Some advanced features require Python 3.8+:

```bash
# Install Python
# Windows
winget install Python.Python.3.11

# macOS
brew install python@3.11

# Ubuntu/Debian
sudo apt-get install python3.11

# Verify installation
python3 --version
```

### Issue: Tests failing

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests
npm test

# If still failing, check logs
npm test 2>&1 | tee test.log
```

---

## 📊 Platform Compatibility

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Core MCP Server | ✅ | ✅ | ✅ |
| Static Analysis | ✅ | ✅ | ✅ |
| Security Scanning | ✅ | ✅ | ✅ |
| Complexity Analysis | ✅ | ✅ | ✅ |
| Code Review | ✅ | ✅ | ✅ |
| Dependency Check | ✅ | ✅ | ✅ |
| Log Analysis | ✅ | ✅ | ✅ |
| Python Tools | ✅ | ✅ | ✅ |
| HTTP Transport | ✅ | ✅ | ✅ |
| Web Dashboard | ✅ | ✅ | ✅ |
| GitHub Integration | ✅ | ✅ | ✅ |
| Slack Integration | ✅ | ✅ | ✅ |

---

## 🎯 Next Steps

After successful installation:

1. **Configure your MCP client** - Add the server to your MCP configuration
2. **Test basic tools** - Try `analyze_file` or `get_supported_languages`
3. **Explore security features** - Run `analyze_security` on your codebase
4. **Set up CI/CD** - Integrate with your development workflow
5. **Join the community** - Star the repo and contribute!

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/static-analysis-mcp/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/yourusername/static-analysis-mcp/discussions)
- 📧 **Email**: your.email@example.com
- 📖 **Documentation**: [README.md](https://github.com/yourusername/static-analysis-mcp#readme)

---

<div align="center">

**⭐ Enjoy using Static Analysis MCP across all platforms! ⭐**

</div>

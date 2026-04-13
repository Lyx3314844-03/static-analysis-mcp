# Static Analysis MCP Server - 使用指南

## 快速开始

### 1. 安装

```bash
cd static-analysis-mcp
npm install
```

### 2. 配置 MCP 客户端

#### Claude Desktop 配置

编辑 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "C:/Users/Administrator/static-analysis-mcp"
    }
  }
}
```

#### Cursor 配置

编辑 `.mcp.json`:

```json
{
  "mcpServers": {
    "static-analysis": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "${workspaceFolder}/static-analysis-mcp"
    }
  }
}
```

### 3. 验证安装

重启 MCP 客户端后，询问：
- "支持哪些编程语言？"
- "有哪些分析规则？"

## 工具使用详解

### 代码质量分析

#### analyze_file - 分析单个文件

```
分析文件：C:/project/src/app.js
```

**响应示例：**
```json
{
  "filePath": "C:/project/src/app.js",
  "language": "javascript",
  "issues": [
    {
      "rule": "no-console",
      "severity": "warning",
      "line": 10,
      "message": "Avoid using console statements"
    }
  ],
  "metrics": {
    "linesOfCode": 150,
    "functions": 12,
    "estimatedCyclomaticComplexity": 25
  }
}
```

#### analyze_directory - 分析目录

```
分析目录：C:/project/src
扩展名：[".js", ".ts"]
排除：["node_modules", "dist"]
```

### 安全分析

#### analyze_security - 安全漏洞检测

检测的安全问题类型：

| 类别 | 检测项 |
|------|--------|
| SQL 注入 | 字符串拼接 SQL 查询 |
| XSS | innerHTML, eval(), document.write |
| 命令注入 | exec() 中的模板字符串 |
| 路径遍历 | 动态文件路径 |
| 硬编码凭证 | password, secret, API key |
| 弱加密 | MD5, SHA1, DES, RC4 |
| 不安全随机数 | Math.random() |
| 原型污染 | __proto__ 访问 |
| 不安全反序列化 | pickle.loads(), yaml.load() |

**示例：**
```
分析代码安全：
const query = "SELECT * FROM users WHERE id = " + userId;
语言：javascript
```

### 复杂度分析

#### analyze_complexity - 详细复杂度报告

**报告包含：**
- 圈复杂度 (Cyclomatic Complexity)
- 认知复杂度 (Cognitive Complexity)
- Halstead 指标
- 嵌套深度
- 可维护性指数
- 复杂度热点
- 改进建议

**示例输出：**
```json
{
  "summary": {
    "totalLines": 200,
    "totalFunctions": 15,
    "overallCyclomaticComplexity": 45,
    "averageMaintainabilityIndex": 65
  },
  "hotspots": [
    {
      "name": "complexFunction",
      "cyclomaticComplexity": 15,
      "riskLevel": "high"
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "message": "Overall code complexity is high"
    }
  ]
}
```

## 实际工作流示例

### 代码审查工作流

1. **提交前检查**
   ```
   分析这个文件的质量问题
   ```

2. **安全检查**
   ```
   检查这个模块的安全漏洞
   ```

3. **重构建议**
   ```
   这个函数太复杂了，有什么改进建议？
   ```

### CI/CD 集成

```yaml
# GitHub Actions 示例
- name: Static Analysis
  run: |
    node static-analysis-mcp/src/index.js analyze_directory \
      --directory ./src \
      --extensions .js,.ts \
      --output report.json
```

## 最佳实践

### 1. 定期分析
- 每日构建时运行分析
- 提交前检查关键文件
- 每周生成整体报告

### 2. 问题优先级
- **Error**: 立即修复
- **Warning**: 本周修复
- **Info**: 计划修复
- **Hint**: 有时间再修复

### 3. 规则定制
根据团队规范调整规则严格度

### 4. 技术债务管理
- 使用 `generate_report` 生成技术债务清单
- 按复杂度排序确定重构优先级
- 跟踪改进进度

## 常见问题

### Q: 分析速度慢怎么办？
A: 使用缓存功能，或限制分析的文件数量

### Q: 如何添加自定义规则？
A: 在 `analyzer.js` 中扩展对应语言的分析器

### Q: 支持私有 MCP 服务器吗？
A: 支持，配置本地路径即可

### Q: 可以分析 Jupyter Notebook 吗？
A: 目前不支持，但可以提取代码后分析

## 性能优化

1. **启用缓存**
   ```
   analyze_file with useCache: true
   ```

2. **限制范围**
   ```
   analyze_directory with maxFiles: 50
   ```

3. **排除目录**
   ```
   excludePatterns: ["node_modules", "dist", "build"]
   ```

## 输出解读

### 严重性说明

| 级别 | 含义 | 响应时间 |
|------|------|----------|
| Error | 严重问题 | 立即修复 |
| Warning | 需要注意 | 尽快修复 |
| Info | 信息提示 | 计划修复 |
| Hint | 优化建议 | 酌情处理 |

### 复杂度评分

| 圈复杂度 | 评级 | 建议 |
|----------|------|------|
| 1-10 | 良好 | 保持 |
| 11-20 | 中等 | 考虑重构 |
| 21-50 | 较高 | 需要重构 |
| 50+ | 危险 | 立即重构 |

## 扩展开发

### 添加新语言

```javascript
class NewLanguageAnalyzer extends BaseAnalyzer {
  async analyze(code, filePath) {
    const issues = [];
    // 添加检测逻辑
    return issues;
  }
  
  getSupportedRules() {
    return [
      { name: 'rule-name', description: '...', severity: 'warning' }
    ];
  }
}
```

### 添加新规则

在对应分析器中添加检测模式：

```javascript
// 检测新模式
const pattern = /your-pattern/g;
while ((match = pattern.exec(code)) !== null) {
  issues.push({
    rule: 'new-rule',
    message: 'Description',
    severity: SEVERITY.WARNING,
    line: lineNumber
  });
}
```

## 资源

- [MCP 协议文档](https://modelcontextprotocol.io/)
- [GitHub 仓库](https://github.com/)
- [问题追踪](https://github.com/)

---

**提示**: 本工具旨在帮助提高代码质量，但不能替代人工代码审查和测试。

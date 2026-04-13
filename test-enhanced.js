/**
 * 测试增强功能脚本
 * Test Enhanced Features Script
 */

import { BanditStyleAnalyzer, ESLintSecurityAnalyzer, SonarStyleAnalyzer, SemgrepStyleAnalyzer, getAllSecurityRules } from './src/enhanced-analyzer.js';

console.log('='.repeat(70));
console.log('静态代码分析 MCP 服务器 - 增强功能测试');
console.log('整合了 ESLint、SonarQube、Bandit、Semgrep 等工具的功能');
console.log('='.repeat(70));

async function runEnhancedTests() {
  // 测试 1: Bandit 风格分析
  console.log('\n📋 测试 1: Bandit 风格 Python 安全分析');
  console.log('-'.repeat(50));
  
  const pythonCode = `
import pickle
import yaml
import os

# B101 - assert used
assert user.is_authenticated()

# B102 - exec used
exec(user_input)

# B105 - hardcoded password
password = "super_secret_123"

# B506 - yaml load without safe loader
data = yaml.load(user_yaml)

# B602 - subprocess with shell=True
os.system("echo " + user_input)

# B201 - Flask debug mode
app.run(debug=True)

# B501 - SSL verification disabled
requests.get(url, verify=False)

# B701 - Jinja2 autoescape disabled
env = jinja2.Environment(autoescape=False)
`;

  const banditAnalyzer = new BanditStyleAnalyzer();
  const banditIssues = await banditAnalyzer.analyze(pythonCode, 'test.py');
  console.log(`发现 ${banditIssues.length} 个安全问题:`);
  banditIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
  });
  
  // 测试 2: ESLint 风格安全分析
  console.log('\n📋 测试 2: ESLint-plugin-security 风格 JavaScript 安全分析');
  console.log('-'.repeat(50));
  
  const jsCode = `
const fs = require('fs');
const child_process = require('child_process');

// detect-child-process
child_process.exec(userInput);

// detect-non-literal-fs-filename
fs.readFile('/tmp/' + userInput, callback);

// detect-eval-with-expression
eval(someVariable);

// detect-new-buffer
const buf = new Buffer(userInput);

// detect-object-injection
obj[userInput] = value;

// detect-unsafe-regex
const regex = /(a+)+/;
`;

  const eslintAnalyzer = new ESLintSecurityAnalyzer();
  const eslintIssues = await eslintAnalyzer.analyze(jsCode, 'test.js');
  console.log(`发现 ${eslintIssues.length} 个安全问题:`);
  eslintIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
  });
  
  // 测试 3: SonarQube 风格代码异味分析
  console.log('\n📋 测试 3: SonarQube 风格代码异味分析');
  console.log('-'.repeat(50));
  
  const codeSmellCode = `
function processData(a, b, c, d, e, f, g, h, i, j) {
    // Too many parameters
    
    if (condition1) {
        if (condition2) {
            if (condition3) {
                if (condition4) {
                    if (condition5) {
                        // Too deep nesting
                        return true;
                    }
                }
            }
        }
    }
    
    const magicString = "SOME_MAGIC_STRING";
    const magicNumber = 123456789;
    
    return;
    // Dead code after return
    console.log("unreachable");
}
`;

  const sonarAnalyzer = new SonarStyleAnalyzer();
  const sonarIssues = await sonarAnalyzer.analyze(codeSmellCode, 'test.js', 'javascript');
  console.log(`发现 ${sonarIssues.length} 个代码异味:`);
  sonarIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
  });
  
  // 测试 4: Semgrep 风格模式匹配
  console.log('\n📋 测试 4: Semgrep 风格多语言安全分析');
  console.log('-'.repeat(50));
  
  const semgrepCode = `
# SQL Injection
query = "SELECT * FROM users WHERE id = " + user_id

# XSS vulnerability
element.innerHTML = userInput

# Command injection
os.system("ping " + hostname)

# Path traversal
with open('/tmp/' + filename) as f:
    content = f.read()

# Weak crypto
hashlib.md5(password)

# Hardcoded secret
api_key = "sk-1234567890abcdef1234567890abcdef"

# Debug mode
DEBUG = True

# Unsafe deserialization
data = pickle.loads(user_data)
`;

  const semgrepAnalyzer = new SemgrepStyleAnalyzer();
  const semgrepIssues = await semgrepAnalyzer.analyze(semgrepCode, 'test.py', 'python');
  console.log(`发现 ${semgrepIssues.length} 个安全问题:`);
  semgrepIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
  });
  
  // 测试 5: 获取所有安全规则
  console.log('\n📋 测试 5: 获取所有安全规则');
  console.log('-'.repeat(50));
  
  const allRules = getAllSecurityRules();
  console.log('规则来源统计:');
  for (const [source, rules] of Object.entries(allRules)) {
    console.log(`  ${source}: ${rules.length} 条规则`);
  }
  const totalRules = Object.values(allRules).flat().length;
  console.log(`总计：${totalRules} 条安全规则`);
  
  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('增强功能测试完成!');
  console.log('='.repeat(70));
  console.log('\n✅ 新增工具列表:');
  console.log('  1. analyze_security_comprehensive - 综合安全分析');
  console.log('  2. analyze_code_smells - SonarQube 风格代码异味分析');
  console.log('  3. analyze_bandit - Bandit 风格 Python 安全分析');
  console.log('  4. analyze_eslint_security - ESLint 风格 JavaScript 安全分析');
  console.log('  5. analyze_semgrep - Semgrep 风格多语言安全分析');
  console.log('  6. get_all_security_rules - 获取所有安全规则');
  console.log('\n📊 整合的工具功能:');
  console.log('  - ESLint (113+ 规则)');
  console.log('  - SonarQube (代码异味检测)');
  console.log('  - Bandit (40+ Python 安全测试)');
  console.log('  - Semgrep (多语言模式匹配)');
  console.log('  - eslint-plugin-security (15+ 安全规则)');
  console.log('\n🎯 现在 MCP 服务器共有 20 个工具!');
}

runEnhancedTests().catch(console.error);

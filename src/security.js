/**
 * 安全漏洞检测模块
 * Security Vulnerability Detection Module
 */

import { SEVERITY, CATEGORY } from './analyzer.js';

/**
 * 安全问题检测器类
 */
class SecurityAnalyzer {
  constructor() {
    this.patterns = this.initializePatterns();
  }

  initializePatterns() {
    return {
   // SQL 注入 - P1-FIX: Reduce false positives by requiring actual variable interpolation
      sqlInjection: [
        {
          // Only flag if there's actual variable interpolation like %s with parameters
          pattern: /execute\s*\(\s*["'`][^"'`]*%[sd][^"'`]*["'`]\s*[,)]/gi,
          message: 'Potential SQL injection: parameterized formatting without prepared statement',
          severity: SEVERITY.ERROR,
        },
        {
          // String concatenation with variables (+ operator)
          pattern: /execute\s*\(\s*["'`].*?\+\s*(?:query|sql|query_string|param)/gi,
          message: 'Potential SQL injection: string concatenation with variables',
          severity: SEVERITY.ERROR,
        },
        {
          // Template literals with variables in query context
          pattern: /(?:query|execute|prepare)\s*\(\s*[`][^`]*\$\{[^}]+\}[^`]*[`]/gi,
          message: 'Potential SQL injection: template literal with variable interpolation',
          severity: SEVERITY.ERROR,
        },
        {
          // FROM X WHERE Y = user input (suspicious pattern)
          pattern: /FROM\s+\w+\s+WHERE\s+\w+\s*[=<>!]+\s*(?:request\.|req\.|input\.|user_|param|arg)/gi,
          message: 'Potential SQL injection: direct use of user input in WHERE clause',
          severity: SEVERITY.ERROR,
        },
      ],
      
      // XSS (跨站脚本)
      xss: [
        {
          pattern: /innerHTML\s*=\s*/gi,
          message: 'Potential XSS: using innerHTML can execute arbitrary scripts',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /document\.write\s*\(/gi,
          message: 'Potential XSS: document.write can execute arbitrary scripts',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /eval\s*\(/gi,
          message: 'Potential XSS/Security: eval() executes arbitrary code',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /new\s+Function\s*\(/gi,
          message: 'Potential XSS: Function constructor executes arbitrary code',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /\$\(.*\)\.html\s*\(/gi,
          message: 'Potential XSS: jQuery .html() can execute scripts',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 命令注入
      commandInjection: [
        {
          pattern: /exec\s*\(\s*["'].*\$\{.*\}/gi,
          message: 'Potential command injection: template literal in exec()',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /execSync\s*\(\s*["'].*\+/gi,
          message: 'Potential command injection: string concatenation in execSync()',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /spawn\s*\(\s*["'].*\+/gi,
          message: 'Potential command injection: string concatenation in spawn()',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /child_process\s*\.\s*exec\s*\(/gi,
          message: 'Security concern: child_process.exec can be dangerous with user input',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 路径遍历
      pathTraversal: [
        {
          pattern: /readFile\s*\(\s*["'].*\+/gi,
          message: 'Potential path traversal: dynamic file path construction',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /readFileSync\s*\(\s*["'].*\+/gi,
          message: 'Potential path traversal: dynamic file path construction',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /fs\s*\.\s*writeFile\s*\(\s*["'].*\+/gi,
          message: 'Potential path traversal: dynamic file path in writeFile',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 硬编码凭证
      hardcodedCredentials: [
        {
          pattern: /password\s*[:=]\s*["'][^"']{4,}["']/gi,
          message: 'Security: potential hardcoded password detected',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /passwd\s*[:=]\s*["'][^"']{4,}["']/gi,
          message: 'Security: potential hardcoded password detected',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /secret\s*[:=]\s*["'][^"']{8,}["']/gi,
          message: 'Security: potential hardcoded secret detected',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi,
          message: 'Security: potential hardcoded API key detected',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /token\s*[:=]\s*["'][^"']{8,}["']/gi,
          message: 'Security: potential hardcoded token detected',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /AWS[_A-Z]*KEY/gi,
          message: 'Security: potential AWS credential in code',
          severity: SEVERITY.ERROR,
        },
      ],
      
      // 不安全的加密
      weakCrypto: [
        {
          pattern: /md5\s*\(/gi,
          message: 'Security: MD5 is cryptographically weak, use SHA-256 or better',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /sha1\s*\(/gi,
          message: 'Security: SHA-1 is cryptographically weak, use SHA-256 or better',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /createHash\s*\(\s*["']md5["']/gi,
          message: 'Security: MD5 is cryptographically weak',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /createHash\s*\(\s*["']sha1["']/gi,
          message: 'Security: SHA-1 is cryptographically weak',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /DES/gi,
          message: 'Security: DES encryption is weak, use AES',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /RC4/gi,
          message: 'Security: RC4 encryption is weak, use AES',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 不安全的随机数
      insecureRandom: [
        {
          pattern: /Math\.random\s*\(/gi,
          message: 'Security: Math.random() is not cryptographically secure',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /Random\s*\(\s*\)/gi,
          message: 'Security: java.util.Random is not cryptographically secure',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 敏感信息泄露
      infoDisclosure: [
        {
          pattern: /console\.log\s*\([^)]*password[^)]*\)/gi,
          message: 'Security: potential password logged to console',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /console\.log\s*\([^)]*secret[^)]*\)/gi,
          message: 'Security: potential secret logged to console',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /alert\s*\(/gi,
          message: 'Security: alert() can expose sensitive information',
          severity: SEVERITY.HINT,
        },
      ],
      
      // 不安全的 HTTP
      insecureHttp: [
        {
          pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/gi,
          message: 'Security: using insecure HTTP protocol, consider HTTPS',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /verify\s*:\s*false/gi,
          message: 'Security: SSL/TLS verification disabled',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /rejectUnauthorized\s*:\s*false/gi,
          message: 'Security: SSL/TLS certificate verification disabled',
          severity: SEVERITY.ERROR,
        },
      ],
      
      // 原型污染
      prototypePollution: [
        {
          pattern: /__proto__/gi,
          message: 'Security: __proto__ access can lead to prototype pollution',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /constructor\s*\.\s*prototype/gi,
          message: 'Security: direct prototype modification detected',
          severity: SEVERITY.WARNING,
        },
      ],
      
      // 不安全的反序列化
      unsafeDeserialization: [
        {
          pattern: /unserialize\s*\(/gi,
          message: 'Security: unserialize() can be dangerous with untrusted data',
          severity: SEVERITY.WARNING,
        },
        {
          pattern: /pickle\.loads?\s*\(/gi,
          message: 'Security: pickle.loads() can execute arbitrary code',
          severity: SEVERITY.ERROR,
        },
        {
          pattern: /yaml\.load\s*\(/gi,
          message: 'Security: yaml.load() can be dangerous, use yaml.safe_load()',
          severity: SEVERITY.WARNING,
        },
      ],
    };
  }

  /**
   * 分析代码中的安全问题
   */
  async analyze(code, filePath, language) {
    const issues = [];

    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const { pattern, message, severity } of patterns) {
        // Use matchAll to avoid stateful regex exec() calls
        const matches = code.matchAll(pattern);
        
        for (const match of matches) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);
          
          issues.push({
            rule: `security-${this.kebabCase(category)}`,
            message,
            severity,
            category: CATEGORY.SECURITY,
            subCategory: category,
            line: lineNum,
            column,
            filePath,
            language,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 转换为 kebab-case
   */
  kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 获取支持的安全规则
   */
  getSupportedRules() {
    const rules = [];
    
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const { message, severity } of patterns) {
        rules.push({
          category: this.kebabCase(category),
          description: message,
          severity,
        });
      }
    }
    
    return rules;
  }
}

/**
 * Python 特定安全分析
 */
class PythonSecurityAnalyzer {
  async analyze(code, filePath) {
    const issues = [];

    // 检测不安全的 pickle 使用
    const pickleRegex = /pickle\.loads?\s*\(/g;
    for (const match of code.matchAll(pickleRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-unsafe-pickle',
        message: 'pickle.loads() can execute arbitrary code. Use json or other safe formats.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测不安全的 yaml 使用
    const yamlLoadRegex = /yaml\.load\s*\([^)]*\)/g;
    for (const match of code.matchAll(yamlLoadRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      // 检查是否使用了 Loader 参数
      const matchedCode = match[0];
      if (!matchedCode.includes('Loader=')) {
        issues.push({
          rule: 'security-unsafe-yaml',
          message: 'yaml.load() without Loader parameter is unsafe. Use yaml.safe_load() instead.',
          severity: SEVERITY.ERROR,
          category: CATEGORY.SECURITY,
          line: lineNum,
          column: match.index - code.lastIndexOf('\n', match.index - 1),
          filePath,
        });
      }
    }

    // 检测硬编码密码
    const passwordRegex = /password\s*=\s*["'][^"']+["']/gi;
    for (const match of code.matchAll(passwordRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-hardcoded-password',
        message: 'Potential hardcoded password detected. Use environment variables.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 assert 语句（不应用于验证）
    const assertRegex = /^\s*assert\s+/gm;
    for (const match of code.matchAll(assertRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-assert-usage',
        message: 'Assert statements can be disabled with -O flag. Do not use for security validation.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测输入使用
    const inputRegex = /\binput\s*\(\s*\)/g;
    for (const match of code.matchAll(inputRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-raw-input',
        message: 'input() returns a string. Validate and sanitize user input.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    return issues;
  }

  getSupportedRules() {
    return [
      { name: 'security-unsafe-pickle', description: 'Detect unsafe pickle usage', severity: SEVERITY.ERROR },
      { name: 'security-unsafe-yaml', description: 'Detect unsafe YAML loading', severity: SEVERITY.ERROR },
      { name: 'security-hardcoded-password', description: 'Detect hardcoded passwords', severity: SEVERITY.ERROR },
      { name: 'security-assert-usage', description: 'Warn about assert usage for validation', severity: SEVERITY.WARNING },
      { name: 'security-raw-input', description: 'Warn about raw input usage', severity: SEVERITY.HINT },
    ];
  }
}

/**
 * JavaScript/TypeScript 特定安全分析
 */
class JavaScriptSecurityAnalyzer {
  async analyze(code, filePath) {
    const issues = [];

    // 检测不安全的 JSON.parse
    const jsonParseRegex = /JSON\.parse\s*\(\s*[^)]*responseText/g;
    let match;
    while ((match = jsonParseRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-unsafe-json-parse',
        message: 'Ensure response data is from a trusted source before parsing',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 postMessage 使用
    const postMessageRegex = /postMessage\s*\(/g;
    while ((match = postMessageRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-postmessage-usage',
        message: 'postMessage should validate origin. Use specific targetOrigin.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 localStorage 敏感数据
    const localStorageRegex = /localStorage\.(setItem|getItem)\s*\([^)]*(password|secret|token|key)[^)]*\)/gi;
    while ((match = localStorageRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'security-sensitive-storage',
        message: 'Avoid storing sensitive data in localStorage',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    return issues;
  }

  getSupportedRules() {
    return [
      { name: 'security-unsafe-json-parse', description: 'Warn about JSON.parse of untrusted data', severity: SEVERITY.HINT },
      { name: 'security-postmessage-usage', description: 'Ensure proper postMessage usage', severity: SEVERITY.WARNING },
      { name: 'security-sensitive-storage', description: 'Warn about storing sensitive data in localStorage', severity: SEVERITY.WARNING },
    ];
  }
}

/**
 * 导出安全分析函数
 */
export async function analyzeSecurity(code, filePath, language) {
  const securityAnalyzer = new SecurityAnalyzer();
  const issues = await securityAnalyzer.analyze(code, filePath, language);

  // 语言特定的安全检查
  if (language === 'python') {
    const pySecurityAnalyzer = new PythonSecurityAnalyzer();
    const pyIssues = await pySecurityAnalyzer.analyze(code, filePath);
    issues.push(...pyIssues);
  } else if (language === 'javascript' || language === 'typescript') {
    const jsSecurityAnalyzer = new JavaScriptSecurityAnalyzer();
    const jsIssues = await jsSecurityAnalyzer.analyze(code, filePath);
    issues.push(...jsIssues);
  }

  return issues;
}

/**
 * 获取所有安全规则
 */
export function getSecurityRules() {
  const analyzer = new SecurityAnalyzer();
  const pyAnalyzer = new PythonSecurityAnalyzer();
  const jsAnalyzer = new JavaScriptSecurityAnalyzer();

  return {
    general: analyzer.getSupportedRules(),
    python: pyAnalyzer.getSupportedRules(),
    javascript: jsAnalyzer.getSupportedRules(),
    typescript: jsAnalyzer.getSupportedRules(),
  };
}

export { SecurityAnalyzer, PythonSecurityAnalyzer, JavaScriptSecurityAnalyzer };

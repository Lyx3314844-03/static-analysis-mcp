/**
 * 增强版静态代码分析器
 * 整合了 ESLint、SonarQube、Bandit、Semgrep 等工具的功能
 * Enhanced Static Code Analyzer
 * Integrating features from ESLint, SonarQube, Bandit, Semgrep, etc.
 */

import { SEVERITY, CATEGORY } from './analyzer.js';

/**
 * Bandit 风格的 Python 安全分析器
 * Python Security Analyzer inspired by Bandit
 */
export class BanditStyleAnalyzer {
  constructor() {
    this.tests = this.initializeTests();
  }

  initializeTests() {
    return {
      // B1xx - Misc tests
      B101: {
        name: 'assert_used',
        pattern: /^\s*assert\s+/gm,
        message: 'Assert statement detected. Asserts can be disabled with -O flag and should not be used for security validation.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B102: {
        name: 'exec_used',
        pattern: /\bexec\s*\(/g,
        message: 'Use of exec() detected. This can execute arbitrary code and is a security risk.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B103: {
        name: 'set_bad_file_permissions',
        pattern: /os\.chmod\s*\([^,]+,\s*0o7/g,
        message: 'World-executable file permission detected. Consider restricting permissions.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      B104: {
        name: 'hardcoded_bind_all_interfaces',
        pattern: /['"]0\.0\.0\.0['"]/g,
        message: 'Possible binding to all network interfaces (0.0.0.0).',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      B105: {
        name: 'hardcoded_password_string',
        pattern: /password\s*=\s*['"][^'"]+['"]/gi,
        message: 'Possible hardcoded password detected.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B108: {
        name: 'hardcoded_tmp_directory',
        pattern: /['"]\/tmp['"]/g,
        message: 'Use of hardcoded temporary directory. Consider using tempfile module.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      B110: {
        name: 'try_except_pass',
        pattern: /except\s*[^:]*:\s*\n\s*pass/g,
        message: 'Except block with pass detected. Consider handling the exception.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
      },
      B112: {
        name: 'try_except_continue',
        pattern: /except\s*[^:]*:\s*\n\s*continue/g,
        message: 'Except block with continue detected. Consider handling the exception.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
      },
      B113: {
        name: 'request_without_timeout',
        pattern: /requests\.(get|post|put|delete)\s*\([^)]*\)(?![^)]*timeout)/g,
        message: 'Requests call without timeout detected. This can lead to hanging connections.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      
      // B2xx - Application/framework misconfiguration
      B201: {
        name: 'flask_debug_true',
        pattern: /app\.run\s*\([^)]*debug\s*=\s*True/g,
        message: 'Flask app running with debug=True. Never deploy with debug mode enabled.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      
      // B3xx - Cryptography
      B324: {
        name: 'hashlib_weak',
        pattern: /hashlib\.(md5|sha1)\s*\(/g,
        message: 'Use of weak hash algorithm (MD5/SHA1). Consider using SHA-256 or stronger.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      
      // B5xx - Security
      B501: {
        name: 'request_with_no_cert_validation',
        pattern: /verify\s*=\s*False/g,
        message: 'SSL certificate verification disabled. This is insecure.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B503: {
        name: 'ssl_with_bad_defaults',
        pattern: /ssl\.create_default_context\s*\(\)/g,
        message: 'SSL context created with default settings. Consider configuring security settings.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      B506: {
        name: 'yaml_load',
        pattern: /yaml\.load\s*\([^)]*\)(?![^)]*Loader)/g,
        message: 'yaml.load() without safe Loader. Use yaml.safe_load() instead.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      
      // B6xx - Injection
      B601: {
        name: 'paramiko_calls',
        pattern: /paramiko\.(SSHClient|exec_command)/g,
        message: 'Paramiko call detected. Ensure proper validation of inputs.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      B602: {
        name: 'subprocess_popen_with_shell_equals_true',
        pattern: /subprocess\.(popen|call|run)\s*\([^)]*shell\s*=\s*True/gi,
        message: 'Subprocess with shell=True detected. This can lead to command injection.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B604: {
        name: 'any_function_with_shell_equals_true',
        pattern: /os\.(system|popen|spawn)\s*\(/g,
        message: 'OS command execution detected. Validate all inputs.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B608: {
        name: 'hardcoded_sql_expressions',
        pattern: /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\s+.*\+/gi,
        message: 'Possible SQL injection via string concatenation.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      
      // B7xx - XSS
      B701: {
        name: 'jinja2_autoescape_false',
        pattern: /jinja2\.Environment\s*\([^)]*autoescape\s*=\s*False/g,
        message: 'Jinja2 autoescape disabled. This can lead to XSS vulnerabilities.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      B703: {
        name: 'django_mark_safe',
        pattern: /mark_safe\s*\(/g,
        message: 'mark_safe() used. Ensure content is properly sanitized to prevent XSS.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
    };
  }

  async analyze(code, filePath) {
    const issues = [];

    for (const [testId, test] of Object.entries(this.tests)) {
      const { pattern, message, severity, category, name } = test;
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        const column = match.index - code.lastIndexOf('\n', match.index - 1);

        issues.push({
          rule: `B${testId}-${name}`,
          message,
          severity,
          category,
          line: lineNum,
          column,
          filePath,
          language: 'python',
          source: 'bandit',
        });
      }
    }

    return issues;
  }

  getSupportedTests() {
    return Object.entries(this.tests).map(([id, test]) => ({
      id,
      name: test.name,
      description: test.message,
      severity: test.severity,
      category: test.category,
    }));
  }
}

/**
 * ESLint 风格的安全分析器
 * Security Analyzer inspired by ESLint plugins
 */
export class ESLintSecurityAnalyzer {
  constructor() {
    this.rules = this.initializeRules();
  }

  initializeRules() {
    return {
      // 来自 eslint-plugin-security 的规则
      'security/detect-object-injection': {
        pattern: /\[\s*[^0-9][^]]*\s*\]\s*=/g,
        message: 'Object injection detected. Use bracket notation carefully with validated keys.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-non-literal-fs-filename': {
        pattern: /fs\.(readFile|writeFile|appendFile|createReadStream|createWriteStream)\s*\([^)]*\+/g,
        message: 'Non-literal file path in fs operation. Validate file paths to prevent path traversal.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-unsafe-regex': {
        pattern: /\/\([^)]*\+[^)]*\+[^)]*\*\)/g,
        message: 'Potentially unsafe regex detected. This could lead to ReDoS attacks.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-buffer-noassert': {
        pattern: /Buffer\.(read|write)[^(]+\s*,\s*[^,]+,\s*true/g,
        message: 'Buffer noAssert mode detected. This can lead to out-of-bounds access.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'security/detect-child-process': {
        pattern: /child_process\.(exec|spawn|fork)/g,
        message: 'Child process detected. Validate all inputs to prevent command injection.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-disable-mustache-escape': {
        pattern: /escapeMarkup\s*:\s*false/g,
        message: 'Mustache escape disabled. This can lead to XSS vulnerabilities.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'security/detect-eval-with-expression': {
        pattern: /eval\s*\(\s*[^'"]/g,
        message: 'Eval with expression detected. This can execute arbitrary code.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'security/detect-no-csrf-before-method-override': {
        pattern: /methodOverride/g,
        message: 'methodOverride detected. Ensure CSRF protection is applied before it.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      'security/detect-non-literal-regexp': {
        pattern: /RegExp\s*\([^)'"/]+/g,
        message: 'Non-literal RegExp detected. Validate input to prevent ReDoS.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-non-literal-require': {
        pattern: /require\s*\(\s*[^'"]/g,
        message: 'Non-literal require detected. This can lead to arbitrary module loading.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-possible-timing-attacks': {
        pattern: /===\s*['"][^'"]+['"]/g,
        message: 'Possible timing attack. Use timing-safe comparison for sensitive data.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      'security/detect-pseudoRandomBytes': {
        pattern: /pseudoRandomBytes/g,
        message: 'PseudoRandomBytes detected. Not suitable for cryptographic purposes.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'security/detect-new-buffer': {
        pattern: /new\s+Buffer\s*\(/g,
        message: 'new Buffer() is deprecated. Use Buffer.alloc() or Buffer.from().',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'security/detect-no-crypto': {
        pattern: /require\s*\(\s*['"]crypto['"]\s*\)/g,
        message: 'Crypto module usage detected. Ensure proper implementation.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      'security/detect-object-injection-array': {
        pattern: /Array\.prototype\.[a-z]+\s*=/g,
        message: 'Array prototype modification detected. This can cause conflicts.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
    };
  }

  async analyze(code, filePath) {
    const issues = [];

    for (const [ruleName, rule] of Object.entries(this.rules)) {
      const { pattern, message, severity, category } = rule;
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        const column = match.index - code.lastIndexOf('\n', match.index - 1);

        issues.push({
          rule: ruleName,
          message,
          severity,
          category,
          line: lineNum,
          column,
          filePath,
          language: 'javascript',
          source: 'eslint-plugin-security',
        });
      }
    }

    return issues;
  }

  getSupportedRules() {
    return Object.entries(this.rules).map(([name, rule]) => ({
      name,
      description: rule.message,
      severity: rule.severity,
      category: rule.category,
    }));
  }
}

/**
 * SonarQube 风格的代码异味检测器
 * Code Smell Detector inspired by SonarQube
 */
export class SonarStyleAnalyzer {
  constructor() {
    this.codeSmells = this.initializeCodeSmells();
  }

  initializeCodeSmells() {
    return {
      // 代码重复检测
      'duplicate-code': {
        pattern: /(.{50,})\1/gs,
        message: 'Possible code duplication detected. Consider extracting common logic.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.MAINTAINABILITY,
      },
      
      // 过长的参数列表
      'too-many-parameters': {
        pattern: /function\s+\w+\s*\([^)]{100,}\)/g,
        message: 'Function has too many parameters. Consider using an options object.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.MAINTAINABILITY,
      },
      
      // 死代码检测
      'dead-code': {
        pattern: /return\s*;[\s\S]*?(?=\n\s*\})/g,
        message: 'Unreachable code after return statement.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.QUALITY,
      },
      
      // 未使用的变量
      'unused-variable': {
        pattern: /(?:const|let|var)\s+\w+\s*=\s*[^;]+;(?![\s\S]*\b\w+\b)/g,
        message: 'Variable declared but never used.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
      },
      
      // 过度的导入
      'too-many-imports': {
        pattern: /^(import\s+.*;){10,}/gm,
        message: 'Too many imports. Consider splitting this module.',
        severity: SEVERITY.HINT,
        category: CATEGORY.MAINTAINABILITY,
      },
      
      // 魔法字符串
      'magic-string': {
        pattern: /['"][a-zA-Z]{10,}['"]/g,
        message: 'Magic string detected. Consider using a named constant.',
        severity: SEVERITY.HINT,
        category: CATEGORY.MAINTAINABILITY,
      },
      
      // 过度的嵌套
      'too-deep-nesting': {
        pattern: /^\s{16,}/gm,
        message: 'Deep nesting detected (>4 levels). Consider refactoring.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.COMPLEXITY,
      },
      
      // 空方法
      'empty-method': {
        pattern: /(public|private|protected)?\s*\w+\s*\([^)]*\)\s*\{\s*\}/g,
        message: 'Empty method detected. Consider removing or implementing.',
        severity: SEVERITY.HINT,
        category: CATEGORY.QUALITY,
      },
      
      // 过度的分支
      'too-many-branches': {
        pattern: /\b(if|else if|case)\b/g,
        threshold: 10,
        message: 'Too many branches. Consider refactoring with strategy pattern.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.COMPLEXITY,
      },
      
      // 过度的开关语句
      'too-many-switch': {
        pattern: /switch\s*\(/g,
        message: 'Switch statement detected. Consider using polymorphism.',
        severity: SEVERITY.HINT,
        category: CATEGORY.DESIGN,
      },
    };
  }

  async analyze(code, filePath, language) {
    const issues = [];

    for (const [smellName, smell] of Object.entries(this.codeSmells)) {
      const { pattern, message, severity, category, threshold } = smell;
      let match;
      pattern.lastIndex = 0;

      // 对于有 threshold 的规则，需要计数
      if (threshold) {
        let count = 0;
        while ((match = pattern.exec(code)) !== null) {
          count++;
        }
        if (count >= threshold) {
          issues.push({
            rule: `sonar-${smellName}`,
            message: `${message} (Count: ${count})`,
            severity,
            category,
            line: 1,
            column: 1,
            filePath,
            language,
            source: 'sonarqube',
            metrics: { count },
          });
        }
      } else {
        while ((match = pattern.exec(code)) !== null) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);

          issues.push({
            rule: `sonar-${smellName}`,
            message,
            severity,
            category,
            line: lineNum,
            column,
            filePath,
            language,
            source: 'sonarqube',
          });
        }
      }
    }

    return issues;
  }

  getSupportedSmells() {
    return Object.entries(this.codeSmells).map(([name, smell]) => ({
      name: `sonar-${name}`,
      description: smell.message,
      severity: smell.severity,
      category: smell.category,
    }));
  }
}

/**
 * Semgrep 风格的模式匹配分析器
 * Pattern Matching Analyzer inspired by Semgrep
 */
export class SemgrepStyleAnalyzer {
  constructor() {
    this.patterns = this.initializePatterns();
  }

  initializePatterns() {
    return {
      // 通用安全模式
      'generic-sqli': {
        languages: ['python', 'javascript', 'java', 'php'],
        pattern: /(SELECT|INSERT|UPDATE|DELETE|DROP).*=.*(\+|f['"]|format\(|%)/gi,
        message: 'SQL query built using string manipulation. Use parameterized queries instead.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'generic-xss': {
        languages: ['javascript', 'python', 'php'],
        pattern: /(innerHTML|document\.write|\.html\s*\()/g,
        message: 'Potential XSS vulnerability. Sanitize user input before rendering.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'generic-command-injection': {
        languages: ['python', 'javascript', 'php'],
        pattern: /(exec|system|popen|spawn|shell_exec)\s*\([^)]*[\+${]/g,
        message: 'Command injection risk. Avoid shell interpolation with user input.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'generic-path-traversal': {
        languages: ['python', 'javascript', 'java'],
        pattern: /(open|readFile|writeFile|File)\s*\([^)]*[\+${]/g,
        message: 'Potential path traversal. Validate file paths.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'generic-weak-crypto': {
        languages: ['python', 'javascript', 'java'],
        pattern: /(md5|sha1|DES|RC4|MD2)\s*\(/gi,
        message: 'Weak cryptographic algorithm. Use SHA-256 or AES.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'generic-hardcoded-secret': {
        languages: ['all'],
        pattern: /(password|secret|api_key|apikey|token|credential)\s*=\s*['"][^'"]{8,}['"]/gi,
        message: 'Hardcoded secret detected. Use environment variables or a secrets manager.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'generic-debug-mode': {
        languages: ['python', 'javascript', 'php'],
        pattern: /(DEBUG|debug)\s*=\s*(True|true|1)/gi,
        message: 'Debug mode enabled. Disable in production.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
      'generic-insecure-random': {
        languages: ['python', 'javascript'],
        pattern: /(Math\.random|random\.random|random\.randint)/g,
        message: 'Insecure random number generator. Use crypto module for security-sensitive operations.',
        severity: SEVERITY.WARNING,
        category: CATEGORY.SECURITY,
      },
      'generic-no-rate-limiting': {
        languages: ['javascript', 'python'],
        pattern: /(app\.get|app\.post|@app\.route|@router\.)\s*\([^)]*(login|register|password|api)/gi,
        message: 'Sensitive endpoint without apparent rate limiting.',
        severity: SEVERITY.HINT,
        category: CATEGORY.SECURITY,
      },
      'generic-unsafe-deserialization': {
        languages: ['python', 'java'],
        pattern: /(pickle\.loads?|yaml\.load|ObjectInputStream|readObject)/g,
        message: 'Unsafe deserialization. This can lead to remote code execution.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.SECURITY,
      },
    };
  }

  async analyze(code, filePath, language) {
    const issues = [];

    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      // 检查语言是否匹配
      if (!pattern.languages.includes('all') && !pattern.languages.includes(language)) {
        continue;
      }

      const { pattern: regex, message, severity, category } = pattern;
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split('\n').length;
        const column = match.index - code.lastIndexOf('\n', match.index - 1);

        issues.push({
          rule: `semgrep-${patternName}`,
          message,
          severity,
          category,
          line: lineNum,
          column,
          filePath,
          language,
          source: 'semgrep',
        });
      }
    }

    return issues;
  }

  getSupportedPatterns() {
    return Object.entries(this.patterns).map(([name, pattern]) => ({
      name: `semgrep-${name}`,
      description: pattern.message,
      severity: pattern.severity,
      category: pattern.category,
      languages: pattern.languages,
    }));
  }
}

/**
 * 综合安全分析函数
 * 整合所有分析器
 */
export async function analyzeSecurityComprehensive(code, filePath, language) {
  const allIssues = [];

  // 基础安全分析
  const { analyzeSecurity } = await import('./security.js');
  const baseIssues = await analyzeSecurity(code, filePath, language);
  allIssues.push(...baseIssues);

  // Python 特定分析
  if (language === 'python') {
    const banditAnalyzer = new BanditStyleAnalyzer();
    const banditIssues = await banditAnalyzer.analyze(code, filePath);
    allIssues.push(...banditIssues);
  }

  // JavaScript 特定分析
  if (language === 'javascript' || language === 'typescript') {
    const eslintAnalyzer = new ESLintSecurityAnalyzer();
    const eslintIssues = await eslintAnalyzer.analyze(code, filePath);
    allIssues.push(...eslintIssues);
  }

  // SonarQube 风格分析
  const sonarAnalyzer = new SonarStyleAnalyzer();
  const sonarIssues = await sonarAnalyzer.analyze(code, filePath, language);
  allIssues.push(...sonarIssues);

  // Semgrep 风格分析
  const semgrepAnalyzer = new SemgrepStyleAnalyzer();
  const semgrepIssues = await semgrepAnalyzer.analyze(code, filePath, language);
  allIssues.push(...semgrepIssues);

  // 去重（基于规则和行号）
  const uniqueIssues = [];
  const seen = new Set();
  for (const issue of allIssues) {
    const key = `${issue.rule}-${issue.line}-${issue.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueIssues.push(issue);
    }
  }

  return uniqueIssues;
}

/**
 * 获取所有支持的规则
 */
export function getAllSecurityRules() {
  const bandit = new BanditStyleAnalyzer();
  const eslint = new ESLintSecurityAnalyzer();
  const sonar = new SonarStyleAnalyzer();
  const semgrep = new SemgrepStyleAnalyzer();

  return {
    bandit: bandit.getSupportedTests(),
    eslintSecurity: eslint.getSupportedRules(),
    sonarCodeSmells: sonar.getSupportedSmells(),
    semgrepPatterns: semgrep.getSupportedPatterns(),
  };
}

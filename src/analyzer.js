/**
 * 静态代码分析引擎 - 支持多语言
 * Static Code Analysis Engine - Multi-language Support
 */

import { readFileSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

// 语言检测映射
const LANGUAGE_EXTENSIONS = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.r': 'r',
  '.R': 'r',
  '.jl': 'julia',
  '.lua': 'lua',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.clj': 'clojure',
  '.elm': 'elm',
  '.ml': 'ocaml',
  '.fs': 'fsharp',
  '.vb': 'vb',
  '.pl': 'perl',
  '.pm': 'perl',
};

// 问题严重性级别
const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  HINT: 'hint',
};

// 问题类别
const CATEGORY = {
  SECURITY: 'security',
  QUALITY: 'quality',
  STYLE: 'style',
  COMPLEXITY: 'complexity',
  PERFORMANCE: 'performance',
  DESIGN: 'design',
  MAINTAINABILITY: 'maintainability',
  DOCUMENTATION: 'documentation',
};

/**
 * 检测文件的编程语言
 * P2-3: 改进多后缀文件检测，区分声明文件和测试文件
 */
export function detectLanguage(filePath) {
  const name = basename(filePath).toLowerCase();
  
  // 特殊情况：多后缀文件
  if (name.endsWith('.d.ts')) return 'typescript-declaration';
  if (name.endsWith('.spec.ts') || name.endsWith('.test.ts')) return 'typescript-test';
  if (name.endsWith('.spec.js') || name.endsWith('.test.js')) return 'javascript-test';
  if (name.endsWith('.spec.py') || name.endsWith('.test.py')) return 'python-test';
  if (name.endsWith('.spec.java') || name.endsWith('.test.java')) return 'java-test';
  
  // 构建和配置文件
  if (name === 'webpack.config.js' || name === 'vite.config.js' || name === 'rollup.config.js') return 'javascript-config';
  if (name === 'tsconfig.json' || name === 'jsconfig.json') return 'json-config';
  if (name === 'package.json') return 'json-package';
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile' || name === 'cmakefile') return 'makefile';
  
  // 默认检测
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_EXTENSIONS[ext] || 'unknown';
}

/**
 * 基础代码分析器接口
 */
class BaseAnalyzer {
  constructor(language) {
    this.language = language;
  }

  async analyze(code, filePath) {
    throw new Error('analyze() must be implemented by subclass');
  }

  getSupportedRules() {
    throw new Error('getSupportedRules() must be implemented by subclass');
  }
}

/**
 * JavaScript/TypeScript 分析器
 */
class JavaScriptAnalyzer extends BaseAnalyzer {
  constructor() {
    super('javascript');
  }

  async analyze(code, filePath) {
    const issues = [];
    const lines = code.split('\n');

    // 检测 console.log
    const consoleRegex = /console\.(log|warn|error|info|debug)/g;
    for (const match of code.matchAll(consoleRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-console',
        message: 'Avoid using console statements in production code',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 debugger
    const debuggerRegex = /\bdebugger\b/g;
    for (const match of code.matchAll(debuggerRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-debugger',
        message: 'Remove debugger statements before committing code',
        severity: SEVERITY.ERROR,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 var 使用
    const varRegex = /\bvar\b/g;
    for (const match of code.matchAll(varRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-var',
        message: 'Use let or const instead of var',
        severity: SEVERITY.WARNING,
        category: CATEGORY.STYLE,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 TODO/FIXME 注释
    const todoRegex = /(\/\/|\/\*|\#)\s*(TODO|FIXME|XXX|HACK)/gi;
    for (const match of code.matchAll(todoRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-todo',
        message: 'Remove TODO/FIXME comments before committing',
        severity: SEVERITY.INFO,
        category: CATEGORY.DOCUMENTATION,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测过长的函数 - P1-FIX: Support arrow functions, class methods, async functions
    const functionPatterns = [
      // Traditional: function name() {}
      /(?:async\s+)?function\s+\w+/g,
      // Arrow functions: const name = () => {} or const name = async () => {}
      /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      // Arrow functions shorthand: const name = async () =>
      /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\w+\s*=>/g,
      // Class methods: methodName() {} or async methodName() {}
      /(?:async\s+)?\w+\s*\([^)]*\)\s*\{/g,
      // Object methods: name: function() {} or name: async function() {}
      /\w+\s*:\s*(?:async\s+)?function/g,
    ];

    const analyzedFunctions = new Set();
    
    for (const pattern of functionPatterns) {
      for (const funcMatch of code.matchAll(pattern)) {
        const startLine = code.substring(0, funcMatch.index).split('\n').length;
        const funcStart = funcMatch.index;
        let braceCount = 0;
        let funcEnd = funcStart;
        let inFunction = false;

        for (let i = funcStart; i < code.length; i++) {
          if (code[i] === '{') {
            braceCount++;
            inFunction = true;
          } else if (code[i] === '}') {
            braceCount--;
            if (inFunction && braceCount === 0) {
              funcEnd = i;
              break;
            }
          }
        }

        const funcCode = code.substring(funcStart, funcEnd);
        const funcId = `${startLine}:${funcStart}`;
        
        if (!analyzedFunctions.has(funcId)) {
          analyzedFunctions.add(funcId);
          const funcLines = funcCode.split('\n').length;

          if (funcLines > 50) {
            issues.push({
              rule: 'max-lines-per-function',
              message: `Function is too long (${funcLines} lines). Consider breaking it into smaller functions.`,
              severity: SEVERITY.WARNING,
              category: CATEGORY.COMPLEXITY,
              line: startLine,
              column: 1,
              filePath,
              metrics: { functionLines: funcLines },
            });
          }
        }
      }
    }

    // 检测嵌套过深
    const maxNesting = this.analyzeNestingDepth(code);
    if (maxNesting.depth > 4) {
      issues.push({
        rule: 'max-nesting-depth',
        message: `Code nesting depth is too high (${maxNesting.depth}). Consider refactoring.`,
        severity: SEVERITY.WARNING,
        category: CATEGORY.COMPLEXITY,
        line: maxNesting.line,
        column: 1,
        filePath,
        metrics: { nestingDepth: maxNesting.depth },
      });
    }

    // 检测魔法数字
    const magicNumberRegex = /[2-9]\d{2,}|\d{4,}/g;
    const matches = code.matchAll(magicNumberRegex);
    for (const match of matches) {
      // Skip if preceded/followed by word characters
      if (match.index > 0 && /\w/.test(code[match.index - 1])) continue;
      if (match.index + match[0].length < code.length && /\w/.test(code[match.index + match[0].length])) continue;
      
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-magic-numbers',
        message: `Magic number detected: ${match[0]}. Consider using a named constant.`,
        severity: SEVERITY.HINT,
        category: CATEGORY.MAINTAINABILITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    return issues;
  }

  analyzeNestingDepth(code) {
    let maxDepth = 0;
    let currentDepth = 0;
    let maxDepthLine = 1;
    let lineNum = 1;
    let inString = false;
    let stringChar = '';
    let i = 0;

    while (i < code.length) {
      const char = code[i];

      // Track line numbers
      if (char === '\n') lineNum++;

      // Handle escaped characters in strings
      if (char === '\\' && inString) {
        i += 2;
        continue;
      }

      // Handle string boundaries
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      } else if (char === stringChar && inString) {
        inString = false;
        i++;
        continue;
      }

      // Skip comments if not in string
      if (!inString) {
        // Single-line comment
        if (char === '/' && code[i + 1] === '/') {
          const newlineIndex = code.indexOf('\n', i);
          if (newlineIndex === -1) break;
          i = newlineIndex;
          continue;
        }

        // Multi-line comment
        if (char === '/' && code[i + 1] === '*') {
          const closeIndex = code.indexOf('*/', i + 2);
          if (closeIndex === -1) break;
          // Count newlines in comment for line tracking
          for (let j = i; j < closeIndex + 2; j++) {
            if (code[j] === '\n') lineNum++;
          }
          i = closeIndex + 2;
          continue;
        }
      }

      // P1-FIX: Only count brackets outside of strings and comments
      if (!inString) {
        if (char === '{' || char === '(' || char === '[') {
          currentDepth++;
          if (currentDepth > maxDepth) {
            maxDepth = currentDepth;
            maxDepthLine = lineNum;
          }
        } else if (char === '}' || char === ')' || char === ']') {
          currentDepth--;
        }
      }

      i++;
    }

    return { depth: maxDepth, line: maxDepthLine };
  }

  getSupportedRules() {
    return [
      { name: 'no-console', description: 'Disallow console statements', severity: SEVERITY.WARNING },
      { name: 'no-debugger', description: 'Disallow debugger statements', severity: SEVERITY.ERROR },
      { name: 'no-var', description: 'Require let/const instead of var', severity: SEVERITY.WARNING },
      { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
      { name: 'max-lines-per-function', description: 'Enforce maximum function length', severity: SEVERITY.WARNING },
      { name: 'max-nesting-depth', description: 'Enforce maximum nesting depth', severity: SEVERITY.WARNING },
      { name: 'no-magic-numbers', description: 'Disallow magic numbers', severity: SEVERITY.HINT },
    ];
  }
}

/**
 * Python 分析器
 */
class PythonAnalyzer extends BaseAnalyzer {
  constructor() {
    super('python');
  }

  async analyze(code, filePath) {
    const issues = [];
    const lines = code.split('\n');

    // 检测 print 语句
    const printRegex = /\bprint\s*\(/g;
    for (const match of code.matchAll(printRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-print',
        message: 'Avoid using print statements in production code',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 TODO/FIXME
    const todoRegex = /#\s*(TODO|FIXME|XXX|HACK)/gi;
    for (const match of code.matchAll(todoRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-todo',
        message: 'Remove TODO/FIXME comments before committing',
        severity: SEVERITY.INFO,
        category: CATEGORY.DOCUMENTATION,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测过长的函数
    const defRegex = /^(def|async def)\s+\w+/gm;
    for (const match of code.matchAll(defRegex)) {
      const startLine = code.substring(0, match.index).split('\n').length;
      const defStart = match.index;
      let funcEnd = defStart;
      const baseIndentMatch = code.substring(match.index).match(/^\s*/);
      const baseIndent = baseIndentMatch ? baseIndentMatch[0].length : 0;

      for (let i = defStart; i < code.length; i++) {
        if (code[i] === '\n') {
          const lineStart = code.lastIndexOf('\n', i - 1) + 1;
          const lineIndentMatch = code.substring(lineStart).match(/^\s*/);
          const lineIndent = lineIndentMatch ? lineIndentMatch[0].length : 0;
          if (lineIndent <= baseIndent && code.substring(lineStart).trim() && !code.substring(lineStart).trim().startsWith('#')) {
            funcEnd = i;
            break;
          }
        }
      }

      const funcCode = code.substring(defStart, funcEnd);
      const funcLines = funcCode.split('\n').length;

      if (funcLines > 50) {
        issues.push({
          rule: 'max-lines-per-function',
          message: `Function is too long (${funcLines} lines). Consider breaking it into smaller functions.`,
          severity: SEVERITY.WARNING,
          category: CATEGORY.COMPLEXITY,
          line: startLine,
          column: 1,
          filePath,
          metrics: { functionLines: funcLines },
        });
      }
    }

    // 检测 bare except
    const exceptRegex = /^\s*except\s*:/gm;
    for (const match of code.matchAll(exceptRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-bare-except',
        message: 'Use specific exception types instead of bare except',
        severity: SEVERITY.ERROR,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测导入 *
    const importStarRegex = /^\s*from\s+\S+\s+import\s+\*/gm;
    for (const match of code.matchAll(importStarRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-wildcard-import',
        message: 'Avoid wildcard imports (import *)',
        severity: SEVERITY.WARNING,
        category: CATEGORY.STYLE,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 PEP8 风格问题 - 行过长
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          rule: 'max-line-length',
          message: `Line exceeds 120 characters (${line.length} characters)`,
          severity: SEVERITY.HINT,
          category: CATEGORY.STYLE,
          line: index + 1,
          column: 121,
          filePath,
        });
      }
    });

    return issues;
  }

  getSupportedRules() {
    return [
      { name: 'no-print', description: 'Disallow print statements', severity: SEVERITY.WARNING },
      { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
      { name: 'no-bare-except', description: 'Require specific exception types', severity: SEVERITY.ERROR },
      { name: 'no-wildcard-import', description: 'Disallow wildcard imports', severity: SEVERITY.WARNING },
      { name: 'max-lines-per-function', description: 'Enforce maximum function length', severity: SEVERITY.WARNING },
      { name: 'max-line-length', description: 'Enforce maximum line length', severity: SEVERITY.HINT },
    ];
  }
}

/**
 * Java 分析器
 */
class JavaAnalyzer extends BaseAnalyzer {
  constructor() {
    super('java');
  }

  async analyze(code, filePath) {
    const issues = [];

    // 检测 System.out.println
    const sysoutRegex = /System\.out\.(println|print)/g;
    for (const match of code.matchAll(sysoutRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-system-out',
        message: 'Use a logging framework instead of System.out',
        severity: SEVERITY.WARNING,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测 TODO/FIXME
    const todoRegex = /(\/\/|\/\*)\s*(TODO|FIXME|XXX|HACK)/gi;
    for (const match of code.matchAll(todoRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-todo',
        message: 'Remove TODO/FIXME comments before committing',
        severity: SEVERITY.INFO,
        category: CATEGORY.DOCUMENTATION,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测空 catch 块
    const emptyCatchRegex = /catch\s*\([^)]+\)\s*\{\s*\}/g;
    for (const match of code.matchAll(emptyCatchRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-empty-catch',
        message: 'Empty catch block. Handle or log the exception.',
        severity: SEVERITY.ERROR,
        category: CATEGORY.QUALITY,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    return issues;
  }

  getSupportedRules() {
    return [
      { name: 'no-system-out', description: 'Disallow System.out.println', severity: SEVERITY.WARNING },
      { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
      { name: 'no-empty-catch', description: 'Disallow empty catch blocks', severity: SEVERITY.ERROR },
    ];
  }
}

/**
 * 通用分析器（用于其他语言）
 */
class GenericAnalyzer extends BaseAnalyzer {
  constructor(language) {
    super(language);
  }

  async analyze(code, filePath) {
    const issues = [];
    const lines = code.split('\n');

    // 检测 TODO/FIXME（通用）
    const todoRegex = /(\/\/|\/\*|\#|--)\s*(TODO|FIXME|XXX|HACK)/gi;
    for (const match of code.matchAll(todoRegex)) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      issues.push({
        rule: 'no-todo',
        message: 'Remove TODO/FIXME comments before committing',
        severity: SEVERITY.INFO,
        category: CATEGORY.DOCUMENTATION,
        line: lineNum,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        filePath,
      });
    }

    // 检测行长度
    lines.forEach((line, index) => {
      if (line.length > 150) {
        issues.push({
          rule: 'max-line-length',
          message: `Line exceeds 150 characters (${line.length} characters)`,
          severity: SEVERITY.HINT,
          category: CATEGORY.STYLE,
          line: index + 1,
          column: 151,
          filePath,
        });
      }
    });

    // 检测空白行过多
    let consecutiveBlankLines = 0;
    lines.forEach((line, index) => {
      if (line.trim() === '') {
        consecutiveBlankLines++;
        if (consecutiveBlankLines >= 3) {
          issues.push({
            rule: 'no-multiple-blank-lines',
            message: 'Multiple consecutive blank lines detected',
            severity: SEVERITY.HINT,
            category: CATEGORY.STYLE,
            line: index + 1,
            column: 1,
            filePath,
          });
        }
      } else {
        consecutiveBlankLines = 0;
      }
    });

    return issues;
  }

  getSupportedRules() {
    return [
      { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
      { name: 'max-line-length', description: 'Enforce maximum line length', severity: SEVERITY.HINT },
      { name: 'no-multiple-blank-lines', description: 'Disallow multiple consecutive blank lines', severity: SEVERITY.HINT },
    ];
  }
}

/**
 * 代码复杂度分析
 */
export function analyzeComplexity(code, language) {
  const metrics = {
    linesOfCode: code.split('\n').length,
    commentLines: 0,
    blankLines: 0,
    codeLines: 0,
    functions: 0,
    classes: 0,
    estimatedCyclomaticComplexity: 1,
  };

  const lines = code.split('\n');

  // 计算注释行和空白行
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === '') {
      metrics.blankLines++;
    } else if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('--')
    ) {
      metrics.commentLines++;
    } else {
      metrics.codeLines++;
    }
  });

  // 检测函数和类
  const functionPatterns = [
    /function\s+\w+/g,
    /const\s+\w+\s*=\s*(async\s+)?\(/g,
    /def\s+\w+/g,
    /public|private|protected\s+\w+\s*\(/g,
    /func\s+\w+/g,
    /fn\s+\w+/g,
  ];

  for (const pattern of functionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      metrics.functions += matches.length;
    }
  }

  const classPatterns = [
    /class\s+\w+/g,
    /interface\s+\w+/g,
    /struct\s+\w+/g,
    /enum\s+\w+/g,
  ];

  for (const pattern of classPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      metrics.classes += matches.length;
    }
  }

  // 估算圈复杂度
  const complexityKeywords = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]/g, // 三元运算符
    /\band\b/g,
    /\bor\b/g,
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of complexityKeywords) {
    const matches = code.match(pattern);
    if (matches) {
      metrics.estimatedCyclomaticComplexity += matches.length;
    }
  }

  return metrics;
}

/**
 * 获取适当的分析器
 */
export function getAnalyzer(language) {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return new JavaScriptAnalyzer();
    case 'python':
      return new PythonAnalyzer();
    case 'java':
      return new JavaAnalyzer();
    default:
      return new GenericAnalyzer(language);
  }
}

/**
 * 分析单个文件
 */
export async function analyzeFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const code = readFileSync(filePath, 'utf-8');
  const language = detectLanguage(filePath);

  if (language === 'unknown') {
    return {
      filePath,
      language: 'unknown',
      issues: [],
      metrics: null,
      message: 'Unsupported language',
    };
  }

  const analyzer = getAnalyzer(language);
  const issues = await analyzer.analyze(code, filePath);
  const metrics = analyzeComplexity(code, language);

  return {
    filePath,
    language,
    issues,
    metrics,
  };
}

/**
 * 分析多个文件
 */
export async function analyzeFiles(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    try {
      const result = await analyzeFile(filePath);
      results.push(result);
    } catch (error) {
      results.push({
        filePath,
        error: error.message,
      });
    }
  }

  return results;
}

export { SEVERITY, CATEGORY };

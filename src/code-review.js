/**
 * 代码审查和错误检测模块
 * Code Review and Error Detection Module
 * 
 * 灵感来自 CodeRabbit、Reviewdog 等工具
 * Inspired by CodeRabbit, Reviewdog, and similar tools
 */

import { SEVERITY, CATEGORY } from './analyzer.js';

/**
 * 常见代码错误模式
 * Common Code Error Patterns
 */
const ERROR_PATTERNS = {
  // 语法错误
  syntax: {
    missingClosing: {
      pattern: /\{[^}]*$/m,
      message: 'Missing closing brace',
      fix: 'Add closing brace `}`',
      severity: SEVERITY.ERROR,
    },
    unmatchedParen: {
      pattern: /\([^)]*$/m,
      message: 'Unmatched parenthesis',
      fix: 'Add closing parenthesis `)`',
      severity: SEVERITY.ERROR,
    },
    missingSemicolon: {
      pattern: /^[^#]*\b(const|let|var|function|return|import|export)\s+[^;]+$/gm,
      message: 'Possible missing semicolon',
      fix: 'Add semicolon `;` at the end of statement',
      severity: SEVERITY.WARNING,
    },
  },
  
  // 逻辑错误
  logic: {
    offByOne: {
      pattern: /for\s*\(\s*let\s+\w+\s*<=\s*\w+\.length/g,
      message: 'Off-by-one error: using <= with array.length',
      fix: 'Use < instead of <= for array iteration',
      severity: SEVERITY.ERROR,
    },
    assignmentInCondition: {
      pattern: /if\s*\(\s*\w+\s*=\s*[^=]/g,
      message: 'Assignment in condition (did you mean == or ===?)',
      fix: 'Use === for comparison or wrap assignment in extra parentheses',
      severity: SEVERITY.ERROR,
    },
    alwaysTrue: {
      pattern: /while\s*\(\s*true\s*\)/g,
      message: 'Infinite loop detected',
      fix: 'Ensure loop has a proper exit condition',
      severity: SEVERITY.WARNING,
    },
  },
  
  // 类型错误
  type: {
    nullDereference: {
      pattern: /if\s*\(\s*\w+\s*!==?\s*null\s*\)\s*\{\s*\w+\./g,
      message: 'Possible null dereference',
      fix: 'Add null check before accessing property',
      severity: SEVERITY.ERROR,
    },
    undefinedUsage: {
      pattern: /\bundefined\b(?!\s*[=])/g,
      message: 'Using undefined - consider explicit checks',
      fix: 'Use typeof x === "undefined" for checks',
      severity: SEVERITY.HINT,
    },
  },
  
  // 性能问题
  performance: {
    domAccessInLoop: {
      pattern: /for\s*\([^)]*\)\s*\{[^}]*getElementById/g,
      message: 'DOM access inside loop',
      fix: 'Cache DOM element reference outside the loop',
      severity: SEVERITY.WARNING,
    },
    arrayConcatInLoop: {
      pattern: /for\s*\([^)]*\)\s*\{[^}]*\[\]\.concat/g,
      message: 'Array concatenation in loop',
      fix: 'Use array.push() or build array outside loop',
      severity: SEVERITY.WARNING,
    },
  },
  
  // 内存泄漏
  memory: {
    eventListenerLeak: {
      pattern: /addEventListener\s*\([^)]*\)(?![\s\S]*removeEventListener)/g,
      message: 'Event listener added without corresponding removal',
      fix: 'Add removeEventListener in cleanup',
      severity: SEVERITY.WARNING,
    },
    intervalLeak: {
      pattern: /setInterval\s*\([^)]*\)(?![\s\S]*clearInterval)/g,
      message: 'Interval created without clearInterval',
      fix: 'Store interval ID and call clearInterval when done',
      severity: SEVERITY.WARNING,
    },
  },
};

/**
 * 代码审查规则 (CodeRabbit 风格)
 * Code Review Rules (CodeRabbit style)
 */
const CODE_REVIEW_RULES = {
  // 最佳实践
  bestPractices: {
    noConsole: {
      pattern: /console\.(log|warn|error|info|debug)/g,
      message: 'Console statement in production code',
      suggestion: 'Remove console statements or use a proper logging framework',
      severity: SEVERITY.WARNING,
      category: CATEGORY.QUALITY,
    },
    noDebugger: {
      pattern: /\bdebugger\b/g,
      message: 'Debugger statement found',
      suggestion: 'Remove debugger statement before committing',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    preferConst: {
      pattern: /\blet\s+(\w+)\s*=\s*[^;]+;(?:[\s\S]*?)(?!\b\1\s*=)/g,
      message: 'Variable declared with let but never reassigned',
      suggestion: 'Use const instead of let for variables that are not reassigned',
      severity: SEVERITY.HINT,
      category: CATEGORY.STYLE,
    },
  },
  
  // 错误处理
  errorHandling: {
    emptyCatch: {
      pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
      message: 'Empty catch block',
      suggestion: 'Log the error or handle it appropriately',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    swallowError: {
      pattern: /catch\s*\([^)]*\)\s*\{\s*\/\/.*\n\s*\}/g,
      message: 'Error is caught but ignored',
      suggestion: 'Handle the error or rethrow with additional context',
      severity: SEVERITY.WARNING,
      category: CATEGORY.QUALITY,
    },
    noErrorType: {
      pattern: /catch\s*\(\s*\w+\s*\)/g,
      message: 'Generic error catch without type checking',
      suggestion: 'Check error type for specific handling',
      severity: SEVERITY.HINT,
      category: CATEGORY.QUALITY,
    },
  },
  
  // 代码清晰度
  clarity: {
    longFunction: {
      pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{500,}\}/g,
      message: 'Function is too long (>500 characters)',
      suggestion: 'Consider breaking into smaller, focused functions',
      severity: SEVERITY.WARNING,
      category: CATEGORY.COMPLEXITY,
    },
    deepNesting: {
      pattern: /^\s{16,}/gm,
      message: 'Deep nesting (>4 levels)',
      suggestion: 'Consider early returns or extracting methods',
      severity: SEVERITY.WARNING,
      category: CATEGORY.COMPLEXITY,
    },
    magicNumber: {
      pattern: /(?<!\w)([2-9]\d{2,}|\d{4,})(?!\w)/g,
      message: 'Magic number detected',
      suggestion: 'Extract to a named constant for clarity',
      severity: SEVERITY.HINT,
      category: CATEGORY.MAINTAINABILITY,
    },
  },
  
  // 文档
  documentation: {
    missingJSDoc: {
      pattern: /export\s+(?:async\s+)?function\s+\w+/g,
      message: 'Exported function missing JSDoc comment',
      suggestion: 'Add JSDoc comment describing purpose, parameters, and return value',
      severity: SEVERITY.HINT,
      category: CATEGORY.DOCUMENTATION,
    },
    todoComment: {
      pattern: /(\/\/|\/\*|\#)\s*(TODO|FIXME|XXX|HACK)/gi,
      message: 'TODO/FIXME comment found',
      suggestion: 'Address the TODO or create a tracked issue',
      severity: SEVERITY.INFO,
      category: CATEGORY.DOCUMENTATION,
    },
  },
  
  // 测试
  testing: {
    noAssert: {
      pattern: /function\s+test\w*\s*\([^)]*\)\s*\{[\s\S]*?\}/g,
      hasAssert: false,
      message: 'Test function without assertions',
      suggestion: 'Add assertions to verify expected behavior',
      severity: SEVERITY.WARNING,
      category: CATEGORY.QUALITY,
    },
  },
};

/**
 * 多语言错误检测
 * Multi-language Error Detection
 */
const LANGUAGE_SPECIFIC_RULES = {
  python: {
    bareExcept: {
      pattern: /except\s*:/g,
      message: 'Bare except clause',
      suggestion: 'Use specific exception types (except Exception as e:)',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    mutableDefault: {
      pattern: /def\s+\w+\s*\([^)]*=\s*(\[\]|\{\})\s*\)/g,
      message: 'Mutable default argument',
      suggestion: 'Use None as default and initialize inside function',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    globalStatement: {
      pattern: /\bglobal\s+\w+/g,
      message: 'Global statement usage',
      suggestion: 'Consider using a class or module-level variable',
      severity: SEVERITY.WARNING,
      category: CATEGORY.DESIGN,
    },
  },
  
  java: {
    emptyCatch: {
      pattern: /catch\s*\([^)]+\)\s*\{\s*\}/g,
      message: 'Empty catch block',
      suggestion: 'Handle or log the exception',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    systemOut: {
      pattern: /System\.(out|err)\.(println|print)/g,
      message: 'Direct console output',
      suggestion: 'Use a logging framework like SLF4J or Log4j',
      severity: SEVERITY.WARNING,
      category: CATEGORY.QUALITY,
    },
  },
  
  go: {
    ignoredError: {
      pattern: /:=\s*\w+\s*(?:,\s*\w+)*\s*:=\s*\w+\([^)]*\)(?:\s*;|\s*$)/g,
      message: 'Error value might be ignored',
      suggestion: 'Always check returned errors',
      severity: SEVERITY.ERROR,
      category: CATEGORY.QUALITY,
    },
    deferInLoop: {
      pattern: /for\s*\([^)]*\)\s*\{[^}]*defer/g,
      message: 'Defer in loop',
      suggestion: 'Defer statements accumulate; consider alternative',
      severity: SEVERITY.WARNING,
      category: CATEGORY.PERFORMANCE,
    },
  },
  
  rust: {
    unwrap: {
      pattern: /\.unwrap\(\)/g,
      message: 'Unwrap usage',
      suggestion: 'Consider using ? operator or proper error handling',
      severity: SEVERITY.WARNING,
      category: CATEGORY.QUALITY,
    },
    expect: {
      pattern: /\.expect\s*\("[^"]*"\)/g,
      message: 'Expect with message',
      suggestion: 'Ensure error message is helpful for debugging',
      severity: SEVERITY.HINT,
      category: CATEGORY.QUALITY,
    },
  },
};

/**
 * 代码审查分析器类
 * Code Review Analyzer Class
 */
export class CodeReviewAnalyzer {
  constructor() {
    this.errorPatterns = ERROR_PATTERNS;
    this.reviewRules = CODE_REVIEW_RULES;
    this.languageRules = LANGUAGE_SPECIFIC_RULES;
  }

  /**
   * 分析代码错误
   */
  async analyzeErrors(code, filePath, language) {
    const issues = [];

    // 检测通用错误
    for (const [category, patterns] of Object.entries(this.errorPatterns)) {
      for (const [name, { pattern, message, fix, severity }] of Object.entries(patterns)) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(code)) !== null) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);
          
          issues.push({
            type: 'error',
            category,
            rule: name,
            message,
            suggestion: fix,
            severity,
            line: lineNum,
            column,
            filePath,
            language,
            autoFixable: true,
          });
        }
      }
    }

    // 检测语言特定错误
    if (this.languageRules[language]) {
      for (const [name, { pattern, message, suggestion, severity, category }] of 
           Object.entries(this.languageRules[language])) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(code)) !== null) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);
          
          issues.push({
            type: 'language_specific',
            category,
            rule: name,
            message,
            suggestion,
            severity,
            line: lineNum,
            column,
            filePath,
            language,
            autoFixable: false,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 代码审查 (CodeRabbit 风格)
   */
  async reviewCode(code, filePath, language) {
    const issues = [];

    // 应用代码审查规则
    for (const [category, rules] of Object.entries(this.reviewRules)) {
      for (const [name, rule] of Object.entries(rules)) {
        let match;
        rule.pattern.lastIndex = 0;
        
        while ((match = rule.pattern.exec(code)) !== null) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);
          
          issues.push({
            type: 'review',
            category: rule.category || category,
            rule: `${category}-${name}`,
            message: rule.message,
            suggestion: rule.suggestion,
            severity: rule.severity,
            line: lineNum,
            column,
            filePath,
            language,
            autoFixable: false,
          });
        }
      }
    }

    // 语言特定审查
    if (this.languageRules[language]) {
      for (const [name, { pattern, message, suggestion, severity, category }] of 
           Object.entries(this.languageRules[language])) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(code)) !== null) {
          const lineNum = code.substring(0, match.index).split('\n').length;
          const column = match.index - code.lastIndexOf('\n', match.index - 1);
          
          issues.push({
            type: 'review',
            category,
            rule: `lang-${language}-${name}`,
            message,
            suggestion,
            severity,
            line: lineNum,
            column,
            filePath,
            language,
            autoFixable: false,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions(issues, code) {
    const suggestions = [];

    for (const issue of issues) {
      if (issue.autoFixable) {
        suggestions.push({
          ...issue,
          hasAutoFix: true,
          fixCode: this.generateFixCode(issue, code),
        });
      } else {
        suggestions.push({
          ...issue,
          hasAutoFix: false,
          manualSteps: this.generateManualSteps(issue),
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成自动修复代码
   */
  generateFixCode(issue, code) {
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    
    switch (issue.rule) {
      case 'missingClosing':
        return lines[lineIndex] + ' }';
      case 'missingSemicolon':
        return lines[lineIndex].trimEnd() + ';';
      case 'offByOne':
        return lines[lineIndex].replace('<=', '<');
      default:
        return null;
    }
  }

  /**
   * 生成手动修复步骤
   */
  generateManualSteps(issue) {
    const steps = [
      `Locate the issue at line ${issue.line}`,
      issue.suggestion,
      'Review the change in context',
      'Test the modified code',
    ];

    return steps;
  }

  /**
   * 获取支持的规则列表
   */
  getSupportedRules() {
    const rules = {
      errorDetection: {},
      codeReview: {},
      languageSpecific: {},
    };

    // 错误检测规则
    for (const [category, patterns] of Object.entries(this.errorPatterns)) {
      rules.errorDetection[category] = Object.entries(patterns).map(([name, { message, severity }]) => ({
        name,
        message,
        severity,
      }));
    }

    // 代码审查规则
    for (const [category, ruleSet] of Object.entries(this.reviewRules)) {
      rules.codeReview[category] = Object.entries(ruleSet).map(([name, { message, severity, category: cat }]) => ({
        name,
        message,
        severity,
        category: cat,
      }));
    }

    // 语言特定规则
    for (const [language, ruleSet] of Object.entries(this.languageRules)) {
      rules.languageSpecific[language] = Object.entries(ruleSet).map(([name, { message, severity, category }]) => ({
        name,
        message,
        severity,
        category,
      }));
    }

    return rules;
  }
}

/**
 * 生成代码审查报告 (CodeRabbit 风格)
 */
export function generateCodeReviewReport(issues, code, filePath) {
  const report = {
    filePath,
    summary: {
      totalIssues: issues.length,
      bySeverity: {
        [SEVERITY.ERROR]: issues.filter(i => i.severity === SEVERITY.ERROR).length,
        [SEVERITY.WARNING]: issues.filter(i => i.severity === SEVERITY.WARNING).length,
        [SEVERITY.INFO]: issues.filter(i => i.severity === SEVERITY.INFO).length,
        [SEVERITY.HINT]: issues.filter(i => i.severity === SEVERITY.HINT).length,
      },
      byCategory: {},
      autoFixable: issues.filter(i => i.autoFixable).length,
    },
    issues: issues.map(issue => ({
      ...issue,
      snippet: getLineSnippet(code, issue.line),
    })),
    suggestions: [],
    timestamp: new Date().toISOString(),
  };

  // 按类别分组
  issues.forEach(issue => {
    if (!report.summary.byCategory[issue.category]) {
      report.summary.byCategory[issue.category] = 0;
    }
    report.summary.byCategory[issue.category]++;
  });

  // 生成建议
  const analyzer = new CodeReviewAnalyzer();
  report.suggestions = analyzer.generateFixSuggestions(issues, code);

  return report;
}

/**
 * 获取行片段
 */
function getLineSnippet(code, lineNum) {
  const lines = code.split('\n');
  const index = lineNum - 1;
  
  if (index < 0 || index >= lines.length) {
    return '';
  }

  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 3);
  
  return lines.slice(start, end).join('\n');
}

/**
 * 支持的语言列表 (扩展到 50+ 种)
 */
export const SUPPORTED_LANGUAGES_EXTENDED = [
  // Web
  'javascript', 'typescript', 'html', 'css', 'scss', 'less', 'sass',
  
  // Backend
  'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'ruby',
  'kotlin', 'scala', 'swift', 'objective-c', 'dart',
  
  // Functional
  'haskell', 'ocaml', 'fsharp', 'clojure', 'elixir', 'erlang', 'elm',
  
  // Scripting
  'shell', 'bash', 'zsh', 'powershell', 'lua', 'perl', 'r',
  
  // Data & Config
  'sql', 'graphql', 'json', 'yaml', 'toml', 'xml', 'markdown',
  
  // Mobile
  'swift', 'kotlin', 'dart', 'objective-c',
  
  // Systems
  'c', 'cpp', 'rust', 'go', 'assembly', 'zig', 'nim',
  
  // JVM
  'java', 'kotlin', 'scala', 'groovy',
  
  // .NET
  'csharp', 'fsharp', 'vb',
  
  // Database
  'sql', 'plsql', 'tsql', 'mongodb',
  
  // Other
  'solidity', 'v', 'crystal', 'd', 'raku', 'coffeescript',
  'vue', 'svelte', 'twig', 'liquid',
];

/**
 * 检测文件语言 (扩展版)
 */
export function detectLanguageExtended(filePath) {
  const extMap = {
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
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.scala': 'scala',
    '.r': 'r',
    '.R': 'r',
    '.jl': 'julia',
    '.lua': 'lua',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
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
    '.cljs': 'clojure',
    '.elm': 'elm',
    '.ml': 'ocaml',
    '.mli': 'ocaml',
    '.fs': 'fsharp',
    '.fsi': 'fsharp',
    '.vb': 'vb',
    '.pl': 'perl',
    '.pm': 'perl',
    '.groovy': 'groovy',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.sol': 'solidity',
    '.twig': 'twig',
    '.liquid': 'liquid',
    '.coffee': 'coffeescript',
    '.asm': 'assembly',
    '.s': 'assembly',
    '.zig': 'zig',
    '.nim': 'nim',
    '.cr': 'crystal',
    '.d': 'd',
    '.rake': 'ruby',
    '.jl': 'julia',
    '.ipynb': 'python',
  };

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return extMap[ext] || 'unknown';
}

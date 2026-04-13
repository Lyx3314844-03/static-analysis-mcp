/**
 * 日志分析模块
 * Log Analysis Module
 * 
 * 分析应用程序日志文件
 * 检测错误、警告、性能问题、安全事件
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 日志级别定义
 */
const LOG_LEVELS = {
  ERROR: { level: 1, name: 'ERROR', color: 'red' },
  WARN: { level: 2, name: 'WARN', color: 'orange' },
  WARNING: { level: 2, name: 'WARNING', color: 'orange' },
  INFO: { level: 3, name: 'INFO', color: 'blue' },
  DEBUG: { level: 4, name: 'DEBUG', color: 'gray' },
  TRACE: { level: 5, name: 'TRACE', color: 'lightgray' },
};

/**
 * 日志模式匹配器
 */
const LOG_PATTERNS = {
  // 通用日志格式
  generic: [
    /^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]\s*\[(\w+)\]\s*(.*)$/m,
    /^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(\w+)\s+(.*)$/m,
    /^(\w+)\s+(\d{1,2},?\s+\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.*)$/m,
  ],
  
  // npm 日志
  npm: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(\w+)\s+(.*)$/m,
  
  // Python logging
  python: /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d+)?)\s*-\s*(\w+)\s*-\s*(.*)$/m,
  
  // Java/Log4j
  java: /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[(\w+)\]\s+(.*)$/m,
  
  // Syslog
  syslog: /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+):\s*(.*)$/m,
  
  // Apache/Nginx
  apache: /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)/m,
  
  // JSON 日志
  json: /^\s*\{.*"level".*"message".*\}\s*$/m,
};

/**
 * 安全事件模式
 */
const SECURITY_PATTERNS = [
  { name: 'Failed Login', pattern: /failed\s+(login|authentication)|invalid\s+(password|credentials)|unauthorized/i },
  { name: 'SQL Injection', pattern: /sql\s+injection|union\s+select|drop\s+table|;\s*--/i },
  { name: 'XSS Attempt', pattern: /<script|javascript:|onerror\s*=|onload\s*=/i },
  { name: 'Path Traversal', pattern: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\//i },
  { name: 'Command Injection', pattern: /;\s*(cat|ls|pwd|whoami|id|uname)|`[^`]+`|\$\([^)]+\)/i },
  { name: 'Access Denied', pattern: /access\s+(denied|forbidden)|permission\s+denied|403/i },
  { name: 'Rate Limit', pattern: /rate\s+limit|too\s+many\s+requests|429/i },
  { name: 'Suspicious IP', pattern: /blocked\s+ip|blacklist|suspicious\s+activity/i },
];

/**
 * 性能问题模式
 */
const PERFORMANCE_PATTERNS = [
  { name: 'Slow Query', pattern: /slow\s+query|query\s+took|execution\s+time.*\d{4,}/i },
  { name: 'Timeout', pattern: /timeout|timed?\s*out|connection\s+reset/i },
  { name: 'Memory Issue', pattern: /out\s+of\s+memory|memory\s+exhausted|heap\s+overflow/i },
  { name: 'Connection Pool', pattern: /connection\s+pool|pool\s+exhausted|no\s+available\s+connections/i },
  { name: 'High Load', pattern: /high\s+load|cpu\s+spike|resource\s+contention/i },
  { name: 'Disk Space', pattern: /disk\s+full|no\s+space\s+left|storage\s+exhausted/i },
];

/**
 * 错误分类
 */
const ERROR_CATEGORIES = {
  SYNTAX: { name: 'Syntax Error', patterns: [/syntax\s+error|parse\s+error|unexpected\s+token/i] },
  RUNTIME: { name: 'Runtime Error', patterns: [/runtime\s+error|exception|crash|fatal/i] },
  NETWORK: { name: 'Network Error', patterns: [/network\s+error|connection\s+(refused|failed|lost)|ECONN/i] },
  DATABASE: { name: 'Database Error', patterns: [/database\s+error|sql\s+error|query\s+failed|deadlock/i] },
  FILESYSTEM: { name: 'Filesystem Error', patterns: [/file\s+not\s+found|ENOENT|EACCES|permission\s+denied/i] },
  CONFIGURATION: { name: 'Configuration Error', patterns: [/config\s+error|invalid\s+config|missing\s+config/i] },
  DEPENDENCY: { name: 'Dependency Error', patterns: [/module\s+not\s+found|cannot\s+find\s+module|import\s+error/i] },
};

/**
 * 日志分析器类
 */
export class LogAnalyzer {
  constructor() {
    this.logLevels = LOG_LEVELS;
    this.patterns = LOG_PATTERNS;
    this.securityPatterns = SECURITY_PATTERNS;
    this.performancePatterns = PERFORMANCE_PATTERNS;
    this.errorCategories = ERROR_CATEGORIES;
  }

  /**
   * 检测日志格式
   */
  detectLogFormat(content) {
    // 尝试 JSON 格式
    if (LOG_PATTERNS.json.test(content.trim().split('\n')[0])) {
      return 'json';
    }
    
    // 尝试其他格式
    for (const [format, pattern] of Object.entries(LOG_PATTERNS)) {
      if (format === 'json') continue;
      
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      for (const p of patterns) {
        if (p.test(content)) {
          return format;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * 解析日志行
   */
  parseLogLine(line, format) {
    const result = {
      raw: line,
      timestamp: null,
      level: null,
      message: null,
      metadata: {},
    };

    // JSON 格式解析
    if (format === 'json') {
      try {
        const json = JSON.parse(line);
        result.timestamp = json.timestamp || json.time || json.date || null;
        result.level = json.level || json.severity || json.loglevel || null;
        result.message = json.message || json.msg || json.text || null;
        result.metadata = { ...json };
        delete result.metadata.timestamp;
        delete result.metadata.level;
        delete result.metadata.message;
        return result;
      } catch (e) {
        return null;
      }
    }

    // 通用格式解析
    const patterns = LOG_PATTERNS.generic;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        result.timestamp = match[1];
        result.level = match[2]?.toUpperCase() || null;
        result.message = match[3] || match[2] || null;
        return result;
      }
    }

    // 如果无法解析，返回原始行
    result.message = line;
    return result;
  }

  /**
   * 分析日志文件
   */
  analyzeLogFile(filePath, options = {}) {
    const {
      maxLines = 10000,
      startDate = null,
      endDate = null,
      levels = null,
    } = options;

    if (!existsSync(filePath)) {
      throw new Error(`Log file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const format = this.detectLogFormat(content);

    const results = {
      filePath,
      format,
      totalLines: lines.length,
      parsedLines: 0,
      entries: [],
      summary: {},
      issues: [],
    };

    // 解析日志条目
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      const line = lines[i];
      const parsed = this.parseLogLine(line, format);
      
      if (parsed) {
        results.parsedLines++;
        
        // 统计级别
        const level = parsed.level?.toUpperCase();
        if (level) {
          if (level.includes('ERROR') || level.includes('FATAL') || level.includes('CRITICAL')) {
            errorCount++;
          } else if (level.includes('WARN')) {
            warnCount++;
          } else if (level.includes('INFO')) {
            infoCount++;
          } else if (level.includes('DEBUG') || level.includes('TRACE')) {
            debugCount++;
          }
        }

        // 检测安全问题
        const securityIssues = this.detectSecurityIssues(parsed.message || line);
        if (securityIssues.length > 0) {
          results.issues.push({
            type: 'security',
            line: i + 1,
            timestamp: parsed.timestamp,
            issues: securityIssues,
            message: parsed.message || line,
          });
        }

        // 检测性能问题
        const performanceIssues = this.detectPerformanceIssues(parsed.message || line);
        if (performanceIssues.length > 0) {
          results.issues.push({
            type: 'performance',
            line: i + 1,
            timestamp: parsed.timestamp,
            issues: performanceIssues,
            message: parsed.message || line,
          });
        }

        // 分类错误
        if (level && (level.includes('ERROR') || level.includes('FATAL'))) {
          const category = this.categorizeError(parsed.message || line);
          results.entries.push({
            ...parsed,
            line: i + 1,
            errorCategory: category,
          });
        }
      }
    }

    results.summary = {
      byLevel: {
        error: errorCount,
        warn: warnCount,
        info: infoCount,
        debug: debugCount,
      },
      totalIssues: results.issues.length,
      byType: {
        security: results.issues.filter(i => i.type === 'security').length,
        performance: results.issues.filter(i => i.type === 'performance').length,
        error: results.issues.filter(i => i.type === 'error').length,
      },
      parseRate: results.parsedLines / Math.min(lines.length, maxLines),
    };

    return results;
  }

  /**
   * 检测安全事件
   */
  detectSecurityIssues(message) {
    const issues = [];
    
    for (const { name, pattern } of this.securityPatterns) {
      if (pattern.test(message)) {
        issues.push({
          name,
          severity: 'error',
          category: 'security',
          pattern: pattern.source,
        });
      }
    }
    
    return issues;
  }

  /**
   * 检测性能问题
   */
  detectPerformanceIssues(message) {
    const issues = [];
    
    for (const { name, pattern } of this.performancePatterns) {
      if (pattern.test(message)) {
        issues.push({
          name,
          severity: 'warning',
          category: 'performance',
          pattern: pattern.source,
        });
      }
    }
    
    return issues;
  }

  /**
   * 分类错误
   */
  categorizeError(message) {
    for (const [category, { name, patterns }] of Object.entries(this.errorCategories)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return { code: category, name };
        }
      }
    }
    
    return { code: 'UNKNOWN', name: 'Unknown Error' };
  }

  /**
   * 分析目录中的日志文件
   */
  analyzeLogDirectory(dirPath, options = {}) {
    const results = {
      directory: dirPath,
      files: [],
      summary: {},
      aggregatedIssues: [],
    };

    if (!existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = readdirSync(dirPath)
      .filter(f => f.endsWith('.log') || f.includes('log'))
      .map(f => join(dirPath, f));

    for (const file of files) {
      try {
        const fileResult = this.analyzeLogFile(file, options);
        results.files.push(fileResult);
        results.aggregatedIssues.push(...fileResult.issues);
      } catch (error) {
        results.files.push({
          filePath: file,
          error: error.message,
        });
      }
    }

    // 汇总统计
    const totalLines = results.files.reduce((sum, f) => sum + (f.totalLines || 0), 0);
    const totalParsed = results.files.reduce((sum, f) => sum + (f.parsedLines || 0), 0);
    const totalIssues = results.aggregatedIssues.length;

    results.summary = {
      totalFiles: files.length,
      successfulFiles: results.files.filter(f => !f.error).length,
      totalLines,
      totalParsed,
      totalIssues,
      byType: {
        security: results.aggregatedIssues.filter(i => i.type === 'security').length,
        performance: results.aggregatedIssues.filter(i => i.type === 'performance').length,
      },
    };

    return results;
  }

  /**
   * 生成日志分析报告
   */
  generateReport(analysisResults) {
    const report = {
      ...analysisResults,
      timestamp: new Date().toISOString(),
      recommendations: [],
    };

    // 生成建议
    if (analysisResults.summary?.byLevel?.error > 0) {
      report.recommendations.push({
        priority: 'high',
        category: 'errors',
        description: `Found ${analysisResults.summary.byLevel.error} error entries. Review and address critical errors.`,
      });
    }

    const securityCount = analysisResults.summary?.byType?.security || 0;
    if (securityCount > 0) {
      report.recommendations.push({
        priority: 'critical',
        category: 'security',
        description: `Found ${securityCount} security-related log entries. Investigate immediately.`,
      });
    }

    const perfCount = analysisResults.summary?.byType?.performance || 0;
    if (perfCount > 0) {
      report.recommendations.push({
        priority: 'medium',
        category: 'performance',
        description: `Found ${perfCount} performance-related log entries. Consider optimization.`,
      });
    }

    if (analysisResults.summary?.parseRate < 0.5) {
      report.recommendations.push({
        priority: 'low',
        category: 'format',
        description: 'Low log parse rate. Consider using a standardized log format.',
      });
    }

    return report;
  }

  /**
   * 获取支持的日志格式
   */
  getSupportedFormats() {
    return {
      detected: Object.keys(LOG_PATTERNS),
      levels: Object.keys(LOG_LEVELS),
      securityPatterns: this.securityPatterns.map(p => p.name),
      performancePatterns: this.performancePatterns.map(p => p.name),
      errorCategories: Object.entries(this.errorCategories).map(([code, { name }]) => ({ code, name })),
    };
  }
}

/**
 * 生成日志分析报告
 */
export function generateLogAnalysisReport(results) {
  const analyzer = new LogAnalyzer();
  return analyzer.generateReport(results);
}

export { LOG_LEVELS, LOG_PATTERNS, SECURITY_PATTERNS, PERFORMANCE_PATTERNS, ERROR_CATEGORIES };

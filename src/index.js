#!/usr/bin/env node
/**
 * 静态代码分析 MCP 服务器
 * Static Code Analysis MCP Server
 * 
 * 这是一个符合 Model Context Protocol (MCP) 协议的服务器
 * 提供多语言静态代码分析功能
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { analyzeFile, analyzeFiles, detectLanguage, analyzeComplexity, SEVERITY, CATEGORY, getAnalyzer } from './analyzer.js';
import { analyzeSecurity, getSecurityRules } from './security.js';
import { generateComplexityReport } from './complexity.js';
import { analyzeSecurityComprehensive, getAllSecurityRules, BanditStyleAnalyzer, ESLintSecurityAnalyzer, SonarStyleAnalyzer, SemgrepStyleAnalyzer } from './enhanced-analyzer.js';
import { 
  CodeReviewAnalyzer, 
  generateCodeReviewReport, 
  SUPPORTED_LANGUAGES_EXTENDED,
  detectLanguageExtended 
} from './code-review.js';
import {
  DependencyAnalyzer,
  generateDependencyReport,
  VULNERABILITY_DATABASE,
  LICENSE_RISKS,
} from './dependency-check.js';
import {
  PackageInstallerChecker,
  generatePackageCheckReport,
  PACKAGE_MANAGERS,
} from './package-checker.js';
import {
  LogAnalyzer,
  generateLogAnalysisReport,
  LOG_PATTERNS,
  SECURITY_PATTERNS,
  PERFORMANCE_PATTERNS,
} from './log-analyzer.js';
import { analyzeProject as analyzeProjectNative } from './project-analyzer.js';
import { diagnoseProjectEnvironment } from './toolchain-doctor.js';
import { glob, globIterate } from 'glob';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { PathValidator, CacheManager, ErrorHandler, Logger, safeJsonStringify } from './security-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

function resolveWorkspaceRoot() {
  if (process.env.STATIC_ANALYSIS_MCP_DISABLE_OPTIONAL_PYTHON_TOOLS === '1') {
    return resolve(PROJECT_ROOT, '__disabled_tools__');
  }

  const override = process.env.STATIC_ANALYSIS_MCP_WORKSPACE_ROOT;
  if (override) {
    const resolvedOverride = resolve(override);
    if (existsSync(join(resolvedOverride, 'STATIC_ANALYSIS_TOOLS')) || existsSync(join(resolvedOverride, 'scripts'))) {
      return resolvedOverride;
    }
  }

  const candidates = [PROJECT_ROOT];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'STATIC_ANALYSIS_TOOLS')) || existsSync(join(candidate, 'scripts'))) {
      return candidate;
    }
  }
  return PROJECT_ROOT;
}

// Python tooling root: prefer local project assets. External workspace use must be explicit.
const PYTHON_ROOT = resolveWorkspaceRoot();
const PYTHON_TOOLS_DIR = join(PYTHON_ROOT, 'STATIC_ANALYSIS_TOOLS');
const PYTHON_SCRIPTS_DIR = join(PYTHON_ROOT, 'scripts');
const PYTHON_EXE = process.platform === 'win32' ? 'python' : 'python3';

const OPTIONAL_PYTHON_TOOL_SCRIPTS = {
  start_team_dashboard: join(PYTHON_TOOLS_DIR, 'team_dashboard.py'),
  auto_fix: join(PYTHON_TOOLS_DIR, 'batch_auto_fix.py'),
  multi_model_fix: join(PYTHON_TOOLS_DIR, 'multi_model_fixer.py'),
  supply_chain_scan: join(PYTHON_TOOLS_DIR, 'supply_chain_scanner.py'),
  create_baseline: join(PYTHON_TOOLS_DIR, 'baseline_manager.py'),
  compare_baseline: join(PYTHON_TOOLS_DIR, 'baseline_manager.py'),
  incremental_scan: join(PYTHON_TOOLS_DIR, 'incremental_analyzer.py'),
  ai_fix_suggestion: join(PYTHON_TOOLS_DIR, 'ai_fix_suggestion.py'),
  predict_risks: join(PYTHON_TOOLS_DIR, 'predictive_analytics.py'),
  github_review_pr: join(PYTHON_TOOLS_DIR, 'github_pr_reviewer.py'),
  send_slack_notification: join(PYTHON_TOOLS_DIR, 'slack_integration.py'),
  export_sarif: join(PYTHON_TOOLS_DIR, 'sarif_export.py'),
  start_web_dashboard: join(PYTHON_TOOLS_DIR, 'web_dashboard.py'),
  deep_security_scan: join(PYTHON_TOOLS_DIR, 'deep_security_scan.py'),
};

function isOptionalPythonToolAvailable(toolName) {
  const requiredScript = OPTIONAL_PYTHON_TOOL_SCRIPTS[toolName];
  return requiredScript ? existsSync(requiredScript) : true;
}

function assertOptionalPythonToolAvailable(toolName) {
  if (isOptionalPythonToolAvailable(toolName)) {
    return;
  }

  throw new Error(
    `Tool '${toolName}' requires optional Python support scripts that are not present in this checkout. ` +
    `Set STATIC_ANALYSIS_MCP_WORKSPACE_ROOT to a workspace that contains STATIC_ANALYSIS_TOOLS/scripts, or use the native analysis tools instead.`
  );
}

function buildNativeVerificationReport(projectPath = process.cwd()) {
  const toolchain = diagnoseProjectEnvironment(projectPath);
  return {
    mode: 'native-fallback',
    projectPath: toolchain.projectPath,
    manifests: toolchain.manifests,
    packageManager: toolchain.packageManager,
    runtimes: toolchain.runtimes,
    issues: toolchain.issues,
    warnings: toolchain.warnings,
    suggestions: toolchain.suggestions,
    status: toolchain.status,
  };
}

/**
 * 执行 Python 脚本并返回输出
 */
async function executePythonScript(scriptPath, args = [], options = {}) {
  const { cwd = PYTHON_ROOT, timeout = 60000 } = options;
  
  return await new Promise((resolvePromise, rejectPromise) => {
    const renderedArgs = [scriptPath, ...args.map(arg => String(arg))];
    logger.debug(`Executing Python command`, { command: PYTHON_EXE, args: renderedArgs });

    const child = spawn(PYTHON_EXE, renderedArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timer);
      logger.error(`Python script execution failed`, {
        script: basename(scriptPath),
        error: error.message,
      });
      rejectPromise(new Error(`Execution failed: ${error.message}`));
    });

    child.on('close', code => {
      clearTimeout(timer);

      if (timedOut) {
        rejectPromise(new Error(`Execution timed out after ${timeout}ms`));
        return;
      }

      if (stderr.trim()) {
        logger.warn(`Python script produced stderr`, { script: basename(scriptPath), stderr: stderr.trim() });
      }

      if (code !== 0) {
        logger.error(`Python script execution failed`, {
          script: basename(scriptPath),
          code,
          stderr: stderr.trim(),
        });
        rejectPromise(new Error(`Execution failed with exit code ${code}\n${stderr.trim()}`.trim()));
        return;
      }

      resolvePromise(stdout);
    });
  });
}

// 初始化路径验证器和缓存管理器
const pathValidator = new PathValidator(resolve(process.cwd(), '..'));
const cacheManager = new CacheManager({
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 1000, // 最多1000条缓存
  version: 1,
  cleanupInterval: 1 * 60 * 1000, // 1分钟清理一次
});
const logger = new Logger(process.env.LOG_LEVEL || 'info');

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  ...SUPPORTED_LANGUAGES_EXTENDED,
  'javascript', 'typescript', 'python', 'java', 'go', 'rust',
  'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
  'scala', 'r', 'julia', 'lua', 'shell', 'sql', 'html',
  'css', 'yaml', 'json', 'xml', 'markdown', 'dart', 'elixir'
];

// 创建 MCP 服务器
function createServer() {
const server = new Server(
  {
    name: 'static-analysis-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * 获取文件修改时间
 */
function getFileMtime(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * 分析目录
 * P2-1: 改进使用流式 glob 处理大型目录，避免在切片前加载所有文件
 */
async function analyzeDirectory(directoryPath, options = {}) {
  const {
    extensions = null,
    excludePatterns = ['node_modules', 'dist', 'build', '.git', 'vendor'],
    maxFiles = 100,
  } = options;

  const files = [];
  
  try {
    // 检查目录是否存在
    if (!existsSync(directoryPath)) {
      logger.error(`Directory not found: ${directoryPath}`);
      throw new Error(`Directory not found: ${directoryPath}`);
    }

    const pattern = extensions 
      ? `{${extensions.map(e => e.startsWith('.') ? `**/*${e}` : `**/*.${e}`).join(',')}}`
      : '**/*';
    
    const ignorePatterns = excludePatterns.map(p => join(directoryPath, p, '**'));
    
    // 流式处理 glob 结果，避免一次性加载所有文件
    const it = globIterate(join(directoryPath, pattern), {
      nodir: true,
      ignore: ignorePatterns,
    });

    for await (const filePath of it) {
      if (files.length >= maxFiles) {
        logger.info(`Reached maxFiles limit: ${maxFiles}`);
        break;
      }

      try {
        const language = detectLanguage(filePath);
        if (language !== 'unknown') {
          files.push(filePath);
        }
      } catch (fileError) {
        logger.warn(`Failed to detect language for file: ${filePath}`, { error: fileError.message });
      }
    }

    logger.info(`Analyzed directory with ${files.length} files`, { directory: directoryPath, maxFiles });
  } catch (error) {
    logger.error(`Error scanning directory: ${error.message}`, { directory: directoryPath });
    throw new Error(`Error scanning directory: ${error.message}`);
  }

  return await analyzeFiles(files);
}

/**
 * 生成分析报告
 */
function generateReport(results, options = {}) {
  const { format = 'summary' } = options;
  
  const totalFiles = results.filter(r => !r.error).length;
  const errorFiles = results.filter(r => r.error).length;
  const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  
  const issuesBySeverity = {
    [SEVERITY.ERROR]: 0,
    [SEVERITY.WARNING]: 0,
    [SEVERITY.INFO]: 0,
    [SEVERITY.HINT]: 0,
  };
  
  const issuesByCategory = {};
  const issuesByLanguage = {};
  const rulesViolated = new Map();

  results.forEach(result => {
    if (result.issues) {
      // 按语言统计
      if (!issuesByLanguage[result.language]) {
        issuesByLanguage[result.language] = 0;
      }
      issuesByLanguage[result.language] += result.issues.length;

      result.issues.forEach(issue => {
        // 按严重性统计
        issuesBySeverity[issue.severity]++;
        
        // 按类别统计
        if (!issuesByCategory[issue.category]) {
          issuesByCategory[issue.category] = 0;
        }
        issuesByCategory[issue.category]++;
        
        // 按规则统计
        const count = rulesViolated.get(issue.rule) || 0;
        rulesViolated.set(issue.rule, count + 1);
      });
    }
  });

  const report = {
    summary: {
      totalFiles,
      errorFiles,
      totalIssues,
      issuesBySeverity,
      issuesByCategory,
      issuesByLanguage,
      rulesViolated: Object.fromEntries(rulesViolated),
    },
    results,
    timestamp: new Date().toISOString(),
  };

  return report;
}

/**
 * 获取规则列表
 */
function getAllRules() {
  const rules = {};
  rules.generic = [
    { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
    { name: 'max-line-length', description: 'Enforce maximum line length', severity: SEVERITY.HINT },
    { name: 'no-multiple-blank-lines', description: 'Disallow multiple consecutive blank lines', severity: SEVERITY.HINT },
  ];

  return rules;
}

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_file',
        description: '分析单个源代码文件的代码质量问题、风格问题和潜在错误',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件的绝对路径或相对路径',
            },
            useCache: {
              type: 'boolean',
              description: '是否使用缓存结果（默认：true）',
              default: true,
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'analyze_files',
        description: '分析多个源代码文件',
        inputSchema: {
          type: 'object',
          properties: {
            filePaths: {
              type: 'array',
              items: { type: 'string' },
              description: '要分析的文件路径列表',
            },
          },
          required: ['filePaths'],
        },
      },
      {
        name: 'analyze_directory',
        description: '分析整个目录下的所有源代码文件',
        inputSchema: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: '要分析的目录路径',
            },
            extensions: {
              type: 'array',
              items: { type: 'string' },
              description: '要分析的文件扩展名列表（如 [".js", ".ts", ".py"]）',
            },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: '要排除的目录模式（默认：["node_modules", "dist", "build", ".git", "vendor"]）',
            },
            maxFiles: {
              type: 'number',
              description: '最大分析文件数（默认：100）',
              default: 100,
            },
          },
          required: ['directoryPath'],
        },
      },
      {
        name: 'analyze_code_snippet',
        description: '分析代码片段的质量问题',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '要分析的代码内容',
            },
            language: {
              type: 'string',
              description: '代码的编程语言',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: ['code', 'language'],
        },
      },
      {
        name: 'get_complexity_metrics',
        description: '获取文件或代码的复杂度指标（圈复杂度、代码行数等）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_supported_rules',
        description: '获取所有支持的代码分析规则列表',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              description: '可选，仅获取特定语言的规则',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_supported_languages',
        description: '获取所有支持的编程语言列表',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate_report',
        description: '生成代码分析报告（支持摘要和详细格式）',
        inputSchema: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: '要分析的目录路径',
            },
            extensions: {
              type: 'array',
              items: { type: 'string' },
              description: '要分析的文件扩展名列表',
            },
            format: {
              type: 'string',
              description: '报告格式（summary 或 detailed）',
              enum: ['summary', 'detailed'],
              default: 'summary',
            },
          },
          required: ['directoryPath'],
        },
      },
      {
        name: 'detect_language',
        description: '根据文件扩展名检测编程语言',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '文件路径',
            },
            extension: {
              type: 'string',
              description: '或者直接提供文件扩展名（如 ".js"）',
            },
          },
          required: [],
        },
      },
      {
        name: 'clear_cache',
        description: '清除分析结果缓存',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'analyze_security',
        description: '分析代码中的安全漏洞（SQL 注入、XSS、命令注入、硬编码凭证等）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_security_rules',
        description: '获取所有支持的安全检测规则列表',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'analyze_complexity',
        description: '生成详细的代码复杂度分析报告（包含圈复杂度、认知复杂度、Halstead 指标等）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'compare_complexity',
        description: '比较多个文件的复杂度指标',
        inputSchema: {
          type: 'object',
          properties: {
            filePaths: {
              type: 'array',
              items: { type: 'string' },
              description: '要比较的文件路径列表',
            },
          },
          required: ['filePaths'],
        },
      },
      {
        name: 'analyze_security_comprehensive',
        description: '综合安全分析（整合 Bandit、ESLint-plugin-security、SonarQube、Semgrep 等工具的功能）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_all_security_rules',
        description: '获取所有安全分析规则（包括 Bandit、ESLint、SonarQube、Semgrep 风格）',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'analyze_code_smells',
        description: '分析代码异味（SonarQube 风格）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'analyze_bandit',
        description: 'Python 安全分析（Bandit 风格）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
          },
          required: [],
        },
      },
      {
        name: 'analyze_eslint_security',
        description: 'JavaScript 安全分析（ESLint-plugin-security 风格）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
          },
          required: [],
        },
      },
      {
        name: 'analyze_semgrep',
        description: '多语言安全分析（Semgrep 风格）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'code_review',
        description: 'CodeRabbit 风格的代码审查（检测错误、逻辑问题、最佳实践，提供修复建议）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要审查的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
            includeSuggestions: {
              type: 'boolean',
              description: '是否包含修复建议（默认：true）',
              default: true,
            },
          },
          required: [],
        },
      },
      {
        name: 'detect_errors',
        description: '检测代码中的错误（语法错误、逻辑错误、类型错误等）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '要分析的文件路径',
            },
            code: {
              type: 'string',
              description: '或者直接提供代码内容',
            },
            language: {
              type: 'string',
              description: '编程语言（当提供 code 参数时需要）',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_review_rules',
        description: '获取所有代码审查规则列表',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              description: '可选，仅获取特定语言的规则',
              enum: SUPPORTED_LANGUAGES,
            },
          },
          required: [],
        },
      },
      {
        name: 'get_supported_languages_extended',
        description: '获取所有支持的编程语言列表（50+ 种语言）',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'check_dependencies',
        description: '检查项目依赖漏洞、过时版本、许可证问题（类似 npm audit、pip-audit）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目根目录路径（包含 package.json、requirements.txt 或 pom.xml）',
            },
            includeDevDependencies: {
              type: 'boolean',
              description: '是否包含开发依赖（默认：true）',
              default: true,
            },
            checkVulnerabilities: {
              type: 'boolean',
              description: '是否检查漏洞（默认：true）',
              default: true,
            },
            checkOutdated: {
              type: 'boolean',
              description: '是否检查过时版本（默认：true）',
              default: true,
            },
            checkLicenses: {
              type: 'boolean',
              description: '是否检查许可证风险（默认：true）',
              default: true,
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'get_dependency_fix_suggestions',
        description: '获取依赖修复建议和命令',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目根目录路径',
            },
            severity: {
              type: 'string',
              description: '仅获取特定严重性的建议',
              enum: ['error', 'warning', 'hint', 'all'],
              default: 'all',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'get_supported_dependency_checks',
        description: '获取支持的依赖检查类型列表',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'check_package_installation',
        description: '检查依赖包是否已安装（支持 npm, pip, maven, cargo, go 等）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目根目录路径',
            },
            packageManager: {
              type: 'string',
              description: '包管理器名称（auto, npm, yarn, pip, maven, cargo, go 等）',
              default: 'auto',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'get_package_managers',
        description: '获取支持的包管理器列表',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'analyze_log_file',
        description: '分析日志文件（检测错误、安全事件、性能问题）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '日志文件路径',
            },
            maxLines: {
              type: 'number',
              description: '最大分析行数（默认：10000）',
              default: 10000,
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'analyze_log_directory',
        description: '分析目录中的所有日志文件',
        inputSchema: {
          type: 'object',
          properties: {
            directoryPath: {
              type: 'string',
              description: '日志目录路径',
            },
            maxLines: {
              type: 'number',
              description: '每个文件最大分析行数（默认：10000）',
              default: 10000,
            },
          },
          required: ['directoryPath'],
        },
      },
      {
        name: 'get_log_patterns',
        description: '获取支持的日志模式和安全检测规则',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'incremental_scan',
        description: '增量分析项目（仅分析变更的文件，基于 Python 引擎）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
          },
          required: [],
        },
      },
      {
        name: 'ai_fix_suggestion',
        description: '使用 AI 生成代码修复建议（基于 Python 引擎和 LLM）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '文件路径',
            },
            ruleId: {
              type: 'string',
              description: '违反的规则 ID',
            },
            line: {
              type: 'number',
              description: '行号',
            },
          },
          required: ['filePath', 'ruleId', 'line'],
        },
      },
      {
        name: 'predict_risks',
        description: '预测项目潜在风险和技术债务（基于 Python 引擎）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
          },
          required: [],
        },
      },
      {
        name: 'github_review_pr',
        description: '在 GitHub PR 中执行自动化代码审查',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: '仓库名称 (owner/repo)',
            },
            prNumber: {
              type: 'number',
              description: 'PR 编号',
            },
          },
          required: ['repo', 'prNumber'],
        },
      },
      {
        name: 'send_slack_notification',
        description: '将分析结果发送到 Slack',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: '消息内容',
            },
            channel: {
              type: 'string',
              description: 'Slack 频道（默认：#security）',
              default: '#security',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'export_sarif',
        description: '将分析结果导出为 SARIF 标准格式',
        inputSchema: {
          type: 'object',
          properties: {
            inputFile: {
              type: 'string',
              description: '输入的 JSON 结果文件',
            },
            outputFile: {
              type: 'string',
              description: '输出的 SARIF 文件（默认：results.sarif）',
              default: 'results.sarif',
            },
          },
          required: ['inputFile'],
        },
      },
      {
        name: 'start_team_dashboard',
        description: '启动团队协作分析看板（多用户支持）',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: '端口号（默认：8081）',
              default: 8081,
            },
          },
          required: [],
        },
      },
      {
        name: 'scan_project',
        description: '扫描项目代码安全问题（并行扫描，基于 Python 引擎）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
            workers: {
              type: 'number',
              description: '工作进程数（默认：8）',
              default: 8,
            },
          },
          required: [],
        },
      },
      {
        name: 'auto_fix',
        description: '自动修复代码问题',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
            apply: {
              type: 'boolean',
              description: '是否实际应用修复（默认：false，即干跑模式）',
              default: false,
            },
          },
          required: [],
        },
      },
      {
        name: 'multi_model_fix',
        description: '使用多种 LLM 模型对比并修复代码',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '文件路径',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'check_code_quality',
        description: '检查代码质量指标（深入分析）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
          },
          required: [],
        },
      },
      {
        name: 'supply_chain_scan',
        description: '依赖供应链安全检查',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '依赖文件路径（如 requirements.txt）',
              default: 'requirements.txt',
            },
          },
          required: [],
        },
      },
      {
        name: 'create_baseline',
        description: '创建质量基线',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '基线名称',
            },
            inputFile: {
              type: 'string',
              description: '输入的 JSON 结果文件',
            },
          },
          required: ['name', 'inputFile'],
        },
      },
      {
        name: 'compare_baseline',
        description: '对比当前结果与基线',
        inputSchema: {
          type: 'object',
          properties: {
            baselineName: {
              type: 'string',
              description: '基线名称',
            },
            inputFile: {
              type: 'string',
              description: '输入的 JSON 结果文件',
            },
          },
          required: ['baselineName', 'inputFile'],
        },
      },
      {
        name: 'verify_installation',
        description: '验证所有静态分析工具和 MCP 接口是否正常工作',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'analyze_project',
        description: '原生项目级代码分析，聚合文件问题、TS/JS 编译诊断、依赖与安装状态和热点文件',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
            maxFiles: {
              type: 'number',
              description: '最大分析文件数（默认：200）',
              default: 200,
            },
            extensions: {
              type: 'array',
              items: { type: 'string' },
              description: '限制分析的扩展名，如 [".js", ".ts", ".py"]',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'start_web_dashboard',
        description: '启动 Web 交互式仪表盘',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: '端口号（默认：8080）',
              default: 8080,
            },
          },
          required: [],
        },
      },
      {
        name: 'deep_security_scan',
        description: '执行深度安全扫描并生成报告（基于 Python 引擎）',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: '项目路径',
              default: '.',
            },
            output: {
              type: 'string',
              description: '输出报告文件名（默认：security_report.md）',
              default: 'security_report.md',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_help',
        description: '获取详细的工具说明和使用示例',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ].filter(tool => isOptionalPythonToolAvailable(tool.name)),
  };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_file': {
        const { filePath, useCache = true } = args;

        // P0-FIX: 路径遍历漏洞 - 验证路径安全性
        let absolutePath;
        try {
          absolutePath = pathValidator.validateFilePath(filePath, {
            allowSymlinks: false,
            allowDirectories: false,
            checkExists: true,
          });
          logger.debug(`Path validation passed`, { filePath, absolutePath });
        } catch (pathError) {
          logger.error(`Security: Invalid file path`, {
            filePath,
            reason: pathError.message,
          });
          return ErrorHandler.createErrorResponse(pathError, 'invalid_path');
        }

        // P0-FIX: 缓存竞态条件 - 使用原子性缓存检查
        const mtime = getFileMtime(absolutePath);
        const cacheOptions = { fileMtime: mtime };

        if (useCache) {
          const cachedResult = cacheManager.get(absolutePath, cacheOptions);
          if (cachedResult) {
            logger.debug(`Cache hit`, { filePath: absolutePath });
            return {
              content: [
                {
                  type: 'text',
                  text: safeJsonStringify(cachedResult),
                },
              ],
            };
          }
        }

        logger.debug(`Analyzing file`, { filePath: absolutePath });
        const result = await analyzeFile(absolutePath);

        // 缓存结果
        if (useCache) {
          cacheManager.set(absolutePath, result, cacheOptions);
        }

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(result),
            },
          ],
        };
      }

      case 'analyze_files': {
        const { filePaths } = args;

        // P0-FIX: 验证所有文件路径
        const absolutePaths = [];
        const validationErrors = [];

        for (let i = 0; i < filePaths.length; i++) {
          try {
            const path = pathValidator.validateFilePath(filePaths[i], {
              allowSymlinks: false,
              allowDirectories: false,
              checkExists: true,
            });
            absolutePaths.push(path);
          } catch (error) {
            validationErrors.push({
              index: i,
              filePath: filePaths[i],
              error: error.message,
            });
          }
        }

        if (validationErrors.length > 0) {
          logger.warn(`Some file paths failed validation`, {
            totalFiles: filePaths.length,
            validationErrors,
          });
        }

        if (absolutePaths.length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('No valid file paths to analyze'),
            'no_valid_paths'
          );
        }

        const results = await analyzeFiles(absolutePaths);

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(results),
            },
          ],
        };
      }

      case 'analyze_directory': {
        const {
          directoryPath,
          extensions,
          excludePatterns = ['node_modules', 'dist', 'build', '.git', 'vendor'],
          maxFiles = 100,
        } = args;

        // P0-FIX: 验证目录路径
        let absolutePath;
        try {
          absolutePath = pathValidator.validateDirectoryPath(directoryPath, {
            checkExists: true,
          });
          logger.debug(`Directory validation passed`, { directoryPath, absolutePath });
        } catch (pathError) {
          logger.error(`Security: Invalid directory path`, {
            directoryPath,
            reason: pathError.message,
          });
          return ErrorHandler.createErrorResponse(pathError, 'invalid_path');
        }

        const results = await analyzeDirectory(absolutePath, {
          extensions,
          excludePatterns,
          maxFiles,
        });

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(results),
            },
          ],
        };
      }

      case 'analyze_code_snippet': {
        // P0-FIX: 参数验证 - 使用 typeof 检查而不是真值检查
        const { code, language } = args;

        if (typeof code !== 'string') {
          return ErrorHandler.createErrorResponse(
            new Error('code must be a string'),
            'invalid_parameter'
          );
        }

        if (typeof language !== 'string' || language.trim().length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('language must be a non-empty string'),
            'invalid_parameter'
          );
        }

        const { getAnalyzer } = await import('./analyzer.js');
        const analyzer = getAnalyzer(language);
        const tempFile = `snippet_${uuidv4()}.${getFileExtension(language)}`;
        const issues = await analyzer.analyze(code, tempFile);

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                language,
                codeLength: code.length,
                issues,
              }),
            },
          ],
        };
      }

      case 'get_complexity_metrics': {
        const { filePath, code, language } = args;
        
        let codeContent = code;
        let lang = language;
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguage(absolutePath);
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const metrics = analyzeComplexity(codeContent, lang);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(metrics),
            },
          ],
        };
      }

      case 'get_supported_rules': {
        const { language } = args || {};
        
        const { JavaScriptAnalyzer, PythonAnalyzer, JavaAnalyzer, GenericAnalyzer } = await import('./analyzer.js');
        
        const rules = {};
        
        if (!language || language === 'javascript' || language === 'typescript') {
          const jsAnalyzer = new JavaScriptAnalyzer();
          rules.javascript = jsAnalyzer.getSupportedRules();
          rules.typescript = rules.javascript;
        }
        
        if (!language || language === 'python') {
          const pyAnalyzer = new PythonAnalyzer();
          rules.python = pyAnalyzer.getSupportedRules();
        }
        
        if (!language || language === 'java') {
          const javaAnalyzer = new JavaAnalyzer();
          rules.java = javaAnalyzer.getSupportedRules();
        }
        
        if (!language) {
          rules.generic = [
            { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
            { name: 'max-line-length', description: 'Enforce maximum line length', severity: SEVERITY.HINT },
            { name: 'no-multiple-blank-lines', description: 'Disallow multiple consecutive blank lines', severity: SEVERITY.HINT },
          ];
        }

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(rules),
            },
          ],
        };
      }

      case 'get_supported_languages': {
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                languages: SUPPORTED_LANGUAGES,
                count: SUPPORTED_LANGUAGES.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'generate_report': {
        const {
          directoryPath,
          extensions,
          format = 'summary',
        } = args;
        
        const absolutePath = resolve(directoryPath);
        const results = await analyzeDirectory(absolutePath, { extensions });
        const report = generateReport(results, { format });
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(report),
            },
          ],
        };
      }

      case 'detect_language': {
        const { filePath, extension } = args;
        
        let detectedLanguage;
        if (filePath) {
          detectedLanguage = detectLanguage(filePath);
        } else if (extension) {
          const tempPath = `temp${extension}`;
          detectedLanguage = detectLanguage(tempPath);
        } else {
          throw new Error('Either filePath or extension must be provided');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                detectedLanguage,
                isSupported: SUPPORTED_LANGUAGES.includes(detectedLanguage),
              }, null, 2),
            },
          ],
        };
      }

      case 'clear_cache': {
        analysisCache.clear();

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                success: true,
                message: 'Cache cleared successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_security': {
        const { filePath, code, language } = args;

        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';

        if (filePath) {
          // P0-FIX: 路径验证
          let absolutePath;
          try {
            absolutePath = pathValidator.validateFilePath(filePath, {
              allowSymlinks: false,
              allowDirectories: false,
              checkExists: true,
            });
            codeContent = readFileSync(absolutePath, 'utf-8');
            lang = detectLanguage(absolutePath);
            file = absolutePath;
          } catch (error) {
            logger.error(`analyze_security: Path validation failed`, {
              filePath,
              reason: error.message,
            });
            return ErrorHandler.createErrorResponse(error, 'invalid_path');
          }
        }

        // P0-FIX: 参数验证 - 使用 typeof 检查
        if (typeof codeContent !== 'string' || codeContent.length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('code must be a non-empty string'),
            'invalid_parameter'
          );
        }

        if (typeof lang !== 'string' || lang.trim().length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('language must be a non-empty string'),
            'invalid_parameter'
          );
        }

        const issues = await analyzeSecurity(codeContent, file, lang);

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                language: lang,
                filePath: file,
                issues,
                issueCount: issues.length,
              }),
            },
          ],
        };
      }

      case 'get_security_rules': {
        const rules = getSecurityRules();
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                rules,
                totalRules: Object.values(rules).flat().length,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_complexity': {
        const { filePath, code, language } = args;

        let codeContent = code;
        let lang = language;

        if (filePath) {
          // P0-FIX: 路径验证
          let absolutePath;
          try {
            absolutePath = pathValidator.validateFilePath(filePath, {
              allowSymlinks: false,
              allowDirectories: false,
              checkExists: true,
            });
            codeContent = readFileSync(absolutePath, 'utf-8');
            lang = detectLanguage(absolutePath);
          } catch (error) {
            logger.error(`analyze_complexity: Path validation failed`, {
              filePath,
              reason: error.message,
            });
            return ErrorHandler.createErrorResponse(error, 'invalid_path');
          }
        }

        // P0-FIX: 参数验证 - 使用 typeof 检查
        if (typeof codeContent !== 'string' || codeContent.length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('code must be a non-empty string'),
            'invalid_parameter'
          );
        }

        if (typeof lang !== 'string' || lang.trim().length === 0) {
          return ErrorHandler.createErrorResponse(
            new Error('language must be a non-empty string'),
            'invalid_parameter'
          );
        }

        const report = generateComplexityReport(codeContent, lang);

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(report),
            },
          ],
        };
      }

      case 'compare_complexity': {
        const { filePaths } = args;
        const absolutePaths = filePaths.map(p => resolve(p));
        const comparisons = [];

        for (const absolutePath of absolutePaths) {
          try {
            const codeContent = readFileSync(absolutePath, 'utf-8');
            const lang = detectLanguage(absolutePath);
            const report = generateComplexityReport(codeContent, lang);

            comparisons.push({
              filePath: absolutePath,
              language: lang,
              summary: report.summary,
            });
          } catch (error) {
            comparisons.push({
              filePath: absolutePath,
              error: error.message,
            });
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                comparisons,
                count: comparisons.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_security_comprehensive': {
        const { filePath, code, language } = args;
        
        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguage(absolutePath);
          file = absolutePath;
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const issues = await analyzeSecurityComprehensive(codeContent, file, lang);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                language: lang,
                filePath: file,
                issues,
                issueCount: issues.length,
                sources: [...new Set(issues.map(i => i.source))].filter(Boolean),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_all_security_rules': {
        const rules = getAllSecurityRules();
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                rules,
                totalRules: Object.values(rules).flat().length,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_code_smells': {
        const { filePath, code, language } = args;
        
        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguage(absolutePath);
          file = absolutePath;
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const sonarAnalyzer = new SonarStyleAnalyzer();
        const issues = await sonarAnalyzer.analyze(codeContent, file, lang);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                language: lang,
                filePath: file,
                issues,
                issueCount: issues.length,
                source: 'sonarqube',
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_bandit': {
        const { filePath, code } = args;
        
        let codeContent = code;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          file = absolutePath;
        }
        
        if (!codeContent) {
          throw new Error('Either filePath or code must be provided');
        }
        
        const banditAnalyzer = new BanditStyleAnalyzer();
        const issues = await banditAnalyzer.analyze(codeContent, file);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                filePath: file,
                issues,
                issueCount: issues.length,
                source: 'bandit',
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_eslint_security': {
        const { filePath, code } = args;
        
        let codeContent = code;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          file = absolutePath;
        }
        
        if (!codeContent) {
          throw new Error('Either filePath or code must be provided');
        }
        
        const eslintAnalyzer = new ESLintSecurityAnalyzer();
        const issues = await eslintAnalyzer.analyze(codeContent, file);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                filePath: file,
                issues,
                issueCount: issues.length,
                source: 'eslint-plugin-security',
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_semgrep': {
        const { filePath, code, language } = args;
        
        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguage(absolutePath);
          file = absolutePath;
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const semgrepAnalyzer = new SemgrepStyleAnalyzer();
        const issues = await semgrepAnalyzer.analyze(codeContent, file, lang);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                language: lang,
                filePath: file,
                issues,
                issueCount: issues.length,
                source: 'semgrep',
              }, null, 2),
            },
          ],
        };
      }

      case 'code_review': {
        const { filePath, code, language, includeSuggestions = true } = args;
        
        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguageExtended(absolutePath);
          file = absolutePath;
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const analyzer = new CodeReviewAnalyzer();
        const errorIssues = await analyzer.analyzeErrors(codeContent, file, lang);
        const reviewIssues = await analyzer.reviewCode(codeContent, file, lang);
        
        const allIssues = [...errorIssues, ...reviewIssues];
        const report = generateCodeReviewReport(allIssues, codeContent, file);
        
        if (!includeSuggestions) {
          delete report.suggestions;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(report),
            },
          ],
        };
      }

      case 'detect_errors': {
        const { filePath, code, language } = args;
        
        let codeContent = code;
        let lang = language;
        let file = filePath || 'snippet';
        
        if (filePath) {
          const absolutePath = resolve(filePath);
          codeContent = readFileSync(absolutePath, 'utf-8');
          lang = detectLanguageExtended(absolutePath);
          file = absolutePath;
        }
        
        if (!codeContent || !lang) {
          throw new Error('Either filePath or (code and language) must be provided');
        }
        
        const analyzer = new CodeReviewAnalyzer();
        const issues = await analyzer.analyzeErrors(codeContent, file, lang);
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                filePath: file,
                language: lang,
                issues,
                issueCount: issues.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_review_rules': {
        const { language } = args || {};
        
        const analyzer = new CodeReviewAnalyzer();
        const rules = analyzer.getSupportedRules();
        
        let filteredRules = rules;
        if (language) {
          filteredRules = {
            errorDetection: rules.errorDetection,
            codeReview: rules.codeReview,
            languageSpecific: {
              [language]: rules.languageSpecific[language] || [],
            },
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                rules: filteredRules,
                supportedLanguages: SUPPORTED_LANGUAGES_EXTENDED,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_supported_languages_extended': {
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                languages: SUPPORTED_LANGUAGES_EXTENDED,
                count: SUPPORTED_LANGUAGES_EXTENDED.length,
                categories: {
                  web: ['javascript', 'typescript', 'html', 'css', 'scss', 'less', 'sass', 'vue', 'svelte'],
                  backend: ['python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'ruby'],
                  mobile: ['swift', 'kotlin', 'dart', 'objective-c'],
                  functional: ['haskell', 'ocaml', 'fsharp', 'clojure', 'elixir', 'erlang', 'elm'],
                  scripting: ['shell', 'bash', 'zsh', 'powershell', 'lua', 'perl', 'r'],
                  data: ['sql', 'graphql', 'json', 'yaml', 'toml', 'xml'],
                  systems: ['c', 'cpp', 'rust', 'go', 'assembly', 'zig', 'nim'],
                  jvm: ['java', 'kotlin', 'scala', 'groovy'],
                  dotnet: ['csharp', 'fsharp', 'vb'],
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'check_dependencies': {
        const {
          projectPath,
          includeDevDependencies = true,
          checkVulnerabilities = true,
          checkOutdated = true,
          checkLicenses = true,
        } = args;
        
        const absolutePath = resolve(projectPath);
        const analyzer = new DependencyAnalyzer();
        
        try {
          const results = await analyzer.analyzeProject(absolutePath);
          
          // 过滤结果
          if (!includeDevDependencies) {
            // 未来可以实现
          }
          
          const report = generateDependencyReport(results);
          
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify(report),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  error: error.message,
                  projectPath: absolutePath,
                  supportedFiles: ['package.json', 'requirements.txt', 'pom.xml'],
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      case 'get_dependency_fix_suggestions': {
        const { projectPath, severity = 'all' } = args;
        const absolutePath = resolve(projectPath);
        const analyzer = new DependencyAnalyzer();
        
        try {
          const results = await analyzer.analyzeProject(absolutePath);
          const suggestions = analyzer.generateFixSuggestions(results.issues);
          
          // 按严重性过滤
          let filteredSuggestions = suggestions;
          if (severity !== 'all') {
            filteredSuggestions = suggestions.filter(s => 
              s.severity.toLowerCase() === severity.toLowerCase()
            );
          }
          
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  projectPath: absolutePath,
                  suggestions: filteredSuggestions,
                  count: filteredSuggestions.length,
                  totalIssues: results.issues.length,
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  error: error.message,
                  projectPath: absolutePath,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      case 'get_supported_dependency_checks': {
        const analyzer = new DependencyAnalyzer();
        const checks = analyzer.getSupportedChecks();

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                checks,
                supportedLanguages: Object.keys(VULNERABILITY_DATABASE),
                licenseRisks: LICENSE_RISKS,
              }, null, 2),
            },
          ],
        };
      }

      case 'check_package_installation': {
        const { projectPath, packageManager = 'auto' } = args;
        const absolutePath = resolve(projectPath);
        const checker = new PackageInstallerChecker();
        
        try {
          const results = checker.checkPackagesInstalled(absolutePath, packageManager);
          const report = generatePackageCheckReport(results);
          
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify(report),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  error: error.message,
                  projectPath: absolutePath,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      case 'get_package_managers': {
        const checker = new PackageInstallerChecker();
        const managers = checker.getSupportedManagers();
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                packageManagers: managers,
                count: managers.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_log_file': {
        const { filePath, maxLines = 10000 } = args;
        const absolutePath = resolve(filePath);
        const analyzer = new LogAnalyzer();
        
        try {
          const results = analyzer.analyzeLogFile(absolutePath, { maxLines });
          const report = generateLogAnalysisReport(results);
          
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify(report),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  error: error.message,
                  stack: error.stack,
                  filePath: absolutePath,
                  context: 'analyze_log_file',
                }),
              },
            ],
            isError: true,
          };
        }
      }

      case 'analyze_log_directory': {
        const { directoryPath, maxLines = 10000 } = args;
        const absolutePath = resolve(directoryPath);
        const analyzer = new LogAnalyzer();
        
        try {
          const results = analyzer.analyzeLogDirectory(absolutePath, { maxLines });
          const report = generateLogAnalysisReport(results);
          
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify(report),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify({
                  error: error.message,
                  stack: error.stack,
                  directoryPath: absolutePath,
                  context: 'analyze_log_directory',
                }),
              },
            ],
            isError: true,
          };
        }
      }

      case 'get_log_patterns': {
        const analyzer = new LogAnalyzer();
        const patterns = analyzer.getSupportedFormats();
        
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify({
                patterns,
                securityPatterns: SECURITY_PATTERNS.map(p => p.name),
                performancePatterns: PERFORMANCE_PATTERNS.map(p => p.name),
              }, null, 2),
            },
          ],
        };
      }

      case 'incremental_scan': {
        assertOptionalPythonToolAvailable(name);
        const { projectPath = '.' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'incremental_analyzer.py');
        const output = await executePythonScript(scriptPath, ['--project', projectPath]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'ai_fix_suggestion': {
        assertOptionalPythonToolAvailable(name);
        const { filePath, ruleId, line } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'ai_fix_suggestion.py');
        const output = await executePythonScript(scriptPath, [
          '--file', filePath,
          '--rule', ruleId,
          '--line', line.toString()
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'predict_risks': {
        assertOptionalPythonToolAvailable(name);
        const { projectPath = '.' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'predictive_analytics.py');
        const output = await executePythonScript(scriptPath, ['--project', projectPath]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'github_review_pr': {
        assertOptionalPythonToolAvailable(name);
        const { repo, prNumber } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'github_pr_reviewer.py');
        const output = await executePythonScript(scriptPath, [
          '--repo', repo,
          '--pr', prNumber.toString()
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'send_slack_notification': {
        assertOptionalPythonToolAvailable(name);
        const { message, channel = '#security' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'slack_integration.py');
        const output = await executePythonScript(scriptPath, [
          '--message', message,
          '--channel', channel
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'export_sarif': {
        assertOptionalPythonToolAvailable(name);
        const { inputFile, outputFile = 'results.sarif' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'sarif_export.py');
        const output = await executePythonScript(scriptPath, [
          '--input', inputFile,
          '--output', outputFile
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'start_team_dashboard': {
        assertOptionalPythonToolAvailable(name);
        const { port = 8081 } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'team_dashboard.py');
        
        // 使用 spawn 启动后台进程
        const child = spawn(PYTHON_EXE, [scriptPath, '--port', port.toString()], { 
          cwd: PYTHON_ROOT,
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        
        return {
          content: [{ type: 'text', text: `👥 团队仪表盘已在后台启动：http://localhost:${port}` }],
        };
      }

      case 'scan_project': {
        const { projectPath = '.', workers = 8 } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'parallel_scanner.py');
        try {
          const output = await executePythonScript(scriptPath, [
            projectPath,
            '-w', workers.toString()
          ], { timeout: 300000 }); // 给扫描更多时间
          
          return {
            content: [{ type: 'text', text: output }],
          };
        } catch (error) {
          const fallback = await analyzeProjectNative(projectPath, { maxFiles: 300 });
          return {
            content: [{
              type: 'text',
              text: safeJsonStringify({
                mode: 'native-fallback',
                reason: error.message,
                analysis: fallback,
              }),
            }],
          };
        }
      }

      case 'auto_fix': {
        assertOptionalPythonToolAvailable(name);
        const { projectPath = '.', apply = false } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'batch_auto_fix.py');
        const pythonArgs = ['--project', projectPath];
        if (apply) {
          pythonArgs.push('--apply');
        } else {
          pythonArgs.push('--dry-run');
        }
        
        const output = await executePythonScript(scriptPath, pythonArgs);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'multi_model_fix': {
        assertOptionalPythonToolAvailable(name);
        const { filePath } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'multi_model_fixer.py');
        const output = await executePythonScript(scriptPath, ['--file', filePath]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'check_code_quality': {
        const { projectPath = '.' } = args;
        const scriptPath = join(PYTHON_SCRIPTS_DIR, 'deep_code_check.py');
        try {
          const output = await executePythonScript(scriptPath, ['--root', projectPath]);
          
          return {
            content: [{ type: 'text', text: output }],
          };
        } catch (error) {
          const fallback = await analyzeProjectNative(projectPath, { maxFiles: 200 });
          return {
            content: [{
              type: 'text',
              text: safeJsonStringify({
                mode: 'native-fallback',
                reason: error.message,
                analysis: fallback,
              }),
            }],
          };
        }
      }

      case 'supply_chain_scan': {
        assertOptionalPythonToolAvailable(name);
        const { filePath = 'requirements.txt' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'supply_chain_scanner.py');
        const output = await executePythonScript(scriptPath, [filePath]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'create_baseline': {
        assertOptionalPythonToolAvailable(name);
        const { name, inputFile } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'baseline_manager.py');
        const output = await executePythonScript(scriptPath, [
          'create',
          '--name', name,
          '--input', inputFile
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'compare_baseline': {
        assertOptionalPythonToolAvailable(name);
        const { baselineName, inputFile } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'baseline_manager.py');
        const output = await executePythonScript(scriptPath, [
          'compare',
          '--baseline', baselineName,
          '--input', inputFile
        ]);
        
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'analyze_project': {
        const { projectPath, maxFiles = 200, extensions = [] } = args;
        const analysis = await analyzeProjectNative(projectPath, { maxFiles, extensions });

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(analysis),
            },
          ],
        };
      }

      case 'verify_installation': {
        const scriptPath = join(PYTHON_SCRIPTS_DIR, 'final_verification.py');
        const toolchain = buildNativeVerificationReport();
        let externalVerification = null;
        let externalVerificationError = null;

        if (existsSync(scriptPath)) {
          try {
            externalVerification = await executePythonScript(scriptPath, []);
          } catch (error) {
            externalVerificationError = error.message;
          }
        } else {
          externalVerificationError = `Verification script not found: ${scriptPath}`;
        }

        return {
          content: [{
            type: 'text',
            text: safeJsonStringify({
              status: toolchain.status,
              toolchain,
              externalVerification,
              externalVerificationError,
            }),
          }],
        };
      }

      case 'start_web_dashboard': {
        assertOptionalPythonToolAvailable(name);
        const { port = 8080 } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'web_dashboard.py');
        
        const child = spawn(PYTHON_EXE, [scriptPath, '--port', port.toString()], { 
          cwd: PYTHON_ROOT,
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        
        return {
          content: [{ type: 'text', text: `✅ Web 仪表盘已在后台启动：http://localhost:${port}` }],
        };
      }

      case 'deep_security_scan': {
        assertOptionalPythonToolAvailable(name);
        const { projectPath = '.', output = 'security_report.md' } = args;
        const scriptPath = join(PYTHON_TOOLS_DIR, 'deep_security_scan.py');
        const outputReport = await executePythonScript(scriptPath, [
          '--project', projectPath,
          '--output', output
        ], { timeout: 600000 }); // 给深度扫描更多时间
        
        return {
          content: [{ type: 'text', text: outputReport }],
        };
      }

      case 'get_help': {
        const helpText = `
# Enhanced Static Analysis MCP 帮助手册

## 核心工具

1. **analyze_file** - 分析单个源代码文件的质量、风格和潜在错误
2. **analyze_project** - 原生项目级综合分析（热点文件、TS/JS 编译诊断、依赖和安装状态）
3. **scan_project** - 并行扫描项目代码安全问题
4. **deep_security_scan** - 执行深度安全扫描并生成详细合规报告
5. **incremental_scan** - 仅分析变更的文件 (极速扫描模式)
6. **auto_fix** - 自动修复检测到的常见代码问题
7. **ai_fix_suggestion** - 使用 AI 生成针对性的代码修复建议
8. **predict_risks** - 预测项目技术债务和未来可能的 Bug 风险

## 安全与质量

9. **analyze_security_comprehensive** - 综合安全分析 (Bandit, ESLint, Sonar, Semgrep)
10. **check_dependencies** - 检查项目依赖漏洞、版本过时及许可证风险
11. **check_code_quality** - 深入检查代码质量指标
12. **analyze_code_smells** - 分析代码异味 (SonarQube 风格)

## 报告与监控

13. **generate_report** - 生成多维度的代码分析报告
14. **export_sarif** - 导出分析结果为工业标准 SARIF 格式
15. **start_web_dashboard** - 启动交互式 Web 分析仪表盘
16. **start_team_dashboard** - 启动团队协作分析看板

## 管理与维护

17. **create_baseline / compare_baseline** - 质量基线管理与对比
18. **verify_installation** - 系统健康检查与工具链验证
19. **github_review_pr** - 在 GitHub PR 中执行自动化代码审查

## 使用技巧

- **初次使用**：运行 \`verify_installation\` 确保环境就绪。
- **快速开发**：在提交代码前使用 \`incremental_scan\`。
- **深度分析**：定期运行 \`deep_security_scan\` 生成完整的安全报告。
- **AI 辅助**：遇到复杂漏洞时，调用 \`ai_fix_suggestion\` 获取精准修复代码。
`;
        return {
          content: [{ type: 'text', text: helpText }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: safeJsonStringify({
            error: error.message,
            tool: name,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// 辅助函数：获取文件扩展名
function getFileExtension(language) {
  const extMap = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    go: 'go',
    rust: 'rs',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    ruby: 'rb',
    php: 'php',
    swift: 'swift',
    kotlin: 'kt',
    scala: 'scala',
    r: 'r',
    julia: 'jl',
    lua: 'lua',
    shell: 'sh',
    sql: 'sql',
    html: 'html',
    css: 'css',
    yaml: 'yaml',
    json: 'json',
    xml: 'xml',
    markdown: 'md',
    dart: 'dart',
    elixir: 'ex',
  };
  return extMap[language] || 'txt';
}

// 处理资源列表请求
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'static-analysis://rules/all',
        name: 'All Analysis Rules',
        description: 'Complete list of all supported code analysis rules',
        mimeType: 'application/json',
      },
      {
        uri: 'static-analysis://languages/supported',
        name: 'Supported Languages',
        description: 'List of all supported programming languages',
        mimeType: 'application/json',
      },
    ],
  };
});

// 处理资源读取请求
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'static-analysis://rules/all': {
      const { JavaScriptAnalyzer, PythonAnalyzer, JavaAnalyzer } = await import('./analyzer.js');
      const rules = {
        javascript: new JavaScriptAnalyzer().getSupportedRules(),
        python: new PythonAnalyzer().getSupportedRules(),
        java: new JavaAnalyzer().getSupportedRules(),
        generic: [
          { name: 'no-todo', description: 'Disallow TODO/FIXME comments', severity: SEVERITY.INFO },
          { name: 'max-line-length', description: 'Enforce maximum line length', severity: SEVERITY.HINT },
          { name: 'no-multiple-blank-lines', description: 'Disallow multiple consecutive blank lines', severity: SEVERITY.HINT },
        ],
      };
      
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: safeJsonStringify(rules),
          },
        ],
      };
    }

    case 'static-analysis://languages/supported': {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: safeJsonStringify({
              languages: SUPPORTED_LANGUAGES,
              count: SUPPORTED_LANGUAGES.length,
            }, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

return server;
}

// 启动服务器
function getArgValue(flag, fallback = undefined) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return fallback;
}

async function startHttpServer({ transportMode, host, port }) {
  const app = createMcpExpressApp({ host });
  const transports = new Map();

  if (transportMode === 'streamable-http' || transportMode === 'hybrid') {
    app.all('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'];
        let transport = sessionId ? transports.get(sessionId) : undefined;

        if (!transport) {
          if (req.method !== 'POST' || req.body?.method !== 'initialize') {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
              id: null,
            });
            return;
          }

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              transports.set(newSessionId, transport);
            },
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              transports.delete(transport.sessionId);
            }
          };

          await createServer().connect(transport);
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message || 'Internal server error' },
            id: null,
          });
        }
      }
    });
  }

  if (transportMode === 'sse' || transportMode === 'hybrid') {
    app.get('/sse', async (req, res) => {
      try {
        const transport = new SSEServerTransport('/messages', res);
        transports.set(transport.sessionId, transport);
        transport.onclose = () => transports.delete(transport.sessionId);
        await createServer().connect(transport);
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).send(error.message || 'Error establishing SSE stream');
        }
      }
    });

    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!(transport instanceof SSEServerTransport)) {
        res.status(400).send('No transport found for sessionId');
        return;
      }

      try {
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).send(error.message || 'Error handling request');
        }
      }
    });
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const httpServer = app.listen(port, host, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }

      const address = httpServer.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      console.error(`Static Analysis MCP Server running on ${transportMode} at http://${host}:${actualPort}`);
      if (transportMode === 'streamable-http' || transportMode === 'hybrid') {
        console.error(`MCP endpoint: http://${host}:${actualPort}/mcp`);
      }
      if (transportMode === 'sse' || transportMode === 'hybrid') {
        console.error(`SSE endpoint: http://${host}:${actualPort}/sse`);
        console.error(`Message endpoint: http://${host}:${actualPort}/messages?sessionId=<id>`);
      }
      resolvePromise();
    });
  });
}

async function main() {
  try {
    const transportMode = getArgValue('--transport', process.env.MCP_TRANSPORT || 'stdio');
    const host = getArgValue('--host', process.env.MCP_HOST || '127.0.0.1');
    const port = Number(getArgValue('--port', process.env.MCP_PORT || '3000'));

    if (transportMode === 'stdio') {
      const transport = new StdioServerTransport();
      await createServer().connect(transport);
      console.error('Static Analysis MCP Server running on stdio');
      return;
    }

    if (['streamable-http', 'sse', 'hybrid'].includes(transportMode)) {
      await startHttpServer({ transportMode, host, port });
      return;
    }

    throw new Error(`Unsupported transport mode: ${transportMode}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

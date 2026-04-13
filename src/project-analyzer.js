import { readFileSync, statSync } from 'fs';
import os from 'os';
import path, { resolve } from 'path';
import { glob } from 'glob';
import { spawnSync } from 'child_process';
import ts from 'typescript';
import {
  analyzeFile,
  analyzeComplexity,
  SEVERITY,
} from './analyzer.js';
import { analyzeSecurityComprehensive } from './enhanced-analyzer.js';
import { CodeReviewAnalyzer } from './code-review.js';
import { DependencyAnalyzer, generateDependencyReport } from './dependency-check.js';
import { PackageInstallerChecker, generatePackageCheckReport } from './package-checker.js';
import { diagnoseProjectEnvironment } from './toolchain-doctor.js';
import { parseJsonLike } from './security-utils.js';

const DEFAULT_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'mts', 'cts',
  'py',
  'java',
  'go',
  'rs',
  'php',
  'rb',
  'sh', 'bash', 'zsh',
  'json', 'toml', 'xml', 'yaml', 'yml',
  'c', 'h',
  'cpp', 'cc', 'cxx', 'hpp', 'hh',
  'cs',
  'kt', 'kts',
  'swift',
];
const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.venv/**', '**/venv/**'];
const COMMAND_CACHE = new Map();
const FILE_ANALYSIS_CACHE = new Map();

function normalizeLanguage(language) {
  if (language.startsWith('javascript')) return 'javascript';
  if (language.startsWith('typescript')) return 'typescript';
  if (language.startsWith('python')) return 'python';
  return language;
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function severityScore(severity) {
  switch (severity) {
    case SEVERITY.ERROR:
      return 0;
    case SEVERITY.WARNING:
      return 1;
    case SEVERITY.INFO:
      return 2;
    default:
      return 3;
  }
}

function buildRecommendations(allIssues, diagnostics, toolchain) {
  const recommendations = [];
  const severityBuckets = countBy(allIssues, issue => issue.severity || 'unknown');
  const categoryBuckets = countBy(allIssues, issue => issue.category || 'unknown');

  if ((severityBuckets.error || 0) > 0) {
    recommendations.push({
      priority: 'high',
      reason: `Found ${severityBuckets.error} high-severity code issues.`,
      action: 'Fix error-level findings before merging or releasing.',
    });
  }

  if (diagnostics.length > 0) {
    recommendations.push({
      priority: 'high',
      reason: `Compiler/type diagnostics reported ${diagnostics.length} issue(s).`,
      action: 'Resolve TypeScript/JavaScript diagnostics to restore a clean build.',
    });
  }

  if ((categoryBuckets.security || 0) > 0) {
    recommendations.push({
      priority: 'high',
      reason: `Security-related findings detected: ${categoryBuckets.security}.`,
      action: 'Review and remediate injection, secret-handling, and dependency security findings first.',
    });
  }

  if (toolchain.issues.length > 0) {
    recommendations.push({
      priority: 'high',
      reason: `Toolchain problems detected: ${toolchain.issues.length}.`,
      action: toolchain.suggestions[0] || 'Repair the project toolchain and dependency installation before rerunning analysis.',
    });
  }

  if ((categoryBuckets.complexity || 0) > 0 || (categoryBuckets.maintainability || 0) > 0) {
    recommendations.push({
      priority: 'medium',
      reason: 'Complexity or maintainability hotspots were found.',
      action: 'Refactor the top hotspot files after blocking errors are fixed.',
    });
  }

  return recommendations;
}

function buildQualityGate(allIssues, diagnostics, toolchain) {
  const severityBuckets = countBy(allIssues, issue => issue.severity || 'unknown');
  const blockers = [];

  if ((severityBuckets.error || 0) > 0) {
    blockers.push(`error-level findings: ${severityBuckets.error}`);
  }

  if (diagnostics.length > 0) {
    blockers.push(`compiler diagnostics: ${diagnostics.length}`);
  }

  if (toolchain.issues.length > 0) {
    blockers.push(`toolchain issues: ${toolchain.issues.length}`);
  }

  return {
    status: blockers.length > 0 ? 'fail' : toolchain.warnings.length > 0 || (severityBuckets.warning || 0) > 0 ? 'warn' : 'pass',
    blockers,
    warningCount: (severityBuckets.warning || 0) + toolchain.warnings.length,
  };
}

function buildScores(allIssues, diagnostics, toolchain) {
  const severityBuckets = countBy(allIssues, issue => issue.severity || 'unknown');
  const qualityScore = Math.max(
    0,
    100
      - ((severityBuckets.error || 0) * 8)
      - ((severityBuckets.warning || 0) * 3)
      - (diagnostics.length * 4)
      - (toolchain.issues.length * 10)
      - (toolchain.warnings.length * 4)
  );

  return {
    qualityScore,
    riskLevel: qualityScore < 50 ? 'high' : qualityScore < 75 ? 'medium' : 'low',
  };
}

function buildActionPlan(recommendations, hotspots, dependencyReport) {
  const steps = [];

  for (const recommendation of recommendations) {
    steps.push({
      priority: recommendation.priority,
      action: recommendation.action,
      reason: recommendation.reason,
    });
  }

  if ((dependencyReport.summary?.issuesByCategory?.security || 0) > 0 || (dependencyReport.summary?.totalIssues || 0) > 0) {
    steps.push({
      priority: 'high',
      action: 'Review dependency vulnerabilities and upgrade or replace risky packages.',
      reason: `Dependency report contains ${dependencyReport.summary?.totalIssues || 0} issue(s).`,
    });
  }

  for (const hotspot of hotspots.slice(0, 3)) {
    steps.push({
      priority: 'medium',
      action: `Refactor hotspot file: ${hotspot.filePath}`,
      reason: `High issue/complexity score (${hotspot.issueCount} issues, CC=${hotspot.cyclomaticComplexity}).`,
    });
  }

  return steps;
}

function mapDiagnosticSeverity(category) {
  if (category === ts.DiagnosticCategory.Error) return SEVERITY.ERROR;
  if (category === ts.DiagnosticCategory.Warning) return SEVERITY.WARNING;
  return SEVERITY.INFO;
}

function formatDiagnosticMessage(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function findPythonCommand() {
  return findCommand(['python', 'python3'], [['--version'], ['-V']]);
}

function getFileCacheKey(filePath) {
  try {
    const stats = statSync(filePath);
    return `${filePath}:${stats.mtimeMs}:${stats.size}`;
  } catch {
    return `${filePath}:missing`;
  }
}

function probeCommand(command, probeArgsList = [['--version']]) {
  for (const args of probeArgsList) {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    });
    if (result.status === 0) {
      return true;
    }
  }

  return false;
}

function getWindowsFallbacks(command) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const map = {
    bash: [path.join(systemRoot, 'System32', 'bash.exe')],
    sh: [path.join(programFiles, 'Git', 'bin', 'sh.exe'), path.join(programFilesX86, 'Git', 'bin', 'sh.exe')],
    php: [path.join(programFiles, 'PHP', 'php.exe')],
    ruby: [path.join(programFiles, 'Ruby', 'bin', 'ruby.exe')],
    dotnet: [path.join(programFiles, 'dotnet', 'dotnet.exe')],
  };

  return map[command] || [];
}

function findCommand(commands, probeArgsList = [['--version']]) {
  const cacheKey = JSON.stringify({ commands, probeArgsList, platform: process.platform });
  if (COMMAND_CACHE.has(cacheKey)) {
    return COMMAND_CACHE.get(cacheKey);
  }

  for (const command of commands) {
    if (probeCommand(command, probeArgsList)) {
      COMMAND_CACHE.set(cacheKey, command);
      return command;
    }

    if (process.platform === 'win32') {
      for (const fallbackPath of getWindowsFallbacks(command)) {
        if (probeCommand(fallbackPath, probeArgsList)) {
          COMMAND_CACHE.set(cacheKey, fallbackPath);
          return fallbackPath;
        }
      }
    }
  }

  COMMAND_CACHE.set(cacheKey, null);
  return null;
}

function runNativeFileCheck(command, argsBuilder, files, source, options = {}) {
  if (files.length === 0) {
    return [];
  }

  const maxDiagnostics = options.maxDiagnostics || 100;
  const diagnostics = [];

  for (const filePath of files) {
    const result = spawnSync(command, argsBuilder(filePath), {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10000,
    });

    if (result.status === 0) {
      continue;
    }

    const stderr = result.stderr || result.stdout || '';
    const lineMatch = stderr.match(/line\s+(\d+)/i) || stderr.match(/:(\d+):/);
    diagnostics.push({
      code: `${source.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_ERROR`,
      severity: SEVERITY.ERROR,
      message: stderr.trim() || `${source} error`,
      filePath,
      line: lineMatch ? Number(lineMatch[1]) : null,
      column: null,
      source,
    });

    if (diagnostics.length >= maxDiagnostics) {
      break;
    }
  }

  return diagnostics;
}

function detectMissingParenBeforeBrace(line, pattern) {
  if (!pattern.test(line)) {
    return false;
  }

  const openParenIndex = line.indexOf('(');
  const openBraceIndex = line.indexOf('{', openParenIndex);
  const closeParenIndex = line.indexOf(')');
  return openParenIndex >= 0 && openBraceIndex > openParenIndex && (closeParenIndex === -1 || closeParenIndex > openBraceIndex);
}

function fallbackSyntaxDiagnostics(files, source, matcher, message, options = {}) {
  const diagnostics = [];
  const maxDiagnostics = options.maxDiagnostics || 100;

  for (const filePath of files) {
    const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (matcher(line, index, lines)) {
        diagnostics.push({
          code: `${source.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_ERROR`,
          severity: SEVERITY.ERROR,
          message,
          filePath,
          line: index + 1,
          column: Math.max(1, line.indexOf('{') + 1 || line.length),
          source,
        });
        break;
      }
    }

    if (diagnostics.length >= maxDiagnostics) {
      break;
    }
  }

  return diagnostics;
}

export async function findProjectFiles(projectPath, options = {}) {
  const extensions = options.extensions?.length
    ? options.extensions.map(ext => ext.replace(/^\./, ''))
    : DEFAULT_EXTENSIONS;
  const maxFiles = options.maxFiles || 200;

  const patterns = extensions.length === 1
    ? [`**/*.${extensions[0]}`]
    : [`**/*.{${extensions.join(',')}}`];

  const matchedFiles = new Set();
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectPath,
      absolute: true,
      nodir: true,
      ignore: options.ignore || DEFAULT_IGNORE,
    });

    for (const match of matches) {
      matchedFiles.add(match);
    }
  }

  return [...matchedFiles].slice(0, maxFiles);
}

export function collectTypeScriptDiagnostics(projectPath, files, options = {}) {
  const typeScriptFiles = files.filter(file => /\.(c|m)?tsx?$|\.jsx?$/.test(file));
  if (typeScriptFiles.length === 0) {
    return [];
  }

  const maxDiagnostics = options.maxDiagnostics || 100;
  let compilerOptions = {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };
  let fileNames = typeScriptFiles;

  const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, 'tsconfig.json');
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!configFile.error) {
      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectPath);
      compilerOptions = { ...compilerOptions, ...parsedConfig.options, noEmit: true };
      fileNames = parsedConfig.fileNames.filter(file => files.includes(resolve(file)) || /\.(c|m)?tsx?$|\.jsx?$/.test(file));
    }
  }

  const program = ts.createProgram(fileNames, compilerOptions);
  return ts.getPreEmitDiagnostics(program)
    .slice(0, maxDiagnostics)
    .map(diagnostic => {
      const filePath = diagnostic.file?.fileName || null;
      const position = filePath != null && diagnostic.start != null
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null;

      return {
        code: diagnostic.code,
        severity: mapDiagnosticSeverity(diagnostic.category),
        message: formatDiagnosticMessage(diagnostic),
        filePath,
        line: position ? position.line + 1 : null,
        column: position ? position.character + 1 : null,
        source: diagnostic.source || 'typescript',
      };
    });
}

export function collectPythonDiagnostics(files, options = {}) {
  const pythonFiles = files.filter(file => file.endsWith('.py'));
  if (pythonFiles.length === 0) {
    return [];
  }

  const pythonCommand = findPythonCommand();
  if (!pythonCommand) {
    return [{
      code: 'PYTHON_RUNTIME_MISSING',
      severity: SEVERITY.WARNING,
      message: 'Python runtime not found; skipped Python syntax diagnostics.',
      filePath: null,
      line: null,
      column: null,
      source: 'python-runtime',
    }];
  }

  const maxDiagnostics = options.maxDiagnostics || 100;
  const diagnostics = [];
  const astCheckScript = [
    'import ast, pathlib, sys',
    'target = pathlib.Path(sys.argv[1])',
    'source = target.read_text(encoding="utf-8")',
    'ast.parse(source, filename=str(target))',
  ].join('; ');

  for (const filePath of pythonFiles) {
    const result = spawnSync(pythonCommand, ['-c', astCheckScript, filePath], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10000,
    });

    if (result.status === 0) {
      continue;
    }

    const stderr = result.stderr || result.stdout || '';
    const lineMatch = stderr.match(/line\s+(\d+)/i);
    diagnostics.push({
      code: 'PYTHON_SYNTAX_ERROR',
      severity: SEVERITY.ERROR,
      message: stderr.trim() || 'Python syntax error',
      filePath,
      line: lineMatch ? Number(lineMatch[1]) : null,
      column: null,
      source: 'python-ast',
    });

    if (diagnostics.length >= maxDiagnostics) {
      break;
    }
  }

  return diagnostics;
}

export function collectJsonDiagnostics(files, options = {}) {
  const jsonFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.jsonc'));
  const diagnostics = [];
  const maxDiagnostics = options.maxDiagnostics || 100;

  for (const filePath of jsonFiles) {
    try {
      parseJsonLike(readFileSync(filePath, 'utf-8'));
    } catch (error) {
      diagnostics.push({
        code: 'JSON_PARSE_ERROR',
        severity: SEVERITY.ERROR,
        message: error.message,
        filePath,
        line: null,
        column: null,
        source: 'json-parser',
      });
    }

    if (diagnostics.length >= maxDiagnostics) {
      break;
    }
  }

  return diagnostics;
}

export function collectTomlDiagnostics(files, options = {}) {
  const tomlFiles = files.filter(file => file.endsWith('.toml'));
  const pythonCommand = findPythonCommand();
  if (!pythonCommand || tomlFiles.length === 0) {
    return [];
  }

  return runNativeFileCheck(
    pythonCommand,
    filePath => ['-c', 'import pathlib, sys, tomllib; tomllib.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))', filePath],
    tomlFiles,
    'toml-parser',
    options
  );
}

export function collectXmlDiagnostics(files, options = {}) {
  const xmlFiles = files.filter(file => file.endsWith('.xml'));
  const pythonCommand = findPythonCommand();
  if (!pythonCommand || xmlFiles.length === 0) {
    return [];
  }

  return runNativeFileCheck(
    pythonCommand,
    filePath => ['-c', 'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])', filePath],
    xmlFiles,
    'xml-parser',
    options
  );
}

export function collectYamlDiagnostics(files, options = {}) {
  const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
  if (yamlFiles.length === 0) {
    return [];
  }

  const rubyCommand = findCommand(['ruby'], [['--version'], ['-v']]);
  if (rubyCommand) {
    return runNativeFileCheck(
      rubyCommand,
      filePath => ['-e', 'require "yaml"; YAML.load_file(ARGV[0])', filePath],
      yamlFiles,
      'yaml-ruby',
      options
    );
  }

  const pythonCommand = findPythonCommand();
  if (pythonCommand) {
    const importCheck = spawnSync(pythonCommand, ['-c', 'import yaml'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    });
    if (importCheck.status === 0) {
      return runNativeFileCheck(
        pythonCommand,
        filePath => ['-c', 'import sys, yaml, pathlib; yaml.safe_load(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))', filePath],
        yamlFiles,
        'yaml-python',
        options
      );
    }
  }

  return fallbackSyntaxDiagnostics(
    yamlFiles,
    'yaml-fallback',
    line => /^\s*:\s*\S/.test(line) || /^\s*-\s*:\s*\S/.test(line),
    'Possible YAML syntax error: invalid mapping key or malformed ":" entry.',
    options
  );
}

export function collectCDiagnostics(files, options = {}) {
  const cFiles = files.filter(file => file.endsWith('.c'));
  const cCommand = findCommand(['clang', 'gcc'], [['--version']]);
  if (!cCommand) {
    return fallbackSyntaxDiagnostics(
      cFiles,
      'c-fallback',
      line => detectMissingParenBeforeBrace(line, /^\s*(?:[A-Za-z_][\w\s\*]+)\s+[A-Za-z_]\w*\s*\(/),
      'Possible C syntax error: function declaration appears to be missing a closing parenthesis before "{".',
      options
    );
  }

  return runNativeFileCheck(cCommand, filePath => ['-fsyntax-only', filePath], cFiles, 'c-compile', options);
}

export function collectCppDiagnostics(files, options = {}) {
  const cppFiles = files.filter(file => /\.(cpp|cc|cxx|hpp|hh)$/i.test(file));
  const cppCommand = findCommand(['clang++', 'g++'], [['--version']]);
  if (!cppCommand) {
    return fallbackSyntaxDiagnostics(
      cppFiles,
      'cpp-fallback',
      line => detectMissingParenBeforeBrace(line, /^\s*(?:template<.*>\s*)?(?:[A-Za-z_][\w:\s<>\*&]+)\s+[A-Za-z_]\w*\s*\(/),
      'Possible C++ syntax error: declaration appears to be missing a closing parenthesis before "{".',
      options
    );
  }

  return runNativeFileCheck(cppCommand, filePath => ['-fsyntax-only', '-x', 'c++', filePath], cppFiles, 'cpp-compile', options);
}

export function collectCSharpDiagnostics(files, options = {}) {
  const csFiles = files.filter(file => file.endsWith('.cs'));
  const cscCommand = findCommand(['csc'], [['-help'], ['/?']]);
  if (cscCommand) {
    return runNativeFileCheck(
      cscCommand,
      filePath => ['/nologo', '/target:library', `/out:${path.join(os.tmpdir(), 'codex-csharp-test.dll')}`, filePath],
      csFiles,
      'csharp-compile',
      options
    );
  }

  const dotnetCommand = findCommand(['dotnet'], [['--version']]);
  if (!dotnetCommand) {
    return fallbackSyntaxDiagnostics(
      csFiles,
      'csharp-fallback',
      line => !/\b(if|for|while|switch|catch)\s*\(/.test(line) && detectMissingParenBeforeBrace(line, /\b[A-Za-z_]\w*\s*\(/),
      'Possible C# syntax error: method declaration appears to be missing a closing parenthesis before "{".',
      options
    );
  }

  return runNativeFileCheck(
    dotnetCommand,
    filePath => ['build', filePath],
    csFiles,
    'dotnet-build',
    options
  );
}

export function collectKotlinDiagnostics(files, options = {}) {
  const kotlinFiles = files.filter(file => /\.(kt|kts)$/i.test(file));
  const kotlincCommand = findCommand(['kotlinc'], [['-version']]);
  if (!kotlincCommand) {
    return fallbackSyntaxDiagnostics(
      kotlinFiles,
      'kotlin-fallback',
      line => detectMissingParenBeforeBrace(line, /^\s*fun\s+[A-Za-z_]\w*\s*\(/),
      'Possible Kotlin syntax error: function declaration appears to be missing a closing parenthesis before "{".',
      options
    );
  }

  return runNativeFileCheck(
    kotlincCommand,
    filePath => [filePath, '-d', path.join(os.tmpdir(), 'codex-kotlin-out')],
    kotlinFiles,
    'kotlinc',
    options
  );
}

export function collectSwiftDiagnostics(files, options = {}) {
  const swiftFiles = files.filter(file => file.endsWith('.swift'));
  const swiftcCommand = findCommand(['swiftc'], [['--version']]);
  if (!swiftcCommand) {
    return fallbackSyntaxDiagnostics(
      swiftFiles,
      'swift-fallback',
      line => detectMissingParenBeforeBrace(line, /^\s*func\s+[A-Za-z_]\w*\s*\(/),
      'Possible Swift syntax error: function declaration appears to be missing a closing parenthesis before "{".',
      options
    );
  }

  return runNativeFileCheck(swiftcCommand, filePath => ['-typecheck', filePath], swiftFiles, 'swiftc', options);
}

export function collectShellDiagnostics(files, options = {}) {
  const shellFiles = files.filter(file => /\.(sh|bash|zsh)$/i.test(file));
  const shellCommand = findCommand(['bash', 'sh'], [['--version'], ['--help']]);
  if (!shellCommand) {
    return shellFiles.flatMap(filePath => {
      const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/);
      const diagnostics = [];
      const hasIf = lines.some(line => /^\s*if\b/.test(line));
      const hasFi = lines.some(line => /^\s*fi\b/.test(line));
      const hasLoop = lines.some(line => /^\s*(for|while|until)\b/.test(line));
      const hasDone = lines.some(line => /^\s*done\b/.test(line));

      if (hasIf && !hasFi) {
        diagnostics.push({
          code: 'SHELL_FALLBACK_ERROR',
          severity: SEVERITY.ERROR,
          message: 'Possible shell syntax error: "if" block appears to be missing closing "fi".',
          filePath,
          line: lines.findIndex(line => /^\s*if\b/.test(line)) + 1,
          column: 1,
          source: 'shell-fallback',
        });
      }

      if (hasLoop && !hasDone) {
        diagnostics.push({
          code: 'SHELL_FALLBACK_ERROR',
          severity: SEVERITY.ERROR,
          message: 'Possible shell syntax error: loop appears to be missing closing "done".',
          filePath,
          line: lines.findIndex(line => /^\s*(for|while|until)\b/.test(line)) + 1,
          column: 1,
          source: 'shell-fallback',
        });
      }

      return diagnostics;
    });
  }

  return runNativeFileCheck(shellCommand, filePath => ['-n', filePath], shellFiles, 'shell-syntax', options);
}

export function collectPhpDiagnostics(files, options = {}) {
  const phpFiles = files.filter(file => file.endsWith('.php'));
  const phpCommand = findCommand(['php'], [['--version'], ['-v']]);
  if (!phpCommand) {
    return [];
  }

  return runNativeFileCheck(phpCommand, filePath => ['-l', filePath], phpFiles, 'php-lint', options);
}

export function collectRubyDiagnostics(files, options = {}) {
  const rubyFiles = files.filter(file => file.endsWith('.rb'));
  const rubyCommand = findCommand(['ruby'], [['--version'], ['-v']]);
  if (!rubyCommand) {
    return [];
  }

  return runNativeFileCheck(rubyCommand, filePath => ['-c', filePath], rubyFiles, 'ruby-syntax', options);
}

export function collectJavaDiagnostics(files, options = {}) {
  const javaFiles = files.filter(file => file.endsWith('.java'));
  const javacCommand = findCommand(['javac'], [['-version']]);
  if (!javacCommand) {
    return [];
  }

  return runNativeFileCheck(javacCommand, filePath => ['-d', os.tmpdir(), filePath], javaFiles, 'javac', options);
}

export function collectGoDiagnostics(files, options = {}) {
  const goFiles = files.filter(file => file.endsWith('.go'));
  const goCommand = findCommand(['go'], [['version']]);
  if (!goCommand) {
    return [];
  }

  return runNativeFileCheck(goCommand, filePath => ['tool', 'compile', filePath], goFiles, 'go-compile', options);
}

export function collectRustDiagnostics(files, options = {}) {
  const rustFiles = files.filter(file => file.endsWith('.rs'));
  const rustcCommand = findCommand(['rustc'], [['--version']]);
  if (!rustcCommand) {
    return [];
  }

  return runNativeFileCheck(
    rustcCommand,
    filePath => ['--crate-type', 'lib', '--emit', 'metadata', filePath, '-o', path.join(os.tmpdir(), 'codex-rust-meta.rmeta')],
    rustFiles,
    'rustc',
    options
  );
}

async function analyzeProjectFile(filePath, codeReviewAnalyzer) {
  const cacheKey = getFileCacheKey(filePath);
  const cached = FILE_ANALYSIS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const baseAnalysis = await analyzeFile(filePath);
  const language = normalizeLanguage(baseAnalysis.language);
  const code = readFileSync(filePath, 'utf-8');
  const [reviewIssues, securityIssues] = await Promise.all([
    codeReviewAnalyzer.reviewCode(code, filePath, language),
    ['javascript', 'typescript', 'python'].includes(language)
      ? analyzeSecurityComprehensive(code, filePath, language)
      : Promise.resolve([]),
  ]);
  const metrics = baseAnalysis.metrics || analyzeComplexity(code, language);
  const combinedIssues = [...(baseAnalysis.issues || []), ...reviewIssues, ...securityIssues];

  const result = {
    filePath,
    language,
    issues: combinedIssues,
    metrics,
    issueCount: combinedIssues.length,
  };

  FILE_ANALYSIS_CACHE.set(cacheKey, result);
  return result;
}

export async function analyzeProject(projectPath, options = {}) {
  const absolutePath = resolve(projectPath);
  const files = await findProjectFiles(absolutePath, options);
  const codeReviewAnalyzer = new CodeReviewAnalyzer();
  const fileAnalyses = [];
  const allIssues = [];
  const concurrency = Math.max(1, Number(options.fileConcurrency || 4));

  for (let index = 0; index < files.length; index += concurrency) {
    const batch = files.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(filePath => analyzeProjectFile(filePath, codeReviewAnalyzer)));
    for (const result of batchResults) {
      fileAnalyses.push(result);
      allIssues.push(...result.issues);
    }
  }

  const diagnostics = [
    ...collectTypeScriptDiagnostics(absolutePath, files, options),
    ...collectPythonDiagnostics(files, options),
    ...collectJsonDiagnostics(files, options),
    ...collectTomlDiagnostics(files, options),
    ...collectXmlDiagnostics(files, options),
    ...collectYamlDiagnostics(files, options),
    ...collectCDiagnostics(files, options),
    ...collectCppDiagnostics(files, options),
    ...collectCSharpDiagnostics(files, options),
    ...collectKotlinDiagnostics(files, options),
    ...collectSwiftDiagnostics(files, options),
    ...collectShellDiagnostics(files, options),
    ...collectPhpDiagnostics(files, options),
    ...collectRubyDiagnostics(files, options),
    ...collectJavaDiagnostics(files, options),
    ...collectGoDiagnostics(files, options),
    ...collectRustDiagnostics(files, options),
  ];
  const dependencyAnalyzer = new DependencyAnalyzer();
  const packageChecker = new PackageInstallerChecker();
  let dependencyResults;
  try {
    dependencyResults = await dependencyAnalyzer.analyzeProject(absolutePath);
  } catch (error) {
    dependencyResults = {
      projectPath: absolutePath,
      files: [],
      issues: [],
      summary: {
        totalDependencies: 0,
        totalIssues: 0,
        bySeverity: {
          [SEVERITY.ERROR]: 0,
          [SEVERITY.WARNING]: 0,
          [SEVERITY.HINT]: 0,
        },
        byType: {
          vulnerability: 0,
          outdated: 0,
          license: 0,
        },
        language: 'unknown',
        note: error.message,
      },
    };
  }

  let packageResults;
  try {
    packageResults = packageChecker.checkPackagesInstalled(absolutePath, 'auto');
  } catch (error) {
    packageResults = {
      projectPath: absolutePath,
      packageManagers: [],
      issues: [],
      summary: {
        totalManagers: 0,
        totalIssues: 0,
        byType: {
          missing: 0,
          corrupted: 0,
          outdated: 0,
        },
        note: error.message,
      },
    };
  }
  const toolchain = diagnoseProjectEnvironment(absolutePath);

  const hotspotFiles = [...fileAnalyses]
    .sort((left, right) => {
      const leftScore = left.issueCount + (left.metrics?.estimatedCyclomaticComplexity || 0);
      const rightScore = right.issueCount + (right.metrics?.estimatedCyclomaticComplexity || 0);
      return rightScore - leftScore;
    })
    .slice(0, 10)
    .map(item => ({
      filePath: item.filePath,
      language: item.language,
      issueCount: item.issueCount,
      cyclomaticComplexity: item.metrics?.estimatedCyclomaticComplexity || 0,
      maintainabilityIndex: item.metrics?.maintainabilityIndex || null,
    }));

  const topFindings = [...allIssues]
    .sort((left, right) => severityScore(left.severity) - severityScore(right.severity))
    .slice(0, 20)
    .map(issue => ({
      filePath: issue.filePath,
      rule: issue.rule,
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      suggestion: issue.suggestion || null,
      line: issue.line || null,
      column: issue.column || null,
    }));

  const recommendations = buildRecommendations(allIssues, diagnostics, toolchain);
  const qualityGate = buildQualityGate(allIssues, diagnostics, toolchain);
  const scores = buildScores(allIssues, diagnostics, toolchain);
  const dependencyReport = generateDependencyReport(dependencyResults);
  const packageInstallationReport = generatePackageCheckReport(packageResults);
  const actionPlan = buildActionPlan(
    recommendations,
    hotspotFiles,
    dependencyReport
  );

  return {
    projectPath: absolutePath,
    filesAnalyzed: files.length,
    summary: {
      totalIssues: allIssues.length,
      issuesBySeverity: countBy(allIssues, issue => issue.severity || 'unknown'),
      issuesByCategory: countBy(allIssues, issue => issue.category || 'unknown'),
      diagnosticsBySeverity: countBy(diagnostics, diagnostic => diagnostic.severity || 'unknown'),
    },
    diagnostics,
    hotspots: hotspotFiles,
    topFindings,
    scores,
    qualityGate,
    recommendations,
    actionPlan,
    fileAnalyses,
    dependencyReport,
    packageInstallationReport,
    toolchain,
  };
}

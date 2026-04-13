/**
 * 新功能测试脚本 - 包检查和日志分析
 * Test New Features - Package Check and Log Analysis
 */

import { PackageInstallerChecker, generatePackageCheckReport, PACKAGE_MANAGERS } from './src/package-checker.js';
import { LogAnalyzer, generateLogAnalysisReport, SECURITY_PATTERNS, PERFORMANCE_PATTERNS } from './src/log-analyzer.js';

console.log('='.repeat(70));
console.log('静态代码分析 MCP 服务器 - 新功能测试');
console.log('包安装检查 + 日志分析');
console.log('='.repeat(70));

async function runNewFeatureTests() {
  // 测试 1: 获取支持的包管理器
  console.log('\n📋 测试 1: 支持的包管理器');
  console.log('-'.repeat(50));
  
  const checker = new PackageInstallerChecker();
  const managers = checker.getSupportedManagers();
  
  console.log(`支持 ${managers.length} 个包管理器:`);
  managers.forEach(manager => {
    console.log(`  - ${manager.name} (${manager.language}): ${manager.lockFile}`);
  });

  // 测试 2: 检测包管理器
  console.log('\n📋 测试 2: 自动检测包管理器');
  console.log('-'.repeat(50));
  
  // 测试当前目录
  const currentPath = process.cwd();
  const detected = checker.detectPackageManager(currentPath);
  
  if (detected.length > 0) {
    console.log(`检测到 ${detected.length} 个包管理器:`);
    detected.forEach(manager => {
      console.log(`  - ${manager.name} (置信度：${manager.confidence})`);
    });
  } else {
    console.log('当前目录未检测到包管理器');
  }

  // 测试 3: 日志分析器 - 安全模式
  console.log('\n📋 测试 3: 日志分析 - 安全事件检测');
  console.log('-'.repeat(50));
  
  const logAnalyzer = new LogAnalyzer();
  
  // 测试安全模式检测
  const testMessages = [
    'Failed login attempt for user admin from IP 192.168.1.100',
    'SQL injection detected: SELECT * FROM users WHERE id=1 OR 1=1',
    'XSS attempt blocked: <script>alert("xss")</script>',
    'Path traversal attempt: ../../../etc/passwd',
    'Access denied: 403 Forbidden',
    'Rate limit exceeded: 429 Too Many Requests',
  ];
  
  console.log('安全事件检测测试:');
  testMessages.forEach(message => {
    const issues = logAnalyzer.detectSecurityIssues(message);
    if (issues.length > 0) {
      console.log(`  ✓ "${message.substring(0, 50)}..."`);
      issues.forEach(issue => {
        console.log(`    → ${issue.name} [${issue.severity}]`);
      });
    }
  });

  // 测试 4: 性能问题检测
  console.log('\n📋 测试 4: 日志分析 - 性能问题检测');
  console.log('-'.repeat(50));
  
  const perfMessages = [
    'Slow query detected: SELECT * FROM users took 15234ms',
    'Connection timeout after 30000ms',
    'Out of memory: Java heap space',
    'Connection pool exhausted, no available connections',
    'Disk full: no space left on device',
  ];
  
  console.log('性能问题检测测试:');
  perfMessages.forEach(message => {
    const issues = logAnalyzer.detectPerformanceIssues(message);
    if (issues.length > 0) {
      console.log(`  ✓ "${message.substring(0, 50)}..."`);
      issues.forEach(issue => {
        console.log(`    → ${issue.name} [${issue.severity}]`);
      });
    }
  });

  // 测试 5: 错误分类
  console.log('\n📋 测试 5: 错误分类');
  console.log('-'.repeat(50));
  
  const errorMessages = [
    'SyntaxError: Unexpected token',
    'RuntimeError: Exception in thread main',
    'NetworkError: Connection refused',
    'DatabaseError: Query failed with deadlock',
    'FileNotFoundError: ENOENT: no such file',
    'ModuleNotFoundError: Cannot find module',
  ];
  
  console.log('错误分类测试:');
  errorMessages.forEach(message => {
    const category = logAnalyzer.categorizeError(message);
    console.log(`  "${message.substring(0, 40)}..."`);
    console.log(`    → ${category.name} (${category.code})`);
  });

  // 测试 6: 日志格式检测
  console.log('\n📋 测试 6: 日志格式检测');
  console.log('-'.repeat(50));
  
  const testLogs = [
    '{"timestamp":"2024-01-01T00:00:00Z","level":"ERROR","message":"Test error"}',
    '[2024-01-01 00:00:00] [ERROR] Test error message',
    '2024-01-01 00:00:00 ERROR Test error message',
    'Jan  1 00:00:00 hostname service: Test error message',
  ];
  
  console.log('格式检测测试:');
  testLogs.forEach(log => {
    const format = logAnalyzer.detectLogFormat(log);
    console.log(`  ${format}: ${log.substring(0, 50)}...`);
  });

  // 测试 7: 生成模拟日志报告
  console.log('\n📋 测试 7: 生成日志分析报告');
  console.log('-'.repeat(50));
  
  const mockLogResults = {
    filePath: '/var/log/app.log',
    format: 'generic',
    totalLines: 1000,
    parsedLines: 950,
    entries: [],
    summary: {
      byLevel: {
        error: 15,
        warn: 45,
        info: 800,
        debug: 90,
      },
      totalIssues: 25,
      byType: {
        security: 10,
        performance: 10,
        error: 5,
      },
      parseRate: 0.95,
    },
    issues: [
      {
        type: 'security',
        line: 123,
        timestamp: '2024-01-01 12:34:56',
        issues: [{ name: 'Failed Login', severity: 'error' }],
        message: 'Failed login attempt for user admin',
      },
      {
        type: 'performance',
        line: 456,
        timestamp: '2024-01-01 13:45:67',
        issues: [{ name: 'Slow Query', severity: 'warning' }],
        message: 'Slow query detected: 15234ms',
      },
    ],
  };
  
  const logReport = generateLogAnalysisReport(mockLogResults);
  
  console.log('日志报告摘要:');
  console.log(`  文件：${logReport.filePath}`);
  console.log(`  格式：${logReport.format}`);
  console.log(`  总行数：${logReport.totalLines}`);
  console.log(`  解析率：${(logReport.summary.parseRate * 100).toFixed(1)}%`);
  console.log(`  错误数：${logReport.summary.byLevel.error}`);
  console.log(`  警告数：${logReport.summary.byLevel.warn}`);
  console.log(`  安全问题：${logReport.summary.byType.security}`);
  console.log(`  性能问题：${logReport.summary.byType.performance}`);
  console.log(`  建议数：${logReport.recommendations.length}`);

  // 测试 8: 包安装检查报告
  console.log('\n📋 测试 8: 生成包安装检查报告');
  console.log('-'.repeat(50));
  
  const mockPackageResults = {
    projectPath: currentPath,
    packageManagers: [{ name: 'npm', lockFile: 'package-lock.json' }],
    issues: [
      {
        type: 'missing',
        severity: 'error',
        manager: 'npm',
        message: 'Dependencies not installed',
        suggestion: 'Run npm install',
      },
    ],
    summary: {
      totalManagers: 1,
      totalIssues: 1,
      byType: {
        missing: 1,
        corrupted: 0,
        outdated: 0,
      },
    },
  };
  
  const packageReport = generatePackageCheckReport(mockPackageResults);
  
  console.log('包安装检查报告摘要:');
  console.log(`  项目：${packageReport.projectPath}`);
  console.log(`  包管理器：${packageReport.packageManagers.map(m => m.name).join(', ')}`);
  console.log(`  问题数：${packageReport.summary.totalIssues}`);
  console.log(`  建议数：${packageReport.suggestions.length}`);

  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('新功能测试完成!');
  console.log('='.repeat(70));
  console.log('\n✅ 新增工具列表:');
  console.log('  包安装检查:');
  console.log('    1. check_package_installation - 检查依赖包安装状态');
  console.log('    2. get_package_managers - 获取支持的包管理器');
  console.log('  日志分析:');
  console.log('    3. analyze_log_file - 分析日志文件');
  console.log('    4. analyze_log_directory - 分析日志目录');
  console.log('    5. get_log_patterns - 获取日志模式规则');
  console.log('\n📊 功能特性:');
  console.log('  包安装检查:');
  console.log('    - 支持 11 个包管理器 (npm, yarn, pip, maven, cargo, go 等)');
  console.log('    - 自动检测项目类型');
  console.log('    - 检查锁文件和安装目录');
  console.log('    - 生成安装建议');
  console.log('  日志分析:');
  console.log('    - 支持多种日志格式 (JSON, generic, syslog, apache 等)');
  console.log('    - 检测 8 种安全事件模式');
  console.log('    - 检测 5 种性能问题模式');
  console.log('    - 错误分类 (7 种类型)');
  console.log('    - 日志级别统计');
  console.log('\n🎯 现在 MCP 服务器共有 32 个工具!');
}

runNewFeatureTests().catch(console.error);

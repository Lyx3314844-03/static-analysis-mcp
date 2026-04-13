/**
 * 依赖检查功能测试脚本
 * Test Dependency Check Features
 */

import { DependencyAnalyzer, generateDependencyReport, VULNERABILITY_DATABASE } from './src/dependency-check.js';

console.log('='.repeat(70));
console.log('静态代码分析 MCP 服务器 - 依赖检查功能测试');
console.log('灵感来自 npm audit, pip-audit, Dependabot, Snyk');
console.log('='.repeat(70));

async function runDependencyTests() {
  const analyzer = new DependencyAnalyzer();

  // 测试 1: 获取支持的检查类型
  console.log('\n📋 测试 1: 获取支持的依赖检查类型');
  console.log('-'.repeat(50));
  
  const checks = analyzer.getSupportedChecks();
  console.log('支持的检查类型:');
  for (const [type, info] of Object.entries(checks)) {
    console.log(`  ${type}:`);
    console.log(`    描述：${info.description}`);
    console.log(`    支持语言：${info.languages.join(', ')}`);
  }

  // 测试 2: 漏洞数据库
  console.log('\n📋 测试 2: 漏洞数据库统计');
  console.log('-'.repeat(50));
  
  console.log('漏洞数据库覆盖:');
  for (const [language, deps] of Object.entries(VULNERABILITY_DATABASE)) {
    const depCount = Object.keys(deps).length;
    console.log(`  ${language}: ${depCount} 个依赖包`);
    
    // 显示部分示例
    const sampleDeps = Object.keys(deps).slice(0, 3);
    console.log(`    示例：${sampleDeps.join(', ')}...`);
  }

  // 测试 3: 测试 JavaScript 依赖检查
  console.log('\n📋 测试 3: JavaScript 依赖漏洞检查');
  console.log('-'.repeat(50));
  
  const jsDependencies = {
    'lodash': '^4.17.15',
    'axios': '0.21.0',
    'express': '4.17.1',
    'moment': '2.29.1',
    'minimist': '1.2.5',
    'node-fetch': '2.6.1',
  };
  
  const jsVulns = analyzer.checkVulnerabilities(jsDependencies, 'javascript');
  console.log(`发现 ${jsVulns.length} 个漏洞:`);
  jsVulns.forEach((vuln, i) => {
    console.log(`  ${i + 1}. [${vuln.severity}] ${vuln.dependency} ${vuln.currentVersion}`);
    console.log(`     ${vuln.title} (${vuln.cve})`);
    console.log(`     修复：${vuln.fix}`);
  });

  // 测试 4: 测试 Python 依赖检查
  console.log('\n📋 测试 4: Python 依赖漏洞检查');
  console.log('-'.repeat(50));
  
  const pyDependencies = {
    'requests': '2.25.0',
    'urllib3': '1.26.4',
    'pillow': '8.0.0',
    'pyyaml': '5.3.1',
    'jinja2': '2.11.2',
    'django': '3.1.0',
  };
  
  const pyVulns = analyzer.checkVulnerabilities(pyDependencies, 'python');
  console.log(`发现 ${pyVulns.length} 个漏洞:`);
  pyVulns.forEach((vuln, i) => {
    console.log(`  ${i + 1}. [${vuln.severity}] ${vuln.dependency} ${vuln.currentVersion}`);
    console.log(`     ${vuln.title} (${vuln.cve})`);
    console.log(`     修复：${vuln.fix}`);
  });

  // 测试 5: 生成修复建议
  console.log('\n📋 测试 5: 生成修复建议');
  console.log('-'.repeat(50));
  
  const allVulns = [...jsVulns, ...pyVulns];
  const suggestions = analyzer.generateFixSuggestions(allVulns);
  
  console.log('修复建议（按优先级排序）:');
  suggestions.forEach((suggestion, i) => {
    console.log(`  ${i + 1}. [${suggestion.priority}] ${suggestion.dependency}`);
    console.log(`     命令：${suggestion.command}`);
    console.log(`     说明：${suggestion.description}`);
  });

  // 测试 6: 许可证风险
  console.log('\n📋 测试 6: 许可证风险检查');
  console.log('-'.repeat(50));
  
  const testLicenses = {
    'package-a': 'MIT',
    'package-b': 'Apache-2.0',
    'package-c': 'GPL-3.0',
    'package-d': 'UNKNOWN',
    'package-e': 'BSD-3-Clause',
  };
  
  const licenseIssues = analyzer.checkLicenses(testLicenses);
  console.log(`发现 ${licenseIssues.length} 个许可证问题:`);
  licenseIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.dependency}: ${issue.license}`);
    console.log(`     风险等级：${issue.riskLevel}`);
    console.log(`     建议：${issue.fix}`);
  });

  // 测试 7: 生成完整报告
  console.log('\n📋 测试 7: 生成完整依赖报告');
  console.log('-'.repeat(50));
  
  const mockResults = {
    projectPath: '/test/project',
    files: ['package.json'],
    issues: allVulns,
    summary: {
      totalDependencies: Object.keys(jsDependencies).length,
      totalIssues: allVulns.length,
      bySeverity: {
        error: allVulns.filter(v => v.severity === 'error').length,
        warning: allVulns.filter(v => v.severity === 'warning').length,
        hint: allVulns.filter(v => v.severity === 'hint').length,
      },
      byType: {
        vulnerability: allVulns.length,
        outdated: 0,
        license: licenseIssues.length,
      },
      language: 'javascript',
    },
  };
  
  const report = generateDependencyReport(mockResults);
  console.log('报告摘要:');
  console.log(`  项目路径：${report.projectPath}`);
  console.log(`  文件：${report.files.join(', ')}`);
  console.log(`  总依赖数：${report.summary.totalDependencies}`);
  console.log(`  总问题数：${report.summary.totalIssues}`);
  console.log(`  按严重性:`);
  console.log(`    - Error: ${report.summary.bySeverity.error}`);
  console.log(`    - Warning: ${report.summary.bySeverity.warning}`);
  console.log(`    - Hint: ${report.summary.bySeverity.hint}`);
  console.log(`  建议数量：${report.recommendations.length}`);

  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('依赖检查功能测试完成!');
  console.log('='.repeat(70));
  console.log('\n✅ 新增工具列表:');
  console.log('  1. check_dependencies - 检查项目依赖漏洞');
  console.log('  2. get_dependency_fix_suggestions - 获取修复建议');
  console.log('  3. get_supported_dependency_checks - 获取支持的检查类型');
  console.log('\n📊 功能特性:');
  console.log('  - 漏洞检测：100+ 已知漏洞依赖');
  console.log('  - 支持语言：JavaScript, Python, Java, Rust, Go');
  console.log('  - 许可证风险：高/中/低风险分类');
  console.log('  - 修复建议：自动生成修复命令');
  console.log('  - 报告生成：完整的依赖健康报告');
  console.log('\n🎯 类似工具:');
  console.log('  - npm audit (JavaScript)');
  console.log('  - pip-audit (Python)');
  console.log('  - Dependabot (GitHub)');
  console.log('  - Snyk (多语言)');
  console.log('\n📝 支持的文件:');
  console.log('  - package.json (npm/yarn)');
  console.log('  - requirements.txt (pip)');
  console.log('  - pom.xml (Maven)');
  console.log('\n🎯 现在 MCP 服务器共有 27 个工具!');
}

runDependencyTests().catch(console.error);

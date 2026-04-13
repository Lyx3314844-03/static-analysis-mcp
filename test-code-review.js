/**
 * 测试代码审查功能脚本
 * Test Code Review Features Script
 */

import { CodeReviewAnalyzer, generateCodeReviewReport, SUPPORTED_LANGUAGES_EXTENDED } from './src/code-review.js';

console.log('='.repeat(70));
console.log('静态代码分析 MCP 服务器 - 代码审查功能测试');
console.log('灵感来自 CodeRabbit、Reviewdog 等工具');
console.log('='.repeat(70));

async function runCodeReviewTests() {
  const analyzer = new CodeReviewAnalyzer();

  // 测试 1: JavaScript 错误检测
  console.log('\n📋 测试 1: JavaScript 错误检测');
  console.log('-'.repeat(50));
  
  const jsCodeWithErrors = `
function processData(items) {
    for (let i = 0; i <= items.length; i++) {
        if (items[i].active = true) {
            console.log("Processing: " + items[i].name);
        }
    }
    
    let result = null;
    if (result !== null) {
        return result.value;
    }
    
    while (true) {
        // Infinite loop
    }
}
`;

  const jsErrors = await analyzer.analyzeErrors(jsCodeWithErrors, 'test.js', 'javascript');
  console.log(`发现 ${jsErrors.length} 个错误:`);
  jsErrors.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
    console.log(`     建议：${issue.suggestion}`);
  });

  // 测试 2: Python 错误检测
  console.log('\n📋 测试 2: Python 错误检测');
  console.log('-'.repeat(50));
  
  const pyCodeWithErrors = `
def process_data(items=[]):
    global counter
    try:
        for item in items:
            print(item)
    except:
        pass
    
    return items
`;

  const pyErrors = await analyzer.analyzeErrors(pyCodeWithErrors, 'test.py', 'python');
  console.log(`发现 ${pyErrors.length} 个错误:`);
  pyErrors.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule} - 第 ${issue.line} 行`);
    console.log(`     ${issue.message}`);
    console.log(`     建议：${issue.suggestion}`);
  });

  // 测试 3: CodeRabbit 风格代码审查
  console.log('\n📋 测试 3: CodeRabbit 风格代码审查');
  console.log('-'.repeat(50));
  
  const reviewCode = `
function calculateTotal(items, taxRate, discount) {
    var total = 0;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].price > 100) {
            if (items[i].category === 'A') {
                if (items[i].discount) {
                    if (items[i].tax) {
                        total += items[i].price * 0.9 * 1.1;
                    }
                }
            }
        }
    }
    
    // TODO: Fix this calculation
    return total * 1.08;
}

function helper1() {}
function helper2() {}
function helper3() {}
function helper4() {}
function helper5() {}
function helper6() {}
function helper7() {}
function helper8() {}
function helper9() {}
function helper10() {}
`;

  const reviewIssues = await analyzer.reviewCode(reviewCode, 'review.js', 'javascript');
  console.log(`发现 ${reviewIssues.length} 个审查问题:`);
  reviewIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity}] ${issue.rule}`);
    console.log(`     ${issue.message}`);
    console.log(`     建议：${issue.suggestion}`);
  });

  // 测试 4: 生成完整审查报告
  console.log('\n📋 测试 4: 生成完整审查报告 (CodeRabbit 风格)');
  console.log('-'.repeat(50));
  
  const allIssues = [...jsErrors, ...reviewIssues];
  const report = generateCodeReviewReport(allIssues, jsCodeWithErrors + reviewCode, 'combined.js');
  
  console.log('审查报告摘要:');
  console.log(`  总问题数：${report.summary.totalIssues}`);
  console.log(`  按严重性:`);
  console.log(`    - Error: ${report.summary.bySeverity.error}`);
  console.log(`    - Warning: ${report.summary.bySeverity.warning}`);
  console.log(`    - Info: ${report.summary.bySeverity.info}`);
  console.log(`    - Hint: ${report.summary.bySeverity.hint}`);
  console.log(`  按类别:`);
  for (const [category, count] of Object.entries(report.summary.byCategory)) {
    console.log(`    - ${category}: ${count}`);
  }
  console.log(`  可自动修复：${report.summary.autoFixable}`);

  // 测试 5: 获取支持的规则
  console.log('\n📋 测试 5: 获取支持的审查规则');
  console.log('-'.repeat(50));
  
  const rules = analyzer.getSupportedRules();
  console.log('规则分类:');
  console.log(`  错误检测规则:`);
  for (const [category, categoryRules] of Object.entries(rules.errorDetection)) {
    console.log(`    - ${category}: ${categoryRules.length} 条规则`);
  }
  console.log(`  代码审查规则:`);
  for (const [category, categoryRules] of Object.entries(rules.codeReview)) {
    console.log(`    - ${category}: ${categoryRules.length} 条规则`);
  }
  console.log(`  语言特定规则:`);
  for (const [language, languageRules] of Object.entries(rules.languageSpecific)) {
    console.log(`    - ${language}: ${languageRules.length} 条规则`);
  }

  // 测试 6: 支持的语言
  console.log('\n📋 测试 6: 支持的语言列表');
  console.log('-'.repeat(50));
  
  console.log(`支持 ${SUPPORTED_LANGUAGES_EXTENDED.length} 种编程语言:`);
  
  // 按类别分组显示
  const categories = {
    web: ['javascript', 'typescript', 'html', 'css', 'scss', 'less', 'sass', 'vue', 'svelte'],
    backend: ['python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'ruby'],
    mobile: ['swift', 'kotlin', 'dart', 'objective-c'],
    functional: ['haskell', 'ocaml', 'fsharp', 'clojure', 'elixir', 'erlang', 'elm'],
    scripting: ['shell', 'bash', 'zsh', 'powershell', 'lua', 'perl', 'r'],
    data: ['sql', 'graphql', 'json', 'yaml', 'toml', 'xml'],
    systems: ['c', 'cpp', 'rust', 'go', 'assembly', 'zig', 'nim'],
    jvm: ['java', 'kotlin', 'scala', 'groovy'],
    dotnet: ['csharp', 'fsharp', 'vb'],
  };
  
  for (const [category, langs] of Object.entries(categories)) {
    const supported = langs.filter(l => SUPPORTED_LANGUAGES_EXTENDED.includes(l));
    if (supported.length > 0) {
      console.log(`  ${category}: ${supported.join(', ')}`);
    }
  }

  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('代码审查功能测试完成!');
  console.log('='.repeat(70));
  console.log('\n✅ 新增工具列表:');
  console.log('  1. code_review - CodeRabbit 风格代码审查');
  console.log('  2. detect_errors - 错误检测');
  console.log('  3. get_review_rules - 获取审查规则');
  console.log('  4. get_supported_languages_extended - 支持的语言列表');
  console.log('\n📊 功能特性:');
  console.log('  - 错误检测：语法错误、逻辑错误、类型错误、性能问题、内存泄漏');
  console.log('  - 代码审查：最佳实践、错误处理、代码清晰度、文档、测试');
  console.log('  - 语言特定规则：Python、Java、Go、Rust 等');
  console.log('  - 修复建议：自动修复代码和手动修复步骤');
  console.log('  - 支持 50+ 种编程语言');
  console.log('\n🎯 现在 MCP 服务器共有 24 个工具!');
  console.log('\n📝 CodeRabbit 风格特性:');
  console.log('  - 代码上下文理解');
  console.log('  - 自然语言反馈');
  console.log('  - 可操作的修复建议');
  console.log('  - 最佳实践指导');
  console.log('  - 多语言支持');
}

runCodeReviewTests().catch(console.error);

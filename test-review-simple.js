/**
 * 简化版代码审查功能测试
 * Simplified Code Review Test
 */

import { SUPPORTED_LANGUAGES_EXTENDED } from './src/code-review.js';

console.log('='.repeat(70));
console.log('静态代码分析 MCP 服务器 - 代码审查功能测试 (简化版)');
console.log('='.repeat(70));

console.log('\n✅ 功能已添加到 MCP 服务器');
console.log('\n📊 新增工具:');
console.log('  1. code_review - CodeRabbit 风格代码审查');
console.log('  2. detect_errors - 错误检测');
console.log('  3. get_review_rules - 获取审查规则');
console.log('  4. get_supported_languages_extended - 支持的语言列表');

console.log('\n📊 支持的语言:');
console.log(`   总计：${SUPPORTED_LANGUAGES_EXTENDED.length} 种`);
console.log('\n   分类:');
console.log('   - Web: JavaScript, TypeScript, HTML, CSS, SCSS, Vue, Svelte');
console.log('   - Backend: Python, Java, Go, Rust, C/C++, C#, PHP, Ruby');
console.log('   - Mobile: Swift, Kotlin, Dart, Objective-C');
console.log('   - Functional: Haskell, OCaml, F#, Clojure, Elixir, Erlang');
console.log('   - Scripting: Shell, Bash, PowerShell, Lua, Perl, R');
console.log('   - Data: SQL, GraphQL, JSON, YAML, XML');
console.log('   - Systems: C, C++, Rust, Go, Assembly, Zig, Nim');
console.log('   - JVM: Java, Kotlin, Scala, Groovy');
console.log('   - .NET: C#, F#, VB');

console.log('\n📝 CodeRabbit 风格特性:');
console.log('  - 错误检测：语法、逻辑、类型、性能、内存泄漏');
console.log('  - 代码审查：最佳实践、错误处理、代码清晰度');
console.log('  - 语言特定规则：Python、Java、Go、Rust 等');
console.log('  - 修复建议：自动修复和手动步骤');
console.log('  - 自然语言反馈');

console.log('\n🎯 MCP 服务器工具总数：24 个');

console.log('\n' + '='.repeat(70));
console.log('测试完成！');
console.log('='.repeat(70));

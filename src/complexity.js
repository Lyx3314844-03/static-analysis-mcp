/**
 * 高级代码复杂度分析模块
 * Advanced Code Complexity Analysis Module
 */

/**
 * 计算圈复杂度 (Cyclomatic Complexity)
 * 公式：M = E - N + 2P
 * E = 边数，N = 节点数，P = 连通分量数
 * 简化版：M = 决策点数量 + 1
 */
export function calculateCyclomaticComplexity(code, language) {
  let complexity = 1; // 基础复杂度

  // 通用决策点
  const decisionPoints = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\bexcept\b/g,
    /\?\s*[^:]/g, // 三元运算符
    /&&/g,
    /\|\|/g,
    /\band\b/g,
    /\bor\b/g,
  ];

  // 语言特定的决策点
  const languageSpecificPatterns = {
    javascript: [/\bswitch\b/g, /\?\./g],
    typescript: [/\bswitch\b/g, /\?\./g],
    python: [/\belif\b/g, /\bwith\b/g],
    java: [/\bswitch\b/g, /\b\?\s*:/g],
    go: [/\bselect\b/g, /\bdefer\b/g],
    rust: [/\bmatch\b/g, /\bif\s+let\b/g],
    ruby: [/\bunless\b/g, /\brescue\b/g],
    php: [/\bmatch\b/g, /\bforeach\b/g],
    swift: [/\bguard\b/g, /\bif\s+let\b/g],
    kotlin: [/\bwhen\b/g, /\?.\b/g],
  };

  const patterns = [...decisionPoints, ...(languageSpecificPatterns[language] || [])];

  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * 计算认知复杂度 (Cognitive Complexity)
 * 考虑代码的理解难度
 */
export function calculateCognitiveComplexity(code, language) {
  let complexity = 0;
  const lines = code.split('\n');

  // 嵌套深度增量
  let nestingDepth = 0;

  // 基础复杂度增量
  const incrementPatterns = [
    { pattern: /\bif\b/, increment: 1 },
    { pattern: /\belse\s+if\b/, increment: 1 },
    { pattern: /\bfor\b/, increment: 1 },
    { pattern: /\bwhile\b/, increment: 1 },
    { pattern: /\bcatch\b/, increment: 1 },
    { pattern: /\bexcept\b/, increment: 1 },
    { pattern: /\?\s*[^:]/, increment: 1 }, // 三元运算符
    { pattern: /&&/, increment: 1 },
    { pattern: /\|\|/, increment: 1 },
  ];

  // 嵌套增量模式
  const nestingPatterns = [
    /\bif\b.*\{/,
    /\bfor\b.*\{/,
    /\bwhile\b.*\{/,
    /\btry\b.*\{/,
    /\bswitch\b.*\{/,
  ];

  lines.forEach((line, index) => {
    // 计算基础增量
    for (const { pattern, increment } of incrementPatterns) {
      const matches = line.match(pattern);
      if (matches) {
        complexity += increment + nestingDepth; // 嵌套会增加复杂度
      }
    }

    // 计算嵌套深度
    for (const pattern of nestingPatterns) {
      if (pattern.test(line)) {
        nestingDepth++;
      }
    }

    // 检测嵌套减少
    const closingBraces = (line.match(/\}/g) || []).length;
    const openingBraces = (line.match(/\{/g) || []).length;
    const netChange = openingBraces - closingBraces;
    
    if (netChange < 0) {
      nestingDepth = Math.max(0, nestingDepth + netChange);
    }
  });

  return complexity;
}

/**
 * 计算 Halstead 复杂度指标
 */
export function calculateHalsteadMetrics(code) {
  // 操作符
  const operators = code.match(/[+\-*/%=<>!&|^~?:;,.()[\]{}]/g) || [];
  const uniqueOperators = [...new Set(operators)];

  // 操作数（标识符和字面量）
  const operands = code.match(/\b\w+\b/g) || [];
  const uniqueOperands = [...new Set(operands)];

  const n1 = uniqueOperators.length; // 不同操作符数
  const n2 = uniqueOperands.length; // 不同操作数数
  const N1 = operators.length; // 总操作符数
  const N2 = operands.length; // 总操作数数

  // 程序词汇表长度
  const n = n1 + n2;
  // 程序长度
  const N = N1 + N2;

  // 计算体积
  const V = N * Math.log2(n || 1);

  // 计算难度
  const D = (n1 / 2) * (N2 / (n2 || 1));

  // 计算工作量
  const E = V * D;

  // 计算时间（秒）
  const T = E / 18;

  // 估算错误数
  const B = V / 3000;

  // 可维护性指数
  const MI = 171 - 5.2 * Math.log(V) - 0.23 * D - 16.2 * Math.log(N || 1);

  return {
    n1, // 不同操作符数
    n2, // 不同操作数数
    N1, // 总操作符数
    N2, // 总操作数数
    n, // 词汇表长度
    N, // 程序长度
    V, // 体积
    D, // 难度
    E, // 工作量
    T, // 时间（秒）
    B, // 估算错误数
    MI, // 可维护性指数
  };
}

/**
 * 计算嵌套深度
 */
export function calculateNestingDepth(code) {
  let maxDepth = 0;
  let currentDepth = 0;
  let maxDepthLine = 1;
  let lineNum = 1;

  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      lineNum++;
    }

    if (code[i] === '{' || code[i] === '(' || code[i] === '[') {
      currentDepth++;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        maxDepthLine = lineNum;
      }
    } else if (code[i] === '}' || code[i] === ')' || code[i] === ']') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return {
    maxDepth,
    maxDepthLine,
    averageDepth: Math.round(maxDepth / 2),
  };
}

/**
 * 分析函数/方法复杂度
 */
export function analyzeFunctionComplexity(code, language) {
  const functions = [];

  // 不同语言的函数定义模式
  const functionPatterns = {
    javascript: [
      /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?:=>|{[\s\S]*?})/g,
      /(\w+)\s*:\s*(?:async\s+)?function\s*\([^)]*\)\s*\{([\s\S]*?)\}/g,
    ],
    typescript: [
      /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{([\s\S]*?)\}/g,
      /(?:const|let|var)\s+(\w+)\s*:\s*(?:[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?:=>|{[\s\S]*?})/g,
    ],
    python: [
      /def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*\w+)?:\s*([\s\S]*?)(?=\n(?:def|class)|$)/g,
      /async\s+def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*\w+)?:\s*([\s\S]*?)(?=\n(?:async\s+def|def|class)|$)/g,
    ],
    java: [
      /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*\{([\s\S]*?)\}/g,
    ],
    go: [
      /func\s+(?:\([^)]+\)\s*)?(\w+)\s*\([^)]*\)\s*(?:\([^)]+\))?\s*\{([\s\S]*?)\}/g,
    ],
    rust: [
      /fn\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^{]+)?\s*\{([\s\S]*?)\}/g,
    ],
  };

  const patterns = functionPatterns[language] || functionPatterns.javascript;

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(code)) !== null) {
      const functionName = match[1];
      const functionBody = match[2] || match[0];

      const cyclomatic = calculateCyclomaticComplexity(functionBody, language);
      const cognitive = calculateCognitiveComplexity(functionBody, language);
      const halstead = calculateHalsteadMetrics(functionBody);
      const nesting = calculateNestingDepth(functionBody);
      const lines = functionBody.split('\n').length;

      functions.push({
        name: functionName || 'anonymous',
        lines,
        cyclomaticComplexity: cyclomatic,
        cognitiveComplexity: cognitive,
        halsteadMetrics: halstead,
        nestingDepth: nesting.maxDepth,
        maintainabilityIndex: Math.max(0, Math.min(100, halstead.MI)),
        riskLevel: assessRisk(cyclomatic, cognitive, lines),
      });
    }
  }

  return functions;
}

/**
 * 评估风险等级
 */
function assessRisk(cyclomatic, cognitive, lines) {
  const score = cyclomatic * 2 + cognitive + Math.floor(lines / 20);

  if (score >= 30) return 'critical';
  if (score >= 20) return 'high';
  if (score >= 10) return 'medium';
  return 'low';
}

/**
 * 分析类的复杂度
 */
export function analyzeClassComplexity(code, language) {
  const classes = [];

  // 类定义模式
  const classPatterns = {
    javascript: /class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([\s\S]*?)\}/g,
    typescript: /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{([\s\S]*?)\}/g,
    python: /class\s+(\w+)(?:\s*\([^)]*\))?\s*:\s*([\s\S]*?)(?=\nclass|\Z)/g,
    java: /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{([\s\S]*?)\}/g,
  };

  const pattern = classPatterns[language] || classPatterns.javascript;
  let match;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(code)) !== null) {
    const className = match[1];
    const classBody = match[2];

    // 计算方法数量
    const methodCount = countMethods(classBody, language);
    // 计算字段数量
    const fieldCount = countFields(classBody, language);
    // 计算耦合度
    const coupling = calculateCoupling(classBody, language);

    classes.push({
      name: className,
      lines: classBody.split('\n').length,
      methodCount,
      fieldCount,
      coupling,
      cohesionScore: calculateCohesion(classBody, methodCount, fieldCount),
      riskLevel: assessClassRisk(methodCount, classBody.length),
    });
  }

  return classes;
}

/**
 * 计算方法数量
 */
function countMethods(classBody, language) {
  const methodPatterns = {
    javascript: /(?:async\s+)?\w+\s*\([^)]*\)\s*\{/g,
    python: /def\s+\w+\s*\(/g,
    java: /(?:public|private|protected)\s+\w+\s+\w+\s*\(/g,
  };

  const pattern = methodPatterns[language] || methodPatterns.javascript;
  const matches = classBody.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * 计算字段数量
 */
function countFields(classBody, language) {
  const fieldPatterns = {
    javascript: /(?:this\.)?\w+\s*=/g,
    python: /self\.\w+\s*=/g,
    java: /(?:public|private|protected)\s+\w+\s+\w+\s*;/g,
  };

  const pattern = fieldPatterns[language] || fieldPatterns.javascript;
  const matches = classBody.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * 计算耦合度
 */
function calculateCoupling(classBody, language) {
  // 计算引用的外部类/模块数量
  const importPatterns = [
    /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(['"]([^'"]+)['"]\)/g,
    /use\s+([^;]+);/g,
  ];

  let coupling = 0;
  for (const pattern of importPatterns) {
    const matches = classBody.match(pattern);
    if (matches) {
      coupling += matches.length;
    }
  }

  return coupling;
}

/**
 * 计算内聚度
 */
function calculateCohesion(classBody, methodCount, fieldCount) {
  if (methodCount === 0 || fieldCount === 0) return 100;

  // 简化的内聚度计算
  // 理想情况下，每个方法都应该使用所有字段
  const ratio = fieldCount / methodCount;

  if (ratio >= 0.5 && ratio <= 3) return 80 + Math.random() * 20;
  if (ratio >= 0.2 && ratio <= 5) return 60 + Math.random() * 20;
  return 40 + Math.random() * 20;
}

/**
 * 评估类风险
 */
function assessClassRisk(methodCount, classSize) {
  const score = methodCount * 2 + Math.floor(classSize / 100);

  if (score >= 30) return 'critical';
  if (score >= 20) return 'high';
  if (score >= 10) return 'medium';
  return 'low';
}

/**
 * 计算继承深度
 */
export function calculateInheritanceDepth(code, language) {
  const classHierarchy = new Map();
  const depths = [];

  // 提取类及其父类
  const classPatterns = {
    javascript: /class\s+(\w+)(?:\s+extends\s+(\w+))?/g,
    typescript: /class\s+(\w+)(?:\s+extends\s+(\w+))?/g,
    java: /class\s+(\w+)(?:\s+extends\s+(\w+))?/g,
    python: /class\s+(\w+)(?:\s*\(\s*(\w+)(?:\.[^(]*)?\s*\))?/g,
  };

  const pattern = classPatterns[language] || classPatterns.javascript;
  let match;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(code)) !== null) {
    const className = match[1];
    const parentClass = match[2] || null;
    classHierarchy.set(className, parentClass);
  }

  // 计算每个类的继承深度
  for (const [className] of classHierarchy) {
    let depth = 0;
    let current = className;

    while (classHierarchy.has(current)) {
      const parent = classHierarchy.get(current);
      if (!parent || parent === 'Object' || parent === 'object') break;
      depth++;
      current = parent;
    }

    depths.push({ className, depth });
  }

  return {
    classHierarchy: Object.fromEntries(classHierarchy),
    depths,
    maxDepth: Math.max(...depths.map(d => d.depth), 0),
    averageDepth: depths.length > 0
      ? Math.round(depths.reduce((sum, d) => sum + d.depth, 0) / depths.length)
      : 0,
  };
}

/**
 * 完整的复杂度分析报告
 */
export function generateComplexityReport(code, language) {
  const functions = analyzeFunctionComplexity(code, language);
  const classes = analyzeClassComplexity(code, language);
  const inheritance = calculateInheritanceDepth(code, language);
  const overallCyclomatic = calculateCyclomaticComplexity(code, language);
  const overallCognitive = calculateCognitiveComplexity(code, language);
  const halstead = calculateHalsteadMetrics(code);
  const nesting = calculateNestingDepth(code);

  // 计算整体可维护性指数
  const avgMI = functions.length > 0
    ? functions.reduce((sum, f) => sum + f.maintainabilityIndex, 0) / functions.length
    : 100;

  // 识别热点（高复杂度区域）
  const hotspots = functions
    .filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical')
    .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
    .slice(0, 10);

  return {
    summary: {
      language,
      totalLines: code.split('\n').length,
      totalFunctions: functions.length,
      totalClasses: classes.length,
      overallCyclomaticComplexity: overallCyclomatic,
      overallCognitiveComplexity: overallCognitive,
      averageMaintainabilityIndex: Math.round(avgMI),
      maxNestingDepth: nesting.maxDepth,
    },
    functions,
    classes,
    inheritance,
    halsteadMetrics: halstead,
    nesting,
    hotspots,
    recommendations: generateRecommendations(functions, classes, overallCyclomatic, nesting),
  };
}

/**
 * 生成改进建议
 */
function generateRecommendations(functions, classes, overallComplexity, nesting) {
  const recommendations = [];

  // 基于整体复杂度
  if (overallComplexity > 20) {
    recommendations.push({
      priority: 'high',
      category: 'complexity',
      message: 'Overall code complexity is high. Consider refactoring complex functions.',
    });
  }

  // 基于函数复杂度
  const complexFunctions = functions.filter(f => f.cyclomaticComplexity > 10);
  if (complexFunctions.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'refactoring',
      message: `${complexFunctions.length} function(s) have high cyclomatic complexity. Consider breaking them into smaller functions.`,
      affectedFunctions: complexFunctions.map(f => f.name),
    });
  }

  // 基于嵌套深度
  if (nesting.maxDepth > 5) {
    recommendations.push({
      priority: 'medium',
      category: 'readability',
      message: 'Deep nesting detected. Consider using early returns or extracting methods.',
    });
  }

  // 基于类复杂度
  const largeClasses = classes.filter(c => c.methodCount > 10);
  if (largeClasses.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'design',
      message: `${largeClasses.length} class(es) have too many methods. Consider applying Single Responsibility Principle.`,
      affectedClasses: largeClasses.map(c => c.name),
    });
  }

  // 基于可维护性指数
  const lowMIFunctions = functions.filter(f => f.maintainabilityIndex < 50);
  if (lowMIFunctions.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'maintainability',
      message: `${lowMIFunctions.length} function(s) have low maintainability index. Refactoring recommended.`,
    });
  }

  return recommendations;
}

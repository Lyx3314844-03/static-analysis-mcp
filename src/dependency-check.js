/**
 * 依赖检查模块
 * Dependency Check Module
 * 
 * 灵感来自 npm audit, pip-audit, Dependabot, Snyk 等工具
 * 检查依赖漏洞、过时版本、许可证问题
 */

import { SEVERITY, CATEGORY } from './analyzer.js';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 已知漏洞依赖数据库 (示例)
 * Known Vulnerable Dependencies Database (Example)
 */
const VULNERABILITY_DATABASE = {
  // JavaScript/Node.js
  javascript: {
    'lodash': [
      {
        versions: '<4.17.21',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-23337',
        title: 'Command Injection',
        description: 'Lodash versions prior to 4.17.21 are vulnerable to Command Injection via the template function.',
        fix: 'Upgrade to lodash@4.17.21 or later',
      },
      {
        versions: '<4.17.19',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2020-8203',
        title: 'Prototype Pollution',
        description: 'Lodash versions prior to 4.17.19 are vulnerable to Prototype Pollution.',
        fix: 'Upgrade to lodash@4.17.19 or later',
      },
    ],
    'axios': [
      {
        versions: '<0.21.1',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-3749',
        title: 'Inefficient Regular Expression Complexity',
        description: 'Axios versions prior to 0.21.1 are vulnerable to ReDoS.',
        fix: 'Upgrade to axios@0.21.1 or later',
      },
    ],
    'express': [
      {
        versions: '<4.17.3',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2022-24999',
        title: 'Open Redirect',
        description: 'Express versions prior to 4.17.3 are vulnerable to open redirect.',
        fix: 'Upgrade to express@4.17.3 or later',
      },
    ],
    'minimist': [
      {
        versions: '<1.2.6',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-44906',
        title: 'Prototype Pollution',
        description: 'Minimist versions prior to 1.2.6 are vulnerable to Prototype Pollution.',
        fix: 'Upgrade to minimist@1.2.6 or later',
      },
    ],
    'node-fetch': [
      {
        versions: '<2.6.7',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2022-0235',
        title: 'Exposure of Sensitive Information',
        description: 'Node-fetch versions prior to 2.6.7 are vulnerable to information exposure.',
        fix: 'Upgrade to node-fetch@2.6.7 or later',
      },
    ],
    'json5': [
      {
        versions: '<2.2.2',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-46175',
        title: 'Prototype Pollution',
        description: 'JSON5 versions prior to 2.2.2 are vulnerable to Prototype Pollution.',
        fix: 'Upgrade to json5@2.2.2 or later',
      },
    ],
    'moment': [
      {
        versions: '<2.29.4',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2022-31129',
        title: 'ReDoS',
        description: 'Moment versions prior to 2.29.4 are vulnerable to ReDoS.',
        fix: 'Upgrade to moment@2.29.4 or later, or consider using date-fns or dayjs',
      },
    ],
    'glob-parent': [
      {
        versions: '<5.1.2',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2020-28469',
        title: 'ReDoS',
        description: 'Glob-parent versions prior to 5.1.2 are vulnerable to ReDoS.',
        fix: 'Upgrade to glob-parent@5.1.2 or later',
      },
    ],
    'nanoid': [
      {
        versions: '<3.1.31',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2021-23566',
        title: 'Exposure of Sensitive Information',
        description: 'NanoID versions prior to 3.1.31 are vulnerable to information exposure.',
        fix: 'Upgrade to nanoid@3.1.31 or later',
      },
    ],
    'qs': [
      {
        versions: '<6.5.3',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-24999',
        title: 'Prototype Pollution',
        description: 'QS versions prior to 6.5.3 are vulnerable to Prototype Pollution.',
        fix: 'Upgrade to qs@6.5.3 or later',
      },
    ],
  },
  
  // Python
  python: {
    'requests': [
      {
        versions: '<2.31.0',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2023-32681',
        title: 'Proxy-Authorization Header Leak',
        description: 'Requests versions prior to 2.31.0 may leak Proxy-Authorization headers.',
        fix: 'Upgrade to requests@2.31.0 or later',
      },
    ],
    'urllib3': [
      {
        versions: '<1.26.5',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-33503',
        title: 'ReDoS',
        description: 'urllib3 versions prior to 1.26.5 are vulnerable to ReDoS.',
        fix: 'Upgrade to urllib3@1.26.5 or later',
      },
      {
        versions: '<2.0.6',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2023-43804',
        title: 'Cookie Leak',
        description: 'urllib3 versions prior to 2.0.6 may leak cookies.',
        fix: 'Upgrade to urllib3@2.0.6 or later',
      },
    ],
    'pillow': [
      {
        versions: '<9.3.0',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-45198',
        title: 'DoS',
        description: 'Pillow versions prior to 9.3.0 are vulnerable to DoS via malformed images.',
        fix: 'Upgrade to pillow@9.3.0 or later',
      },
    ],
    'pyyaml': [
      {
        versions: '<5.4',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2020-14343',
        title: 'Arbitrary Code Execution',
        description: 'PyYAML versions prior to 5.4 are vulnerable to arbitrary code execution.',
        fix: 'Upgrade to pyyaml@5.4 or later, use safe_load()',
      },
    ],
    'jinja2': [
      {
        versions: '<2.11.3',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2020-28493',
        title: 'ReDoS',
        description: 'Jinja2 versions prior to 2.11.3 are vulnerable to ReDoS.',
        fix: 'Upgrade to jinja2@2.11.3 or later',
      },
    ],
    'cryptography': [
      {
        versions: '<3.3.2',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2020-36242',
        title: 'Bleichenbacher Timing Attack',
        description: 'Cryptography versions prior to 3.3.2 are vulnerable to timing attacks.',
        fix: 'Upgrade to cryptography@3.3.2 or later',
      },
    ],
    'django': [
      {
        versions: '<3.2.4',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-33203',
        title: 'Directory Traversal',
        description: 'Django versions prior to 3.2.4 are vulnerable to directory traversal.',
        fix: 'Upgrade to django@3.2.4 or later',
      },
    ],
    'flask': [
      {
        versions: '<2.2.5',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2023-30861',
        title: 'Session Cookie Exposure',
        description: 'Flask versions prior to 2.2.5 may expose session cookies.',
        fix: 'Upgrade to flask@2.2.5 or later',
      },
    ],
    'numpy': [
      {
        versions: '<1.22.0',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2021-41496',
        title: 'Buffer Overflow',
        description: 'NumPy versions prior to 1.22.0 are vulnerable to buffer overflow.',
        fix: 'Upgrade to numpy@1.22.0 or later',
      },
    ],
    'paramiko': [
      {
        versions: '<2.10.1',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-24302',
        title: 'Race Condition',
        description: 'Paramiko versions prior to 2.10.1 are vulnerable to race condition.',
        fix: 'Upgrade to paramiko@2.10.1 or later',
      },
    ],
  },
  
  // Java
  java: {
    'log4j': [
      {
        versions: '<2.17.1',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2021-44228',
        title: 'Log4Shell RCE',
        description: 'Log4j versions prior to 2.17.1 are vulnerable to remote code execution (Log4Shell).',
        fix: 'Upgrade to log4j@2.17.1 or later immediately!',
      },
    ],
    'spring-core': [
      {
        versions: '<5.3.18',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-22965',
        title: 'Spring4Shell RCE',
        description: 'Spring Framework versions prior to 5.3.18 are vulnerable to RCE (Spring4Shell).',
        fix: 'Upgrade to spring-core@5.3.18 or later',
      },
    ],
    'jackson-databind': [
      {
        versions: '<2.13.4.1',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-42003',
        title: 'DoS',
        description: 'Jackson-databind versions prior to 2.13.4.1 are vulnerable to DoS.',
        fix: 'Upgrade to jackson-databind@2.13.4.1 or later',
      },
    ],
  },
  
  // Rust
  rust: {
    'serde': [
      {
        versions: '<1.0.149',
        severity: SEVERITY.WARNING,
        cve: 'CVE-2022-43660',
        title: 'Stack Overflow',
        description: 'Serde versions prior to 1.0.149 are vulnerable to stack overflow.',
        fix: 'Upgrade to serde@1.0.149 or later',
      },
    ],
  },
  
  // Go
  go: {
    'golang.org/x/crypto': [
      {
        versions: '<0.0.0-20220622213112',
        severity: SEVERITY.ERROR,
        cve: 'CVE-2022-27191',
        title: 'DoS',
        description: 'x/crypto versions prior to 0.0.0-20220622213112 are vulnerable to DoS.',
        fix: 'Upgrade to golang.org/x/crypto@latest',
      },
    ],
  },
};

/**
 * 许可证风险数据库
 * License Risk Database
 */
const LICENSE_RISKS = {
  // 高风险许可证
  high_risk: ['GPL-3.0', 'AGPL-3.0', 'SSPL', 'CC-BY-NC-SA'],
  // 中等风险许可证
  medium_risk: ['GPL-2.0', 'LGPL-3.0', 'MPL-2.0', 'EPL-1.0'],
  // 低风险许可证
  low_risk: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
  // 未知许可证
  unknown_risk: ['UNKNOWN', 'UNLICENSED'],
};

/**
 * 解析 package.json 版本范围
 */
function parseVersionRange(versionSpec) {
  const clean = versionSpec.replace(/^[^0-9]*/, '');
  const parts = clean.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * 比较版本
 */
function compareVersions(version1, version2) {
  const v1 = parseVersionRange(version1);
  const v2 = parseVersionRange(version2);
  
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  return v1.patch - v2.patch;
}

/**
 * 检查版本是否小于指定版本
 */
function isVersionLessThan(current, target) {
  return compareVersions(current, target) < 0;
}

/**
 * 依赖检查分析器类
 */
export class DependencyAnalyzer {
  constructor() {
    this.vulnDb = VULNERABILITY_DATABASE;
    this.licenseRisks = LICENSE_RISKS;
  }

  /**
   * 解析 package.json
   */
  parsePackageJson(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const pkg = JSON.parse(content);
      
      return {
        name: pkg.name,
        version: pkg.version,
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
        peerDependencies: pkg.peerDependencies || {},
        optionalDependencies: pkg.optionalDependencies || {},
        bundledDependencies: pkg.bundledDependencies || [],
      };
    } catch (error) {
      throw new Error(`Failed to parse package.json: ${error.message}`);
    }
  }

  /**
   * 解析 requirements.txt
   */
  parseRequirementsTxt(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const dependencies = {};
      
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        
        // 处理各种格式
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)([<>=!~]+.+)?$/);
        if (match) {
          const [, name, version] = match;
          dependencies[name.toLowerCase()] = version || '*';
        }
      });
      
      return { dependencies };
    } catch (error) {
      throw new Error(`Failed to parse requirements.txt: ${error.message}`);
    }
  }

  /**
   * 解析 pom.xml (简化版)
   */
  parsePomXml(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const dependencies = {};
      
      // 简单的 XML 解析
      const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>/gs;
      let match;
      
      while ((match = depRegex.exec(content)) !== null) {
        const [, groupId, artifactId, version] = match;
        const name = `${groupId}:${artifactId}`;
        dependencies[name] = version;
      }
      
      return { dependencies };
    } catch (error) {
      throw new Error(`Failed to parse pom.xml: ${error.message}`);
    }
  }

  /**
   * 检查依赖漏洞
   */
  checkVulnerabilities(dependencies, language) {
    const issues = [];
    const langDb = this.vulnDb[language] || {};
    
    for (const [depName, versionSpec] of Object.entries(dependencies)) {
      const cleanName = depName.toLowerCase().replace(/[@^~>=<]/g, '');
      const vulns = langDb[cleanName];
      
      if (vulns) {
        for (const vuln of vulns) {
          // 提取目标版本
          const targetVersion = vuln.versions.replace('<', '').replace('<=', '');
          const currentVersion = versionSpec.replace(/^[^0-9]*/, '');
          
          // 检查是否受影响
          if (isVersionLessThan(currentVersion, targetVersion)) {
            issues.push({
              type: 'vulnerability',
              dependency: depName,
              currentVersion: versionSpec,
              severity: vuln.severity,
              category: CATEGORY.SECURITY,
              cve: vuln.cve,
              title: vuln.title,
              message: `${depName}@${versionSpec} is vulnerable: ${vuln.title}`,
              description: vuln.description,
              fix: vuln.fix,
              fixVersion: targetVersion,
              language,
            });
          }
        }
      }
    }
    
    return issues;
  }

  /**
   * 检查过时依赖 (模拟)
   */
  checkOutdated(dependencies, language) {
    const issues = [];
    
    // 这里应该调用 npm outdated 或 pip list --outdated
    // 简化实现：检查版本是否包含范围符号
    for (const [depName, versionSpec] of Object.entries(dependencies)) {
      if (versionSpec.startsWith('^') || versionSpec.startsWith('~')) {
        issues.push({
          type: 'outdated',
          dependency: depName,
          currentVersion: versionSpec,
          severity: SEVERITY.HINT,
          category: CATEGORY.MAINTAINABILITY,
          message: `${depName} version constraint allows updates`,
          description: 'Consider updating to the latest stable version',
          fix: `Run 'npm update ${depName}' or 'pip install --upgrade ${depName}'`,
          language,
        });
      }
    }
    
    return issues;
  }

  /**
   * 检查许可证风险
   */
  checkLicenses(dependencies, licenses = {}) {
    const issues = [];
    
    for (const [depName, license] of Object.entries(licenses)) {
      const cleanLicense = license.toUpperCase();
      
      if (this.licenseRisks.high_risk.includes(cleanLicense)) {
        issues.push({
          type: 'license',
          dependency: depName,
          license,
          severity: SEVERITY.ERROR,
          category: CATEGORY.SECURITY,
          message: `${depName} uses high-risk license: ${license}`,
          description: 'This license may require you to open source your code or has other restrictions.',
          fix: 'Consider finding an alternative package with a more permissive license.',
          riskLevel: 'high',
        });
      } else if (this.licenseRisks.medium_risk.includes(cleanLicense)) {
        issues.push({
          type: 'license',
          dependency: depName,
          license,
          severity: SEVERITY.WARNING,
          category: CATEGORY.SECURITY,
          message: `${depName} uses medium-risk license: ${license}`,
          description: 'This license has some restrictions. Review carefully.',
          fix: 'Review license terms and ensure compliance.',
          riskLevel: 'medium',
        });
      } else if (this.licenseRisks.unknown_risk.includes(cleanLicense)) {
        issues.push({
          type: 'license',
          dependency: depName,
          license,
          severity: SEVERITY.WARNING,
          category: CATEGORY.SECURITY,
          message: `${depName} has unknown license: ${license}`,
          description: 'The license is unknown. This could be risky.',
          fix: 'Investigate the license terms before using in production.',
          riskLevel: 'unknown',
        });
      }
    }
    
    return issues;
  }

  /**
   * 分析项目依赖
   */
  async analyzeProject(projectPath) {
    const issues = [];
    const results = {
      projectPath,
      files: [],
      issues: [],
      summary: {},
    };
    
    // 检测项目类型并解析依赖
    const packageJsonPath = join(projectPath, 'package.json');
    const requirementsPath = join(projectPath, 'requirements.txt');
    const pomXmlPath = join(projectPath, 'pom.xml');
    
    let dependencies = {};
    let language = 'unknown';
    
    if (existsSync(packageJsonPath)) {
      const pkg = this.parsePackageJson(packageJsonPath);
      dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      language = 'javascript';
      results.files.push('package.json');
    } else if (existsSync(requirementsPath)) {
      const reqs = this.parseRequirementsTxt(requirementsPath);
      dependencies = reqs.dependencies;
      language = 'python';
      results.files.push('requirements.txt');
    } else if (existsSync(pomXmlPath)) {
      const pom = this.parsePomXml(pomXmlPath);
      dependencies = pom.dependencies;
      language = 'java';
      results.files.push('pom.xml');
    }
    
    if (language === 'unknown') {
      throw new Error('No supported dependency file found (package.json, requirements.txt, or pom.xml)');
    }
    
    // 检查漏洞
    const vulnIssues = this.checkVulnerabilities(dependencies, language);
    issues.push(...vulnIssues);
    
    // 检查过时
    const outdatedIssues = this.checkOutdated(dependencies, language);
    issues.push(...outdatedIssues);
    
    results.issues = issues;
    results.summary = {
      totalDependencies: Object.keys(dependencies).length,
      totalIssues: issues.length,
      bySeverity: {
        [SEVERITY.ERROR]: issues.filter(i => i.severity === SEVERITY.ERROR).length,
        [SEVERITY.WARNING]: issues.filter(i => i.severity === SEVERITY.WARNING).length,
        [SEVERITY.HINT]: issues.filter(i => i.severity === SEVERITY.HINT).length,
      },
      byType: {
        vulnerability: issues.filter(i => i.type === 'vulnerability').length,
        outdated: issues.filter(i => i.type === 'outdated').length,
        license: issues.filter(i => i.type === 'license').length,
      },
      language,
    };
    
    return results;
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions(issues) {
    const suggestions = [];
    
    // 按严重性排序
    const sortedIssues = [...issues].sort((a, b) => {
      const severityOrder = { [SEVERITY.ERROR]: 0, [SEVERITY.WARNING]: 1, [SEVERITY.HINT]: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    for (const issue of sortedIssues) {
      suggestions.push({
        dependency: issue.dependency,
        type: issue.type,
        severity: issue.severity,
        currentVersion: issue.currentVersion,
        fixVersion: issue.fixVersion,
        command: this.generateFixCommand(issue),
        description: issue.fix || issue.description,
        priority: this.calculatePriority(issue),
      });
    }
    
    return suggestions;
  }

  /**
   * 生成修复命令
   */
  generateFixCommand(issue) {
    switch (issue.language) {
      case 'javascript':
        if (issue.fixVersion) {
          return `npm install ${issue.dependency}@${issue.fixVersion}`;
        }
        return `npm update ${issue.dependency}`;
      
      case 'python':
        if (issue.fixVersion) {
          return `pip install "${issue.dependency}>=${issue.fixVersion}"`;
        }
        return `pip install --upgrade ${issue.dependency}`;
      
      case 'java':
        if (issue.fixVersion) {
          return `Update ${issue.dependency} version to ${issue.fixVersion} in pom.xml`;
        }
        return `Run 'mvn versions:display-dependency-updates'`;
      
      default:
        return issue.fix || 'Manual update required';
    }
  }

  /**
   * 计算修复优先级
   */
  calculatePriority(issue) {
    if (issue.severity === SEVERITY.ERROR && issue.type === 'vulnerability') {
      return 'critical';
    }
    if (issue.severity === SEVERITY.ERROR) {
      return 'high';
    }
    if (issue.severity === SEVERITY.WARNING) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 获取支持的检查类型
   */
  getSupportedChecks() {
    return {
      vulnerability: {
        description: 'Check for known security vulnerabilities',
        languages: Object.keys(this.vulnDb),
      },
      outdated: {
        description: 'Check for outdated dependencies',
        languages: ['javascript', 'python', 'java', 'go', 'rust'],
      },
      license: {
        description: 'Check for license risks',
        languages: ['all'],
      },
    };
  }
}

/**
 * 生成依赖检查报告
 */
export function generateDependencyReport(results) {
  const report = {
    ...results,
    timestamp: new Date().toISOString(),
    recommendations: [],
  };
  
  // 生成建议
  const analyzer = new DependencyAnalyzer();
  report.recommendations = analyzer.generateFixSuggestions(results.issues);
  
  // 添加总体建议
  if (results.summary.byType.vulnerability > 0) {
    report.recommendations.unshift({
      type: 'general',
      priority: 'critical',
      description: `Found ${results.summary.byType.vulnerability} vulnerable dependencies. Update immediately!`,
    });
  }
  
  return report;
}

export { VULNERABILITY_DATABASE, LICENSE_RISKS };

/**
 * 依赖安装包检查模块
 * Package Installation Check Module
 * 
 * 检查各种语言的依赖包安装状态
 * 支持：npm, pip, maven, cargo, go modules
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

/**
 * 包管理器配置
 */
const PACKAGE_MANAGERS = {
  npm: {
    lockFile: 'package-lock.json',
    altLockFile: 'yarn.lock',
    installCommand: 'npm install',
    listCommand: 'npm list --depth=0 --json',
    outdatedCommand: 'npm outdated --json',
    auditCommand: 'npm audit --json',
    language: 'javascript',
  },
  yarn: {
    lockFile: 'yarn.lock',
    installCommand: 'yarn install',
    listCommand: 'yarn list --depth=1 --json',
    outdatedCommand: 'yarn outdated --json',
    language: 'javascript',
  },
  pip: {
    lockFile: 'requirements.txt',
    altLockFile: 'Pipfile.lock',
    installCommand: 'pip install -r requirements.txt',
    listCommand: 'pip list --format=json',
    outdatedCommand: 'pip list --outdated --format=json',
    language: 'python',
  },
  pipenv: {
    lockFile: 'Pipfile.lock',
    installCommand: 'pipenv install',
    listCommand: 'pipenv graph --json',
    language: 'python',
  },
  poetry: {
    lockFile: 'poetry.lock',
    installCommand: 'poetry install',
    listCommand: 'poetry show --format=json',
    language: 'python',
  },
  maven: {
    lockFile: 'pom.xml',
    installCommand: 'mvn install',
    listCommand: 'mvn dependency:list',
    language: 'java',
  },
  gradle: {
    lockFile: 'build.gradle',
    altLockFile: 'build.gradle.kts',
    installCommand: 'gradle build',
    listCommand: 'gradle dependencies',
    language: 'java',
  },
  cargo: {
    lockFile: 'Cargo.lock',
    installCommand: 'cargo build',
    listCommand: 'cargo tree --depth=1',
    language: 'rust',
  },
  go: {
    lockFile: 'go.sum',
    installCommand: 'go mod download',
    listCommand: 'go list -m all',
    language: 'go',
  },
  composer: {
    lockFile: 'composer.lock',
    installCommand: 'composer install',
    listCommand: 'composer show --format=json',
    language: 'php',
  },
  bundle: {
    lockFile: 'Gemfile.lock',
    installCommand: 'bundle install',
    listCommand: 'bundle list --format=json',
    language: 'ruby',
  },
};

/**
 * 包安装检查器类
 */
export class PackageInstallerChecker {
  constructor() {
    this.packageManagers = PACKAGE_MANAGERS;
  }

  /**
   * 检测项目使用的包管理器
   */
  detectPackageManager(projectPath) {
    const detected = [];

    for (const [name, config] of Object.entries(this.packageManagers)) {
      const lockFilePath = join(projectPath, config.lockFile);
      const altLockFilePath = config.altLockFile 
        ? join(projectPath, config.altLockFile) 
        : null;

      if (existsSync(lockFilePath) || (altLockFilePath && existsSync(altLockFilePath))) {
        detected.push({
          name,
          config,
          lockFile: existsSync(lockFilePath) ? config.lockFile : config.altLockFile,
          confidence: 'high',
        });
      }
    }

    // 检测 node_modules 文件夹
    if (existsSync(join(projectPath, 'node_modules'))) {
      if (!detected.find(d => d.config.language === 'javascript')) {
        detected.push({
          name: 'npm',
          config: this.packageManagers.npm,
          lockFile: 'node_modules',
          confidence: 'medium',
        });
      }
    }

    // 检测 __pycache__ 或 venv
    if (existsSync(join(projectPath, '__pycache__')) || 
        existsSync(join(projectPath, 'venv')) ||
        existsSync(join(projectPath, '.venv'))) {
      if (!detected.find(d => d.config.language === 'python')) {
        detected.push({
          name: 'pip',
          config: this.packageManagers.pip,
          lockFile: 'venv',
          confidence: 'medium',
        });
      }
    }

    return detected;
  }

  /**
   * 检查依赖包是否已安装
   */
  checkPackagesInstalled(projectPath, packageManager = 'auto') {
    const results = {
      projectPath,
      packageManagers: [],
      issues: [],
      summary: {},
    };

    let managers = [];

    if (packageManager === 'auto') {
      managers = this.detectPackageManager(projectPath);
    } else if (this.packageManagers[packageManager]) {
      managers = [{
        name: packageManager,
        config: this.packageManagers[packageManager],
        confidence: 'high',
      }];
    }

    results.packageManagers = managers;

    for (const manager of managers) {
      const checkResult = this.checkManagerPackages(projectPath, manager);
      results.issues.push(...checkResult.issues);
    }

    results.summary = {
      totalManagers: managers.length,
      totalIssues: results.issues.length,
      byType: {
        missing: results.issues.filter(i => i.type === 'missing').length,
        corrupted: results.issues.filter(i => i.type === 'corrupted').length,
        outdated: results.issues.filter(i => i.type === 'outdated').length,
      },
    };

    return results;
  }

  /**
   * 检查特定包管理器的包安装状态
   */
  checkManagerPackages(projectPath, manager) {
    const issues = [];
    const lockFilePath = join(projectPath, manager.lockFile);

    // 检查锁文件是否存在
    if (!existsSync(lockFilePath) && manager.name !== 'npm') {
      issues.push({
        type: 'missing',
        severity: 'error',
        manager: manager.name,
        message: `Lock file not found: ${manager.lockFile}`,
        suggestion: `Run '${manager.config.installCommand}' to install dependencies`,
      });
    }

    // 检查 node_modules 或等效目录
    const moduleDirs = this.getModuleDirectories(projectPath, manager.config.language);
    
    if (moduleDirs.expected && !moduleDirs.exists) {
      issues.push({
        type: 'missing',
        severity: 'error',
        manager: manager.name,
        message: `Dependencies not installed (${moduleDirs.dirName})`,
        suggestion: `Run '${manager.config.installCommand}' to install dependencies`,
      });
    }

    // 尝试运行包管理器命令检查
    try {
      const listOutput = this.runPackageManagerCommand(projectPath, manager.config.listCommand);
      if (listOutput) {
        const parseResult = this.parsePackageList(listOutput, manager.name);
        issues.push(...parseResult);
      }
    } catch (error) {
      // 命令执行失败，可能是包管理器未安装
      issues.push({
        type: 'missing',
        severity: 'warning',
        manager: manager.name,
        message: `Package manager '${manager.name}' command failed: ${error.message}`,
        suggestion: `Ensure ${manager.name} is installed and in PATH`,
      });
    }

    return { issues };
  }

  /**
   * 获取模块目录信息
   */
  getModuleDirectories(projectPath, language) {
    const dirMap = {
      javascript: 'node_modules',
      python: ['site-packages', 'dist-packages'],
      java: ['target', 'build'],
      rust: 'target',
      go: 'pkg',
      php: 'vendor',
      ruby: 'vendor',
    };

    const dirNames = dirMap[language];
    const expectedDirs = Array.isArray(dirNames) ? dirNames : [dirNames];
    
    let exists = false;
    for (const dirName of expectedDirs) {
      if (existsSync(join(projectPath, dirName))) {
        exists = true;
        break;
      }
    }

    return {
      dirName: Array.isArray(dirNames) ? dirNames[0] : dirNames,
      expected: true,
      exists,
    };
  }

  /**
   * 运行包管理器命令
   */
  runPackageManagerCommand(projectPath, command) {
    try {
      const output = execSync(command, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });
      return output;
    } catch (error) {
      // 有些命令在没有包时会返回非零退出码
      if (error.stdout) {
        return error.stdout;
      }
      throw error;
    }
  }

  /**
   * 解析包列表输出
   */
  parsePackageList(output, managerName) {
    const issues = [];

    try {
      // 尝试解析 JSON 输出
      const json = JSON.parse(output);
      
      if (managerName === 'npm') {
        // npm list --json 格式
        if (json.dependencies) {
          const deps = Object.keys(json.dependencies);
          if (deps.length === 0) {
            issues.push({
              type: 'missing',
              severity: 'warning',
              manager: managerName,
              message: 'No dependencies installed',
              suggestion: 'Run npm install to install dependencies',
            });
          }
        }
      } else if (managerName === 'pip') {
        // pip list --format=json 格式
        if (Array.isArray(json) && json.length === 0) {
          issues.push({
            type: 'missing',
            severity: 'warning',
            manager: managerName,
            message: 'No packages installed in environment',
            suggestion: 'Run pip install -r requirements.txt',
          });
        }
      }
    } catch (e) {
      // 不是 JSON 格式，尝试解析文本输出
      const lines = output.split('\n');
      if (lines.length < 3) {
        issues.push({
          type: 'corrupted',
          severity: 'warning',
          manager: managerName,
          message: 'Package list appears to be empty or corrupted',
          suggestion: 'Reinstall dependencies',
        });
      }
    }

    return issues;
  }

  /**
   * 检查虚拟环境/容器状态
   */
  checkVirtualEnvironment(projectPath, language) {
    const issues = [];
    const envConfigs = {
      python: {
        dirs: ['venv', '.venv', 'env', '.env', 'virtualenv'],
        indicator: 'pyvenv.cfg',
      },
      node: {
        dirs: ['node_modules'],
        indicator: '.npmrc',
      },
      ruby: {
        dirs: ['.bundle', 'vendor'],
        indicator: '.ruby-version',
      },
    };

    const config = envConfigs[language];
    if (!config) return issues;

    let hasEnv = false;
    for (const dir of config.dirs) {
      if (existsSync(join(projectPath, dir))) {
        hasEnv = true;
        break;
      }
    }

    if (!hasEnv && language === 'python') {
      issues.push({
        type: 'recommendation',
        severity: 'hint',
        category: 'environment',
        message: 'No virtual environment detected for Python project',
        suggestion: 'Consider creating a virtual environment (python -m venv venv)',
      });
    }

    return issues;
  }

  /**
   * 获取安装建议
   */
  getInstallationSuggestions(issues) {
    const suggestions = [];
    const managers = new Set();

    for (const issue of issues) {
      if (issue.type === 'missing' && issue.manager) {
        managers.add(issue.manager);
      }

      suggestions.push({
        type: issue.type,
        severity: issue.severity,
        manager: issue.manager,
        command: issue.suggestion,
        description: issue.message,
      });
    }

    // 为每个包管理器生成安装命令
    for (const manager of managers) {
      const config = this.packageManagers[manager];
      if (config) {
        suggestions.push({
          type: 'install',
          severity: 'info',
          manager,
          command: config.installCommand,
          description: `Install dependencies using ${manager}`,
          isPrimary: true,
        });
      }
    }

    return suggestions;
  }

  /**
   * 获取支持的包管理器列表
   */
  getSupportedManagers() {
    return Object.entries(this.packageManagers).map(([name, config]) => ({
      name,
      language: config.language,
      lockFile: config.lockFile,
      installCommand: config.installCommand,
    }));
  }
}

/**
 * 生成包安装检查报告
 */
export function generatePackageCheckReport(results) {
  const report = {
    ...results,
    timestamp: new Date().toISOString(),
    suggestions: [],
  };

  const checker = new PackageInstallerChecker();
  report.suggestions = checker.getInstallationSuggestions(results.issues);

  // 添加总体建议
  if (results.summary.byType.missing > 0) {
    report.suggestions.unshift({
      type: 'general',
      priority: 'high',
      description: `Found ${results.summary.byType.missing} missing dependency issues. Install dependencies first.`,
    });
  }

  return report;
}

export { PACKAGE_MANAGERS };

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const RUNTIME_CATALOG = [
  { name: 'node', label: 'Node.js', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'npm', label: 'npm', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'npx', label: 'npx', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'pnpm', label: 'pnpm', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'yarn', label: 'yarn', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'bun', label: 'Bun', versionArgs: ['--version'], ecosystem: 'node' },
  { name: 'python', label: 'Python', versionArgs: ['--version'], ecosystem: 'python' },
  { name: 'python3', label: 'Python 3', versionArgs: ['--version'], ecosystem: 'python' },
  { name: 'pip', label: 'pip', versionArgs: ['--version'], ecosystem: 'python' },
  { name: 'uv', label: 'uv', versionArgs: ['--version'], ecosystem: 'python' },
  { name: 'uvx', label: 'uvx', versionArgs: ['--version'], ecosystem: 'python' },
  { name: 'go', label: 'Go', versionArgs: ['version'], ecosystem: 'go' },
  { name: 'cargo', label: 'cargo', versionArgs: ['--version'], ecosystem: 'rust' },
  { name: 'rustc', label: 'rustc', versionArgs: ['--version'], ecosystem: 'rust' },
  { name: 'java', label: 'Java', versionArgs: ['-version'], ecosystem: 'java' },
  { name: 'javac', label: 'javac', versionArgs: ['-version'], ecosystem: 'java' },
  { name: 'php', label: 'PHP', versionArgs: ['--version'], ecosystem: 'php' },
  { name: 'ruby', label: 'Ruby', versionArgs: ['--version'], ecosystem: 'ruby' },
  { name: 'bash', label: 'Bash', versionArgs: ['--version'], ecosystem: 'shell' },
  { name: 'sh', label: 'sh', versionArgs: ['--version'], ecosystem: 'shell' },
  { name: 'dotnet', label: '.NET', versionArgs: ['--version'], ecosystem: 'dotnet' },
];

const MANIFEST_FILES = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'requirements.txt',
  'pyproject.toml',
  'uv.lock',
  'Pipfile',
  'Pipfile.lock',
  'poetry.lock',
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'Gemfile',
];

function runCommand(command, args = []) {
  const rendered = `${command} ${args.join(' ')}`.trim();
  return execSync(rendered, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    timeout: 5000,
    windowsHide: true,
  }).trim();
}

function commandExists(command) {
  try {
    const lookup = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    const output = runCommand(lookup);
    return output.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function detectPackageManager(projectPath) {
  const checks = [
    ['pnpm-lock.yaml', 'pnpm install'],
    ['yarn.lock', 'yarn install'],
    ['bun.lockb', 'bun install'],
    ['bun.lock', 'bun install'],
    ['package-lock.json', 'npm install'],
    ['package.json', 'npm install'],
    ['uv.lock', 'uv sync'],
    ['poetry.lock', 'poetry install'],
    ['Pipfile.lock', 'pipenv install'],
    ['requirements.txt', 'pip install -r requirements.txt'],
    ['Cargo.toml', 'cargo build'],
    ['go.mod', 'go mod download'],
    ['pom.xml', 'mvn dependency:resolve'],
    ['build.gradle', 'gradle build'],
    ['build.gradle.kts', 'gradle build'],
  ];

  for (const [fileName, installCommand] of checks) {
    if (existsSync(join(projectPath, fileName))) {
      return { fileName, installCommand };
    }
  }

  return null;
}

export function detectRuntimes() {
  return RUNTIME_CATALOG.map(runtime => {
    const binaryPath = commandExists(runtime.name);
    let version = null;

    if (binaryPath) {
      try {
        version = runCommand(runtime.name, runtime.versionArgs).split(/\r?\n/).find(Boolean) || null;
      } catch {
        version = null;
      }
    }

    return {
      name: runtime.name,
      label: runtime.label,
      ecosystem: runtime.ecosystem,
      available: Boolean(binaryPath),
      path: binaryPath,
      version,
    };
  });
}

export function diagnoseProjectEnvironment(projectPath, options = {}) {
  const absolutePath = resolve(projectPath);
  const manifests = MANIFEST_FILES.filter(file => existsSync(join(absolutePath, file)));
  const runtimes = detectRuntimes();
  const packageManager = detectPackageManager(absolutePath);
  const issues = [];
  const warnings = [];
  const suggestions = [];

  const packageJson = readJson(join(absolutePath, 'package.json'));
  const hasNodeManifest = manifests.includes('package.json');
  const hasPythonManifest = manifests.includes('requirements.txt') || manifests.includes('pyproject.toml') || manifests.includes('uv.lock');
  const hasNodeModules = existsSync(join(absolutePath, 'node_modules'));
  const hasVirtualEnv = ['.venv', 'venv'].some(dir => existsSync(join(absolutePath, dir)));

  if (hasNodeManifest) {
    const declaredDependencies = Object.keys(packageJson?.dependencies || {}).length + Object.keys(packageJson?.devDependencies || {}).length;
    if (declaredDependencies > 0 && !hasNodeModules) {
      issues.push('Node.js dependencies are declared but node_modules is missing.');
      suggestions.push(packageManager?.installCommand || 'npm install');
    }
  }

  if (hasPythonManifest && !hasVirtualEnv) {
    warnings.push('Python project detected but no virtual environment directory was found.');
    suggestions.push(packageManager?.installCommand || 'pip install -r requirements.txt');
  }

  if (hasNodeManifest && !runtimes.find(runtime => runtime.name === 'node')?.available) {
    issues.push('Node.js runtime is required by this project but not available in PATH.');
  }

  if (hasPythonManifest && !runtimes.some(runtime => ['python', 'python3', 'uv'].includes(runtime.name) && runtime.available)) {
    issues.push('Python runtime is required by this project but neither python nor uv is available.');
  }

  return {
    projectPath: absolutePath,
    manifests,
    packageManager,
    runtimes,
    issues,
    warnings,
    suggestions: [...new Set(suggestions)],
    status: issues.length > 0 ? 'issues' : warnings.length > 0 ? 'warning' : 'ok',
  };
}

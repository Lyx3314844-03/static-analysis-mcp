import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { analyzeProject } from '../src/project-analyzer.js';

function commandUsable(commands, probes = [['--version']]) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const fallbackMap = {
    bash: [path.join(systemRoot, 'System32', 'bash.exe')],
  };

  for (const command of commands) {
    const candidates = [command, ...(fallbackMap[command] || [])];
    for (const candidate of candidates) {
      if (candidate.includes(path.sep) && !existsSync(candidate)) {
        continue;
      }

      for (const args of probes) {
        const result = spawnSync(candidate, args, {
          encoding: 'utf-8',
          windowsHide: true,
          timeout: 5000,
        });
        if (result.status === 0) {
          return true;
        }
      }
    }
  }

  return false;
}

const bashAvailable = commandUsable(['bash'], [['--version'], ['--help']]);
const rubyAvailable = commandUsable(['ruby'], [['--version'], ['-v']]);
const clangAvailable = commandUsable(['clang', 'gcc'], [['--version']]);
const clangxxAvailable = commandUsable(['clang++', 'g++'], [['--version']]);
const csharpAvailable = commandUsable(['csc'], [['-help'], ['/?']]) || commandUsable(['dotnet'], [['--version']]);
const kotlinAvailable = commandUsable(['kotlinc'], [['-version']]);
const swiftAvailable = commandUsable(['swiftc'], [['--version']]);

const pythonYamlAvailable = (() => {
  const python = commandUsable(['python', 'python3'], [['--version'], ['-V']]);
  if (!python) return false;
  return spawnSync('python', ['-c', 'import yaml'], {
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 5000,
  }).status === 0 || spawnSync('python3', ['-c', 'import yaml'], {
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 5000,
  }).status === 0;
})();

test('analyzeProject returns diagnostics, issues, and hotspots for a mixed JS/TS project', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'demo-analysis-project',
      dependencies: {
        lodash: '^4.17.0',
      },
    }));
    await writeFile(path.join(projectDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
      },
      include: ['src/**/*'],
    }));
    await writeFile(path.join(projectDir, 'src', 'bad.ts'), `
      export function broken(value: number): number {
        console.log(value);
        return "oops";
      }
    `);
    await writeFile(path.join(projectDir, 'src', 'smelly.js'), `
      function veryLongFunction(input) {
        console.log(input);
        if (input) {
          if (input.foo) {
            if (input.foo.bar) {
              return 123456;
            }
          }
        }
        return 0;
      }
      export { veryLongFunction };
    `);

    const report = await analyzeProject(projectDir, { maxFiles: 20 });

    assert.ok(report.filesAnalyzed >= 2);
    assert.ok(report.summary.totalIssues > 0);
    assert.ok(report.diagnostics.length > 0);
    assert.ok(report.hotspots.length > 0);
    assert.ok(typeof report.scores.qualityScore === 'number');
    assert.ok(report.qualityGate.status === 'fail' || report.qualityGate.status === 'warn');
    assert.ok(report.actionPlan.length > 0);
    assert.ok(report.toolchain.issues.some(issue => issue.includes('node_modules')));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes Python syntax diagnostics when Python files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-python-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.py'), `
def broken_function()
    return 1
`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.py'] });
    const pythonDiagnostics = report.diagnostics.filter(diagnostic => diagnostic.source === 'python-ast');

    assert.ok(pythonDiagnostics.length > 0);
    assert.equal(pythonDiagnostics[0].severity, 'error');
    assert.ok(report.qualityGate.status === 'fail' || report.qualityGate.status === 'warn');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes JSON parse diagnostics when json files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-json-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.json'), `{"name": "demo", "items": [1, 2, }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.json'] });
    const jsonDiagnostics = report.diagnostics.filter(diagnostic => diagnostic.source === 'json-parser');

    assert.ok(jsonDiagnostics.length > 0);
    assert.equal(jsonDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes TOML parse diagnostics when toml files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-toml-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.toml'), `name = "demo"\nlist = [1, 2,, 3]`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.toml'] });
    const tomlDiagnostics = report.diagnostics.filter(diagnostic => diagnostic.source === 'toml-parser');

    assert.ok(tomlDiagnostics.length > 0);
    assert.equal(tomlDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes XML parse diagnostics when xml files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-xml-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.xml'), `<root><item></root>`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.xml'] });
    const xmlDiagnostics = report.diagnostics.filter(diagnostic => diagnostic.source === 'xml-parser');

    assert.ok(xmlDiagnostics.length > 0);
    assert.equal(xmlDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes shell syntax diagnostics when shell files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-shell-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.sh'), `if [ "$x" = "1" ]; then\necho ok\n`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.sh'] });
    const shellDiagnostics = report.diagnostics.filter(diagnostic => ['shell-syntax', 'shell-fallback'].includes(diagnostic.source));

    assert.ok(shellDiagnostics.length > 0);
    assert.equal(shellDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes YAML parse diagnostics when yaml files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-yaml-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.yaml'), `root:\n  - valid\n  : invalid`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.yaml'] });
    const yamlDiagnostics = report.diagnostics.filter(diagnostic => ['yaml-ruby', 'yaml-python', 'yaml-fallback'].includes(diagnostic.source));

    assert.ok(yamlDiagnostics.length > 0);
    assert.equal(yamlDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes C syntax diagnostics when c files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-c-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.c'), `int main( { return 0; }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.c'] });
    const cDiagnostics = report.diagnostics.filter(diagnostic => ['c-compile', 'c-fallback'].includes(diagnostic.source));

    assert.ok(cDiagnostics.length > 0);
    assert.equal(cDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes C++ syntax diagnostics when cpp files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-cpp-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.cpp'), `int main( { return 0; }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.cpp'] });
    const cppDiagnostics = report.diagnostics.filter(diagnostic => ['cpp-compile', 'cpp-fallback'].includes(diagnostic.source));

    assert.ok(cppDiagnostics.length > 0);
    assert.equal(cppDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes C# syntax diagnostics when cs files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-csharp-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.cs'), `class Demo { static void Main( { } }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.cs'] });
    const csDiagnostics = report.diagnostics.filter(diagnostic => ['csharp-compile', 'dotnet-build', 'csharp-fallback'].includes(diagnostic.source));

    assert.ok(csDiagnostics.length > 0);
    assert.equal(csDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes Kotlin syntax diagnostics when kt files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-kotlin-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.kt'), `fun main( { println("x") }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.kt'] });
    const kotlinDiagnostics = report.diagnostics.filter(diagnostic => ['kotlinc', 'kotlin-fallback'].includes(diagnostic.source));

    assert.ok(kotlinDiagnostics.length > 0);
    assert.equal(kotlinDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('analyzeProject includes Swift syntax diagnostics when swift files are invalid', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-swift-project-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'src', 'broken.swift'), `func main( { print("x") }`);

    const report = await analyzeProject(projectDir, { maxFiles: 20, extensions: ['.swift'] });
    const swiftDiagnostics = report.diagnostics.filter(diagnostic => ['swiftc', 'swift-fallback'].includes(diagnostic.source));

    assert.ok(swiftDiagnostics.length > 0);
    assert.equal(swiftDiagnostics[0].severity, 'error');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

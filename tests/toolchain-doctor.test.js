import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { diagnoseProjectEnvironment } from '../src/toolchain-doctor.js';

test('diagnoseProjectEnvironment flags missing node_modules for node projects', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-toolchain-'));

  try {
    await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'demo-project',
      dependencies: {
        lodash: '^4.17.0',
      },
    }));

    const report = diagnoseProjectEnvironment(projectDir);

    assert.equal(report.status, 'issues');
    assert.ok(report.issues.some(issue => issue.includes('node_modules')));
    assert.ok(report.suggestions.some(suggestion => suggestion.includes('install')));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

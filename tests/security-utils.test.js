import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonStringify } from '../src/security-utils.js';

test('safeJsonStringify preserves nested objects within max depth', () => {
  const payload = {
    summary: {
      scores: {
        qualityScore: 80,
        riskLevel: 'low',
      },
      qualityGate: {
        status: 'warn',
      },
    },
  };

  const parsed = JSON.parse(safeJsonStringify(payload));
  assert.equal(parsed.summary.scores.qualityScore, 80);
  assert.equal(parsed.summary.qualityGate.status, 'warn');
});

test('safeJsonStringify handles circular references', () => {
  const payload = { name: 'root' };
  payload.self = payload;

  const parsed = JSON.parse(safeJsonStringify(payload));
  assert.equal(parsed.name, 'root');
  assert.equal(parsed.self, '[Circular Reference]');
});

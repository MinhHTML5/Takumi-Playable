// test/rng.test.js
//
// Unit tests for the seedable deterministic RNG (T1) plus the INV-2 core-purity
// guard. Run via `npm test` (equivalently `node --test`).
//
// Covers: determinism (same seed => identical sequences), seed sensitivity
// (different seeds differ), next() range [0,1), nextInt bounds and reachability
// including the single-value range, and a scan asserting no src/core/ module
// reads randomness or the wall-clock directly (INV-2 / R4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createRng } from '../src/core/rng.js';
import defaultCreateRng from '../src/core/rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(HERE, '..', 'src', 'core');

const N = 500; // sample size for statistical/bounds checks

// Recursively collect every *.js file under a directory.
function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

test('exports a createRng factory (named and default)', () => {
  assert.equal(typeof createRng, 'function', 'named export must be a function');
  assert.equal(defaultCreateRng, createRng, 'default export must equal the named export');
  const rng = createRng(1);
  assert.equal(typeof rng.next, 'function', 'instance must expose next()');
  assert.equal(typeof rng.nextInt, 'function', 'instance must expose nextInt()');
});

test('determinism: same seed yields identical next() sequences', () => {
  const a = createRng(1234);
  const b = createRng(1234);
  for (let i = 0; i < N; i++) {
    assert.equal(a.next(), b.next(), `next() draw ${i} must match for equal seeds`);
  }
});

test('determinism: same seed yields identical nextInt() sequences', () => {
  const a = createRng(1234);
  const b = createRng(1234);
  for (let i = 0; i < N; i++) {
    assert.equal(
      a.nextInt(1, 30),
      b.nextInt(1, 30),
      `nextInt(1,30) draw ${i} must match for equal seeds`,
    );
  }
});

test('per-instance state is isolated (advancing one does not affect another)', () => {
  const a = createRng(42);
  const b = createRng(42);
  // Advance `a` several steps; `b` must still reproduce the sequence from step 0.
  const aFirst = [a.next(), a.next(), a.next()];
  const bFirst = [b.next(), b.next(), b.next()];
  assert.deepEqual(bFirst, aFirst, 'independent instances share no mutable state');
});

test('seed sensitivity: different seeds produce non-identical sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: N }, () => a.next());
  const seqB = Array.from({ length: N }, () => b.next());
  assert.notDeepEqual(seqA, seqB, 'distinct seeds must not yield identical draws');
});

test('next() is always a float in [0, 1)', () => {
  const rng = createRng(9999);
  for (let i = 0; i < N; i++) {
    const v = rng.next();
    assert.equal(typeof v, 'number', 'next() must return a number');
    assert.ok(Number.isFinite(v), 'next() must be finite');
    assert.ok(v >= 0, `next() must be >= 0 (got ${v})`);
    assert.ok(v < 1, `next() must be < 1 (got ${v})`);
  }
});

test('nextInt(1,30): every draw is an integer within [1,30]', () => {
  const rng = createRng(7);
  for (let i = 0; i < N; i++) {
    const v = rng.nextInt(1, 30);
    assert.ok(Number.isInteger(v), `nextInt must return an integer (got ${v})`);
    assert.ok(v >= 1 && v <= 30, `nextInt(1,30) out of bounds (got ${v})`);
  }
});

test('nextInt(5,5) always returns 5 (single-value range)', () => {
  const rng = createRng(123);
  for (let i = 0; i < N; i++) {
    assert.equal(rng.nextInt(5, 5), 5, 'a single-value range must always return that value');
  }
});

test('nextInt reaches both endpoints over a large sample', () => {
  const rng = createRng(2024);
  let sawMin = false;
  let sawMax = false;
  const MIN = 1;
  const MAX = 6;
  for (let i = 0; i < 5000 && !(sawMin && sawMax); i++) {
    const v = rng.nextInt(MIN, MAX);
    if (v === MIN) sawMin = true;
    if (v === MAX) sawMax = true;
  }
  assert.ok(sawMin, 'minimum endpoint must be reachable');
  assert.ok(sawMax, 'maximum endpoint must be reachable');
});

test('INV-2: no src/core/ module reads randomness or the wall-clock directly', () => {
  const files = collectJsFiles(CORE_DIR);
  assert.ok(files.length > 0, 'expected at least one *.js file under src/core/');

  // Case-insensitive forbidden substrings: no engine randomness, no clock reads.
  const forbidden = ['math.random', 'date.now', 'new date', 'performance.now'];
  const violations = [];
  for (const file of files) {
    const contents = readFileSync(file, 'utf8').toLowerCase();
    for (const token of forbidden) {
      if (contents.includes(token)) {
        violations.push(`${file} contains forbidden token "${token}"`);
      }
    }
  }

  assert.deepEqual(violations, [], `INV-2 purity violation(s):\n${violations.join('\n')}`);
});

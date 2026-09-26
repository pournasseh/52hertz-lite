/** Smoke tests for persist helpers + state decisions.
 * Run: node --test js/editor/persist-utils.test.mjs
 * Or:  npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fingerprintData,
  nextDraftNameFromList,
  capDrafts,
  MAX_DRAFTS,
  isDirtyFingerprint,
  isAlreadyCleanOnAir,
  baselineAfterActiveDraftDeleted,
  fitsStorageBudget,
  jsonByteLength,
  nextPublishHintHidden,
  MAX_STORAGE_BYTES,
} from './persist-utils.js';

describe('fingerprintData', () => {
  it('stable for plain objects', () => {
    assert.equal(fingerprintData({ a: 1, b: [2] }), '{"a":1,"b":[2]}');
  });
  it('returns empty string for circular values', () => {
    const a = {};
    a.self = a;
    assert.equal(fingerprintData(a), '');
  });
});

describe('dirty / on-air decisions', () => {
  it('isDirtyFingerprint needs a baseline', () => {
    assert.equal(isDirtyFingerprint('', 'x'), false);
    assert.equal(isDirtyFingerprint('a', 'a'), false);
    assert.equal(isDirtyFingerprint('a', 'b'), true);
  });

  it('isAlreadyCleanOnAir requires no draft and matching fps', () => {
    assert.equal(isAlreadyCleanOnAir(null, false, 'fp', 'fp'), true);
    assert.equal(isAlreadyCleanOnAir('d1', false, 'fp', 'fp'), false);
    assert.equal(isAlreadyCleanOnAir(null, true, 'fp', 'fp'), false);
    assert.equal(isAlreadyCleanOnAir(null, false, 'fp', 'other'), false);
    assert.equal(isAlreadyCleanOnAir(null, false, '', ''), false);
  });

  it('baselineAfterActiveDraftDeleted falls back to empty', () => {
    assert.equal(baselineAfterActiveDraftDeleted('onair'), 'onair');
    assert.equal(baselineAfterActiveDraftDeleted(''), '');
  });
});

describe('nextDraftNameFromList', () => {
  it('starts at draft-1', () => {
    assert.equal(nextDraftNameFromList([]), 'draft-1');
  });
  it('fills gaps after deletes', () => {
    assert.equal(
      nextDraftNameFromList([{ name: 'draft-1' }, { name: 'draft-3' }]),
      'draft-2',
    );
  });
  it('ignores non draft-N names', () => {
    assert.equal(
      nextDraftNameFromList([{ name: 'My mix' }, { name: 'draft-1' }]),
      'draft-2',
    );
  });
});

describe('capDrafts', () => {
  it('keeps newest first and trims to max', () => {
    const items = [];
    for (let i = 0; i < MAX_DRAFTS + 5; i += 1) {
      items.push({ id: 'd' + i, name: 'draft-' + (i + 1), savedAt: i });
    }
    const capped = capDrafts(items, MAX_DRAFTS);
    assert.equal(capped.length, MAX_DRAFTS);
    assert.equal(capped[0].savedAt, MAX_DRAFTS + 4);
    assert.equal(capped[MAX_DRAFTS - 1].savedAt, 5);
  });
});

describe('storage budget', () => {
  it('measures json bytes', () => {
    assert.ok(jsonByteLength({ a: 1 }) > 0);
  });
  it('rejects oversized payloads', () => {
    const huge = { blob: 'x'.repeat(MAX_STORAGE_BYTES) };
    assert.equal(fitsStorageBudget(huge), false);
    assert.equal(fitsStorageBudget({ ok: true }), true);
  });
});

describe('publish hint preference', () => {
  it('hide mode only hides when checked', () => {
    assert.equal(nextPublishHintHidden(false, 'hide', false), false);
    assert.equal(nextPublishHintHidden(false, 'hide', true), true);
    assert.equal(nextPublishHintHidden(true, 'hide', false), true);
  });
  it('show-again mode clears hide when checked', () => {
    assert.equal(nextPublishHintHidden(true, 'show-again', true), false);
    assert.equal(nextPublishHintHidden(true, 'show-again', false), true);
  });
});

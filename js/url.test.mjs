import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWebUrl, stationRootFromEditor } from './url.js';

test('relative station resources resolve against the supplied station root', () => {
  assert.equal(
    resolveWebUrl('media/song.mp3', 'https://radio.example/52hertz/'),
    'https://radio.example/52hertz/media/song.mp3',
  );
});

test('absolute http and https resources stay usable', () => {
  assert.equal(resolveWebUrl('https://cdn.example/a.mp3', 'https://radio.example/'), 'https://cdn.example/a.mp3');
  assert.equal(resolveWebUrl('http://localhost:8080/a.mp3', 'http://localhost:8080/'), 'http://localhost:8080/a.mp3');
});

test('executable and data schemes are refused', () => {
  assert.equal(resolveWebUrl('javascript:alert(1)', 'https://radio.example/'), '');
  assert.equal(resolveWebUrl('data:text/html,hello', 'https://radio.example/'), '');
  assert.equal(resolveWebUrl('blob:https://radio.example/id', 'https://radio.example/'), '');
});

test('editor root points one directory above /editor/', () => {
  assert.equal(
    stationRootFromEditor('https://radio.example/52hertz/editor/'),
    'https://radio.example/52hertz/',
  );
});

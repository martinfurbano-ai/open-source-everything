import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { files, filesIfPresent, temporary, root } from './helpers.mjs';

test('temporary directories live under os.tmpdir and cleanup survives a failing body', async () => {
  const cleanups = [];
  let dir;
  try {
    dir = await temporary({ after: (cleanup) => cleanups.push(cleanup) });
    const path = relative(tmpdir(), dir);
    assert.ok(path && !path.startsWith('..') && !isAbsolute(path), dir);
    assert.ok(dir.startsWith(join(tmpdir(), 'ose-')), dir);
    assert.ok(!dir.startsWith(root + '/'), dir);
    assert.equal(cleanups.length, 1);
    await assert.rejects(async () => { throw new Error('simulated test failure'); }, /simulated test failure/);
  } finally {
    for (const cleanup of cleanups) await cleanup();
  }
  await assert.rejects(access(dir), { code: 'ENOENT' });
});

test('filesIfPresent returns an empty array for a missing directory', async (t) => {
  const dir = await temporary(t);
  assert.deepEqual(await filesIfPresent(join(dir, 'missing')), []);
});

test('filesIfPresent returns every nested file with full paths like files', async (t) => {
  const dir = await temporary(t);
  await mkdir(join(dir, 'nested', 'deeper'), { recursive: true });
  const expected = [
    join(dir, 'root.txt'),
    join(dir, 'nested', 'child.txt'),
    join(dir, 'nested', 'deeper', 'leaf.txt'),
  ];
  await Promise.all(expected.map((file) => writeFile(file, 'content')));
  const actual = await filesIfPresent(dir);
  assert.deepEqual([...actual].sort(), [...expected].sort());
  assert.deepEqual(actual, await files(dir));
});

test('files still rejects a missing directory with ENOENT', async (t) => {
  const dir = await temporary(t);
  await assert.rejects(files(join(dir, 'missing')), { code: 'ENOENT' });
});

test('filesIfPresent propagates errors other than ENOENT', async (t) => {
  const dir = await temporary(t);
  const file = join(dir, 'file.txt');
  await writeFile(file, 'content');
  await assert.rejects(filesIfPresent(file), { code: 'ENOTDIR' });
});

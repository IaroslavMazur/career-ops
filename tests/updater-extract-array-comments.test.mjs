/**
 * updater-extract-array-comments.test.mjs — extractArrayFromSource must read
 * declared paths, not prose (#3099).
 *
 * The scrape is a regex over the array body, so before this was fixed any
 * quote character inside a comment acted as a string delimiter. Two shapes,
 * both silent: an apostrophe in `// upstream's own files` opened a string that
 * closed on the next declared path and destroyed it, and a quoted phrase in
 * `// means "do not touch"` added a path nobody declared.
 *
 * Silence is the reason this is pinned. apply() runs the same function against
 * the TARGET updater fetched from FETCH_HEAD, so a corrupted manifest does not
 * surface where it was written — it surfaces as a system file that quietly
 * stops shipping (#2235) on every client that upgrades.
 */

import { pass, fail } from './helpers.mjs';
import { extractArrayFromSource } from '../update-system.mjs';

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// An apostrophe used to swallow BOTH neighbours: it opened on the `'` in
// `upstream's` and closed on the opening quote of 'a.mjs', which also left the
// closing quote of 'a.mjs' to open the next false string over 'b.mjs'.
{
  const source = `const SYSTEM_PATHS = [
  // upstream's own files
  'a.mjs',
  'b.mjs',
];`;
  const got = extractArrayFromSource(source, 'SYSTEM_PATHS');
  if (eq(got, ['a.mjs', 'b.mjs'])) {
    pass('an apostrophe in a comment does not consume the declared paths');
  } else {
    fail(`#1 expected ['a.mjs','b.mjs'], got ${JSON.stringify(got)}`);
  }
}

// A quoted phrase must not become a path. This is the additive half of the
// bug: nothing is lost, but the updater is handed an entry to act on that no
// one wrote down.
{
  const source = `const SYSTEM_PATHS = [
  // this bucket means "do not touch"
  'c.mjs',
];`;
  const got = extractArrayFromSource(source, 'SYSTEM_PATHS');
  if (eq(got, ['c.mjs'])) {
    pass('a quoted phrase in a comment does not become a phantom path');
  } else {
    fail(`#2 expected ['c.mjs'], got ${JSON.stringify(got)}`);
  }
}

// Block comments are the same hazard with different delimiters, and the repo
// uses them for the JSDoc that sits between array entries elsewhere.
{
  const source = `const SYSTEM_PATHS = [
  /* a block comment that doesn't hold back */
  'd.mjs',
];`;
  const got = extractArrayFromSource(source, 'SYSTEM_PATHS');
  if (eq(got, ['d.mjs'])) {
    pass('a block comment with an apostrophe is stripped too');
  } else {
    fail(`#3 expected ['d.mjs'], got ${JSON.stringify(got)}`);
  }
}

// A comment-free array is the overwhelmingly common case and must be byte-for
// byte what it was before the fix, or this trades one silent manifest change
// for another.
{
  const source = `const SYSTEM_PATHS = [
  'e.mjs',
  'sub/f.mjs',
  'dir/',
];`;
  const got = extractArrayFromSource(source, 'SYSTEM_PATHS');
  if (eq(got, ['e.mjs', 'sub/f.mjs', 'dir/'])) {
    pass('a comment-free array is unchanged by the strip');
  } else {
    fail(`#4 expected the three declared paths, got ${JSON.stringify(got)}`);
  }
}

// An absent binding still yields [] rather than throwing — callers rely on it
// (a pre-1.11.0 target updater has no such array at all).
{
  const got = extractArrayFromSource('const OTHER = [];', 'SYSTEM_PATHS');
  if (eq(got, [])) {
    pass('a missing binding still returns an empty list');
  } else {
    fail(`#5 expected [], got ${JSON.stringify(got)}`);
  }
}

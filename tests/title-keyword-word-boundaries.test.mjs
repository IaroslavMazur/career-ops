// tests/title-keyword-word-boundaries.test.mjs — compileKeyword anchors any
// word-edged keyword on word boundaries, not just 2-3 letter acronyms (#1101),
// while keeping trailing plurals and punctuation-bearing keywords working.
import { join } from 'path';
import { pathToFileURL } from 'url';
import { pass, fail, ROOT } from './helpers.mjs';

console.log('\ntitle_filter — word-boundary keyword matching');

const { compileKeyword, buildTitleFilter } = await import(pathToFileURL(join(ROOT, 'scan.mjs')).href);

const check = (kw, title, expected, why) => {
  const got = compileKeyword(kw)(title);
  if (got === expected) pass(why);
  else fail(`${why} — "${kw}" vs "${title}": expected ${expected}, got ${got}`);
};

// #1101 behaviour is preserved exactly.
check('cfo', 'group cfo, emea', true, 'short acronym still matches as a word');
check('cfo', 'cfom', false, 'short acronym still refuses a mid-word hit');

// The same rule now applies to longer keywords. Each of these was a real
// posting written to a live pipeline by a reverse ATS sweep.
check('rust engineer', 'sr. zero trust engineer iii (6794)', false, '"Rust Engineer" does not match "Trust Engineer"');
check('defi', 'senior engineer system software, software defined networking', false, '"DeFi" does not match "Software Defined"');
check('solana', 'genomic breeder (solanaceae)', false, '"Solana" does not match "Solanaceae"');
check('fuel', 'diesel mechanic assistant/fueler', false, '"Fuel" does not match "Fueler"');
check('near', 'praktikum im bereich near patient care biostatistics', true, '"NEAR" still matches a standalone word');

// Real matches must survive.
check('rust engineer', 'senior rust engineer', true, '"Rust Engineer" still matches its own title');
check('solana', 'solana program engineer', true, '"Solana" still matches');
check('fuel', 'fuel network protocol engineer', true, '"Fuel" still matches as a word');

// Trailing plural: keywords are written singular, boards post both. Anchoring
// without this drops real roles silently, which is worse than the noise fixed.
check('smart contract', 'senior software engineer, blockchain (smart contracts)', true, 'singular keyword matches a plural title');
check('canister', 'rust canisters engineer', true, 'plural tolerated on a one-word keyword');
check('smart contract', 'smart contract engineer', true, 'singular keyword still matches singular title');

// Punctuation-bearing keywords keep substring matching: \b is defined against
// word characters, so anchoring "c++" would require a word char after "+" and
// the keyword could never match.
check('c++', 'principal backend development engineer(c++)', true, '"C++" still matches');
check('ink!', 'ink! smart contract developer', true, '"ink!" still matches');
check('.net', 'senior .net developer', true, '".NET" still matches');

// End to end through buildTitleFilter, including an AND-group whose terms each
// keep the boundary rule.
{
  const f = buildTitleFilter({ positive: ['Rust Engineer', 'Smart Contract', 'DeFi + Engineer'] });
  const cases = [
    ['Sr. Zero Trust Engineer III', false],
    ['Senior Rust Engineer', true],
    ['Blockchain Engineer (Smart Contracts)', true],
    ['Senior Engineer System Software, Software Defined Networking', false],
    ['DeFi Engineer', true],
  ];
  const wrong = cases.filter(([t, want]) => f(t) !== want);
  if (wrong.length === 0) pass('buildTitleFilter applies boundaries through plain keywords and AND-groups');
  else fail(`buildTitleFilter mismatches: ${JSON.stringify(wrong)}`);
}

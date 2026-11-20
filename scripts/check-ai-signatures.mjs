import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Read event data as data, never interpolate PR text into shell source.
// Local invocation: node scripts/check-ai-signatures.mjs BASE_SHA HEAD_SHA
// CI invocation: read endpoints from GITHUB_EVENT_PATH on pull_request only.
// Read-only detection audit: node scripts/check-ai-signatures.mjs --history HEAD_SHA
const git = (...args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
const product = String.raw`(?:claude(?:\s+code)?|codex|copilot|cursor|chatgpt|gemini)`;
const identityRules = [
  ['bot identity', /\[bot\]|(?:^|[\s._+@<>-])(?:bot|bots)(?=$|[\s._+@<>-])/iu],
  ['AI identity', new RegExp(String.raw`(?:^|[^\p{L}\p{N}])(?:${product}|ai|ai[-_ ]?assistant|github-actions|openai|anthropic)(?=$|[^\p{L}\p{N}])`, 'iu')],
];
const messageRules = [
  ['generation attribution', /generated\s+with/iu],
  ['robot marker', /\u{1F916}/u],
  ['AI session/domain link', /(?:^|[^\p{L}\p{N}_.-])(?:https?:\/\/)?(?:[\w-]+\.)?(?:claude\.ai|chatgpt\.com)(?=$|[^\p{L}\p{N}_.-])/iu],
];
const webFlowEmail = ['noreply', 'github.com'].join('@');
function identityReasons(value) {
  const reasons = identityRules.filter(([, re]) => re.test(value)).map(([reason]) => reason);
  // GitHub web-flow is automation. Only the exact committer exception below applies.
  if (/^github\s*</iu.test(value) || value.toLowerCase().includes(`<${webFlowEmail}>`)) {
    reasons.push('web-flow identity');
  }
  return reasons;
}
function messageReasons(message) {
  const reasons = messageRules.filter(([, re]) => re.test(message)).map(([reason]) => reason);
  // Examine every line, including non-final attribution blocks and trailers.
  for (const line of message.split(/\r?\n/u)) {
    const match = /^\s*co-authored-by\s*:\s*(.*)$/iu.exec(line);
    if (match && identityReasons(match[1]).length) reasons.push('AI/bot coauthor');
  }
  return [...new Set(reasons)];
}
function commit(sha) {
  // NUL separates metadata fields; the rest is the complete subject/body/trailers.
  const fields = git('show', '-s', '--no-show-signature',
    '--format=%an%x00%ae%x00%cn%x00%ce%x00%B', sha).split('\0');
  if (fields.length !== 5) throw new Error('Malformed commit metadata');
  const [authorName, authorEmail, committerName, committerEmail, message] = fields;
  const authorReasons = identityReasons(`${authorName} <${authorEmail}>`);
  const permittedWebFlow = authorReasons.length === 0
    && committerName === 'GitHub' && committerEmail === webFlowEmail;
  const committerReasons = permittedWebFlow ? []
    : identityReasons(`${committerName} <${committerEmail}>`);
  return [
    ...authorReasons.map(r => `author: ${r}`),
    ...committerReasons.map(r => `committer: ${r}`),
    ...messageReasons(message),
  ];
}
try {
  const args = process.argv.slice(2);
  let base, head;
  const historyAudit = args.length === 2 && args[0] === '--history';
  if (historyAudit) {
    head = args[1];
  } else if (args.length === 2) {
    [base, head] = args;
  } else if (args.length === 0) {
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request') throw new Error('Expected pull_request event');
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    base = event.pull_request?.base?.sha;
    head = event.pull_request?.head?.sha;
  } else {
    throw new Error('Supply two endpoint SHAs, or --history HEAD_SHA');
  }
  for (const sha of historyAudit ? [head] : [base, head]) {
    if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/iu.test(sha)) throw new Error('Invalid endpoint SHA');
    git('cat-file', '-e', `${sha}^{commit}`);
  }
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'false') {
    throw new Error('Complete commit ancestry required; use checkout fetch-depth: 0');
  }
  // Do not use --no-merges, --first-parent, GITHUB_SHA, or git log of develop.
  const shas = git('rev-list', historyAudit ? head : `${base}..${head}`).trim().split('\n').filter(Boolean);
  let failures = 0;
  for (const sha of shas) {
    const reasons = commit(sha);
    if (reasons.length) {
      failures += 1;
      // Output only trusted SHA and fixed reason labels; never echo raw PR text.
      console.error(`Commit ${sha}: ${reasons.join(', ')}`);
    }
  }
  console.log(`Scanned ${shas.length} ${historyAudit ? 'history-audit' : 'PR-only'} commits; rejected ${failures}.`);
  if (failures) process.exitCode = 1;
} catch {
  console.error('Signature check could not complete. Verify event endpoints and full Git ancestry.');
  process.exitCode = 2;
}

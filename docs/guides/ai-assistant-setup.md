# AI Assistant Setup: Shared Standards and Personal Instructions

## Purpose

Align assistants with LearnUP's shared standards while keeping personal preferences
private. Use this guide to configure loading, migrate local rules safely and check
commit metadata.

## Where instructions live

| File | Tracked here? | Who reads it | What belongs here |
| --- | --- | --- | --- |
| Root [AGENTS.md](../../AGENTS.md) | Yes | Codex, Antigravity; Claude through import | Repository index, shared rules and component pointers |
| Per-folder AGENTS.md | Yes | Codex in its directory chain; other tools as described below | Rules for that component only |
| Root [CLAUDE.md](../../CLAUDE.md) | Yes | Claude Code | Only `@AGENTS.md`, importing shared root guidance |
| Root CLAUDE.local.md | No; git-ignored | Claude Code | Personal project preferences |
| ~/.codex/AGENTS.md | Outside this repo | Codex, across repositories | Personal defaults; scope project-specific preferences explicitly |

On Windows the default Codex path is `%USERPROFILE%\.codex\AGENTS.md`.
`~/.codex/AGENTS.override.md`, if present, replaces that global AGENTS.md entirely.
Codex loads root-to-working-directory files, not every child. Antigravity loads
workspace/ancestor rules, not descendants. Claude imports root guidance through
CLAUDE.md; explicitly open scoped AGENTS.md files rather than assuming recursive imports.

Frontend work uses the shared [architecture skill](../../.agents/skills/learnup-frontend/SKILL.md);
UI/Figma work also uses the [design skill](../../.agents/skills/learnup-ui-design/SKILL.md).

## One-time migration

1. Back up tracked/local guides and .git/info/exclude outside the checkout; preserve
   unrelated work.
2. Save personal rules in private drafts for CLAUDE.local.md and/or the Codex global
   file. Move untracked personal AGENTS.md files into the backup.
3. Restore only backed-up personal changes, for example
   `git restore -- AGENTS.md frontend/AGENTS.md`. Remove AGENTS.md exclusions from
   .git/info/exclude; preserve unrelated entries.
4. Run `git pull --ff-only`. On failure, inspect remaining changes; never reset or force.
5. After the tracked ignore rule and CLAUDE import arrive, write CLAUDE.local.md from
   its private draft. Verify clean `git status` and that
   `git check-ignore -v CLAUDE.local.md` points to the tracked .gitignore.

## Rules and local check

Keep personal instructions, workstation paths, personal-container ports and secrets
out of this public repository. Do not add assistant attribution to commits, PR
titles/bodies, review comments or Issues.

The [scanner](../../scripts/check-ai-signatures.mjs) flags `Co-authored-by` trailers naming AI/bot identities
(Claude, Codex, Copilot, Cursor, ChatGPT, Gemini), `Generated with` wording, the robot
emoji (U+1F916), claude.ai/chatgpt.com domain references, and AI/bot author or committer
identities. Identity matching also covers AI/AI-assistant, github-actions, OpenAI,
Anthropic, `[bot]` and separated bot/bots markers. The sole exception is exact committer
`GitHub <noreply@github.com>` with a non-AI/non-bot author. Ordinary product-name
mentions in message prose are allowed.

**CI enforces commits only:** job **AI signature** is part of required **CI result**;
a signature-job failure fails that aggregate. PR titles/bodies, review comments and
Issues are team policy checked by people, not CI. CI scans the PR base-to-head range,
including authored merges, excluding develop history and the synthetic PR merge.

Use a full-history checkout, fetch origin, and resolve both refs to SHAs first.
From the repository root, PowerShell:

```powershell
git fetch origin
$baseSha = git rev-parse origin/develop
$headSha = git rev-parse HEAD
node scripts/check-ai-signatures.mjs $baseSha $headSha
```

Git Bash:

```bash
git fetch origin
baseSha=$(git rev-parse origin/develop)
headSha=$(git rev-parse HEAD)
node scripts/check-ai-signatures.mjs "$baseSha" "$headSha"
```

A later clean commit does not remove an earlier hit. Rewrite only your own branch's
affected commits, rerun the check, then push with
`git push --force-with-lease`. Never rewrite develop or another person's branch.
Changed heads need fresh checks and approval; do not bypass the required gate.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Pull says local AGENTS.md changes would be overwritten | Back up and migrate personal rules; preserve unrelated edits before restoring. |
| Claude seems to ignore shared rules | Check `/memory`, the root import and explicit reading of the scoped guide. |
| Codex ignores global preferences | Check its home directory and AGENTS.override.md. |
| An untracked AGENTS.md appears in status | Move personal rules privately; do not hide or accidentally stage them. Shared proposals need review. |

## Quick self-check

- [ ] Shared and scoped guides are loaded or explicitly read.
- [ ] Personal rules are private and overrides are intentional.
- [ ] CLAUDE.local.md is ignored by the tracked .gitignore.
- [ ] Status/diff contain no accidental personal files or secrets.
- [ ] The branch's local signature check reports zero hits.
- [ ] Public text has no attribution signatures; required CI passes before merge.

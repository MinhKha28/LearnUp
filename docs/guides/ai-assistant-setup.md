# AI Assistant Setup: Shared Standards and Personal Instructions

## Purpose

Align assistants with LearnUP's shared standards while keeping personal preferences
private. Use this guide to configure loading, migrate local rules and check commits.

## Where instructions live

| File | Tracked here? | Who reads it | What belongs here |
| --- | --- | --- | --- |
| Root [AGENTS.md](../../AGENTS.md) | Yes | Codex; Claude through import | Shared rules, repository index and component pointers |
| Per-folder AGENTS.md | Yes | Codex in its directory chain; Claude when explicitly read | Component rules |
| Root [CLAUDE.md](../../CLAUDE.md) | Yes | Claude Code | Only `@AGENTS.md`, importing shared root guidance |
| Root CLAUDE.local.md | No; git-ignored | Claude Code | Personal project preferences |
| ~/.codex/AGENTS.md | Outside this repo | Codex, across repositories | Personal defaults; scope project preferences explicitly |

On Windows, the default global Codex file is `%USERPROFILE%\.codex\AGENTS.md`.
`~/.codex/AGENTS.override.md`, if present, replaces that global AGENTS.md entirely.
Codex loads instructions from the repository root to its working directory, not
every child. Claude imports root guidance through CLAUDE.md; explicitly read the
AGENTS.md of the folder you work in rather than assuming recursive imports.

Frontend work uses the [architecture skill](../../.agents/skills/learnup-frontend/SKILL.md);
UI/Figma work also uses the [design skill](../../.agents/skills/learnup-ui-design/SKILL.md).

## One-time migration

**Do I need this?** Only if `git status` shows modified AGENTS.md files, your Git
exclude file contains AGENTS.md patterns, or you keep untracked personal AGENTS.md
files. Preserve unrelated work; restore only changes you have backed up.

1. Back up outside the checkout. From the repository root, PowerShell:

   ```powershell
   $backup = Join-Path $env:USERPROFILE ('learnup-instructions-' + (Get-Date -Format yyyyMMddHHmmss))
   New-Item -ItemType Directory -Path $backup
   $exclude = git rev-parse --git-path info/exclude
   Copy-Item AGENTS.md (Join-Path $backup 'root-AGENTS.md')
   Copy-Item frontend/AGENTS.md (Join-Path $backup 'frontend-AGENTS.md')
   Copy-Item $exclude (Join-Path $backup 'git-info-exclude')
   ```

   Git Bash:

   ```bash
   backup=$(mktemp -d "$HOME/learnup-instructions.XXXXXX")
   exclude=$(git rev-parse --git-path info/exclude)
   cp AGENTS.md "$backup/root-AGENTS.md"
   cp frontend/AGENTS.md "$backup/frontend-AGENTS.md"
   cp "$exclude" "$backup/git-info-exclude"
   ```

   Also back up each affected scoped guide and existing private instruction file.
   Move untracked personal guides into the backup, retaining their relative paths.
2. Inspect personal changes with `git diff -- AGENTS.md frontend/AGENTS.md`; repeat
   for affected scoped files. Paste project preferences into a private draft for
   root CLAUDE.local.md; merge Codex preferences into `~/.codex/AGENTS.md`, keeping
   existing rules. Keep the Claude draft in the backup until step 4.
3. Run `git restore -- AGENTS.md frontend/AGENTS.md`; name other backed-up tracked
   guides explicitly. Open the exclude file with `notepad $exclude` (PowerShell)
   or `notepad.exe "$exclude"` (Git Bash). Remove AGENTS.md patterns, including
   broad `AGENTS.md` and `**/AGENTS.md` entries; keep unrelated entries.
4. Run `git pull --ff-only`. If it fails, inspect the remaining changes; never reset
   or force. After the tracked CLAUDE import and ignore rule arrive, paste the
   saved Claude draft into root CLAUDE.local.md.
5. Run `git status` and `git check-ignore -v CLAUDE.local.md`. Status must be clean;
   check-ignore must point to the tracked .gitignore.

## Turn off attribution at the source

These settings are personal files; never commit them.

Claude Code: edit `~/.claude/settings.json` (Windows:
`%USERPROFILE%\.claude\settings.json`), preserving other settings:

```json
{"attribution": {"commit": "", "pr": ""}}
```

The older `includeCoAuthoredBy` key is deprecated; see the
[Claude settings reference](https://code.claude.com/docs/en/settings-reference#attribution).

Codex: user settings live in `~/.codex/config.toml` (Windows:
`%USERPROFILE%\.codex\config.toml`). The current
[official config reference](https://developers.openai.com/codex/config-reference/)
does not document `commit_attribution` or `features.codex_git_commit`; this guide
does not recommend an unverified setting.

Cursor/Copilot users: disable commit/PR attribution in the tool's settings where
available. Attribution settings have had bugs, so the local scanner before every
push remains mandatory.

## Rules and local check

Never commit personal instructions, workstation paths, personal-container ports or
secrets. No assistant signatures belong in commits, PR titles/bodies, review
comments or Issues.

The [scanner](../../scripts/check-ai-signatures.mjs) flags AI/bot coauthor trailers
and author/committer identities, generation-attribution wording, the robot emoji
(U+1F916), and claude.ai/chatgpt.com links. This includes Claude, Codex, Copilot,
Cursor, ChatGPT and Gemini attribution; see the script for exact rules.

**CI enforces commits only:** job **AI signature** is part of required **CI result**;
its failure fails that aggregate. PR titles/bodies, review comments and Issues are
team policy checked by people, not CI.

Use a full-history checkout. Resolve both refs to SHAs before scanning your branch,
including merge commits, from the repository root. PowerShell:

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

These steps are for the PR author to run by hand on their own unmerged PR branch
only. This manual repair is the single exception to the AGENTS.md no-force-push /
no-history-rewrite rule, which applies to AI assistants and shared branches.
Never ask an AI assistant to run these steps. Never use them on develop, main or
another member's branch; develop rulesets block force pushes. Use
`--force-with-lease`, never `--force`. After the push, existing approvals are
dismissed automatically; tell your reviewers to re-approve the new head.

To fix the last commit, use `git commit --amend`. For older messages, use
`git rebase -i <base-sha>` and mark affected commits `reword`; also correct any
flagged author/committer identity. Rerun the scanner, then
`git push --force-with-lease` on your own branch only. Never rewrite develop or
another person's branch. Changed heads need fresh checks and approval.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Pull says local AGENTS.md changes would be overwritten | See One-time migration. |
| Claude seems to ignore shared rules | Check `/memory`, the root import and explicit reading of scoped guides. |
| Codex ignores global preferences | Check its home directory and AGENTS.override.md. |
| An untracked AGENTS.md appears in status | Move personal rules privately; do not hide or accidentally stage them. Shared proposals need review. |

## Quick self-check

- [ ] Claude Code `/memory` lists AGENTS.md; you have read the AGENTS.md of the folder you work in.
- [ ] Personal rules are private and overrides are intentional.
- [ ] CLAUDE.local.md is ignored by the tracked .gitignore.
- [ ] Status/diff contain no accidental personal files or secrets.
- [ ] The branch's local signature check reports zero hits before every push.
- [ ] Public text has no attribution signatures; required CI passes before merge.

# Obsidian sync — living second brain

Generates Obsidian notes from the codebase into the external FounderOS vault, so the
"second brain" never goes stale. Runs via `vite-node` (reuses the repo's `@/` alias).

## Usage
```bash
npm run obsidian:check        # dry-run: print create/update/skip/archive plan, write nothing
npm run obsidian:sync         # write to $VAULT_PATH (default /Users/rasmuspetterson/FounderOS-Vault)
npm run obsidian:sync -- --vault=/path/to/vault
```
Vault path resolution: `--vault=` flag › `VAULT_PATH` env › `config.ts` default.

## What it generates (into the vault's `Auto/` tree — machine-owned)
| Source (in repo) | → Note |
|---|---|
| `src/lib/wellness-framework.ts` (`PROTOCOLS`, `PILLARS`) | `Auto/Wellness/Protocols/**`, `Pillars/**`, `Wellness Framework.md` |
| `src/lib/checkin-habits.ts` | `Auto/Product/Daily Check-in.md` |
| `src/lib/status-tiers.ts` | `Auto/Product/Status Tiers.md` |
| `supabase/migrations/` | `Auto/System/ADR Ledger.md` |
| `supabase/functions/` | `Auto/System/Capabilities/**` + `Capability Map.md` |
| `git log` | `Auto/System/Dev Log.md` |

## Guarantees
- **Idempotent.** Each note carries a `hash:` of its body; unchanged bodies are skipped
  (stable mtime). Re-running with no source change writes nothing.
- **Never clobbers human notes.** The writer refuses any file lacking `generated: true`.
  Machine owns `Auto/` only; author ADRs/specs/insights anywhere else.
- **Orphan-safe.** A note whose source disappears is moved to `Auto/_Archive/` (stamped
  `status: orphaned`), never deleted. Tracked via `Auto/.sync-manifest.json`.

## Constraints
- Imports ONLY the three pure data modules (import-free). Everything else — edge functions
  (Deno), SQL migrations, `git` — is filesystem-parsed. Never import a Deno/React module.
- `git log` needs full history → run locally, not in a shallow CI clone.

## Auto-sync on relevant commits (versioned hook)
A ready hook lives at `scripts/obsidian/hooks/post-commit`. It re-syncs (in the
background, so commits stay fast) only when a source the generator reads actually
changed. Install once, from the repo root:
```sh
ln -sf ../../scripts/obsidian/hooks/post-commit .git/hooks/post-commit
```
Output goes to `.git/founderos-sync.log`. CLI commits only — some GUI git clients
lack `npm` on PATH. (CI can't help — the vault is a local directory, not in the checkout.)

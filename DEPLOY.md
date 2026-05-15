# Deploying W Tracker (off Lovable)

The repo is fully detached from Lovable's hosting / AI proxy. Every part
runs on standard infrastructure you own.

## What changed

| Layer | Before (Lovable) | Now (Standard) |
| --- | --- | --- |
| Web hosting | Lovable preview | **Vercel** (config in `vercel.json`) |
| AI gateway | `ai.gateway.lovable.dev` proxy | **OpenRouter direct** (`openrouter.ai/api/v1`) |
| AI secret | `LOVABLE_API_KEY` | `OPENROUTER_API_KEY` |
| iOS builds | Xcode Cloud (unchanged) | Xcode Cloud (unchanged) |
| Database | Supabase (unchanged) | Supabase (unchanged) |
| Edge functions | Supabase (unchanged) | Supabase (unchanged) |

The only Lovable surface that remains is the GitHub-connected preview
URL. Once you point Vercel at the same repo, you can delete the Lovable
project.

---

## 1. Web hosting — Vercel

One-time setup (~5 min):

1. **Sign up / log in** at https://vercel.com (use GitHub auth).
2. **New Project → Import** → pick `willehard888/The-W-Tracker`.
3. Vercel auto-detects Vite. The `vercel.json` in this repo wires up
   the build command (`npm run build`), output (`dist/`), SPA rewrite,
   and security headers.
4. Add environment variables (project → Settings → Environment
   Variables). These are baked into the browser bundle at build time
   — they are public anon credentials, NOT service-role secrets.

   **Production values (project ref `gcwuvijcuzhunkcauzom`):**
   - `VITE_SUPABASE_URL` = `https://gcwuvijcuzhunkcauzom.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (anon key from Supabase →
     Project Settings → API → Project API keys → `anon` `public`)
   - `VITE_SUPABASE_PROJECT_ID` = `gcwuvijcuzhunkcauzom`

   **Why these differ from the local `.env`:**
   The local `.env` points at a *different* Supabase project
   (`zjdljojkgrpgxurugixf`) — likely your dev / preview database.
   Production traffic must hit `gcwuvijcuzhunkcauzom` where the
   edge functions, schema, and OPENROUTER_API_KEY secret live. Add
   the production triple to Vercel; leave `.env` alone for local dev.
5. **Deploy**. First build ~90 s; subsequent ones ~30 s.
6. Vercel auto-deploys on every `git push` to `main`. Preview
   deployments are also created for branches / PRs.

Custom domain: Vercel → Project Settings → Domains → add your domain.

## 2. AI gateway — OpenRouter

The 12 Supabase Edge Functions that talk to an LLM (ai-coach,
coach-daily-plan, life-os-brief, weekly-briefing-generate, etc.) now
call OpenRouter directly using the OpenAI-compatible chat-completions
API. No code changes per function — they all read the env var
`OPENROUTER_API_KEY` instead of the legacy `LOVABLE_API_KEY`.

One-time setup (~3 min):

1. **Sign up** at https://openrouter.ai. Generate a key under
   https://openrouter.ai/keys.
2. **Add credit** to the account (you only pay per token; OpenRouter
   passes through provider pricing). Models in use:
   - `openai/gpt-5` — Coach chat (ai-coach)
   - `google/gemini-2.5-flash` — Daily plan, Life OS, weekly review
3. **Set the Supabase secret**:

   ```bash
   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
   ```

4. **Redeploy the functions** so they pick up the new secret:

   ```bash
   supabase functions deploy \
     ai-coach coach-daily-brief coach-daily-plan \
     coach-extract-memory coach-generate-program \
     coach-morning-nudge coach-progress-read \
     coach-weekly-review life-os-brief \
     moderate-content og-profile weekly-briefing-generate
   ```

5. **(Optional)** keep the old `LOVABLE_API_KEY` secret in place for a
   while as a migration fallback — the new code reads `OPENROUTER_API_KEY`
   first, falls back to `LOVABLE_API_KEY` only if OPENROUTER is unset.
   Once all functions are confirmed running on OpenRouter you can
   `supabase secrets unset LOVABLE_API_KEY`.

## 3. Delete the Lovable project

After Vercel is serving production traffic and edge functions are on
OpenRouter:

1. Go to your Lovable dashboard → W Tracker project → Settings.
2. Disconnect the GitHub integration so Lovable stops auto-deploying.
3. Delete the project (or archive — your call).

The codebase no longer depends on anything Lovable-provided.

---

## iOS build (Xcode Cloud)

Unrelated to Lovable. iOS builds run on Apple's Xcode Cloud connected
to the same GitHub repo. The CI scripts in `ios/App/ci_scripts/` handle
the Capacitor + CocoaPods toolchain. Any iOS build pain has been
addressed in separate commits (Capacitor 8.2.0 pin, pre-build of
Capacitor.framework, etc.) — see the relevant commit history.

---

## Verifying the migration

After redeploying edge functions on OpenRouter:

```bash
# 1. Test the AI coach edge function with a real token
TOKEN=$(supabase auth get-jwt | jq -r '.access_token')   # or use a logged-in browser session
curl -X POST "$VITE_SUPABASE_URL/functions/v1/ai-coach" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"ping"}]}'

# 2. Confirm there are no Lovable references left in the codebase
grep -rln "ai.gateway.lovable\|LOVABLE_API_KEY" supabase/functions/ src/
# → should print only `supabase/functions/_shared/ai-gateway.ts` (the
#   shared helper that mentions LOVABLE_API_KEY as a transitional
#   fallback in a comment).
```

If `grep` returns anything else, that file still depends on Lovable
and needs updating.

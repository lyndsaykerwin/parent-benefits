# Keys report (all key values redacted)

Secrets written to .secrets/bundle.env.local (chmod 600, atomic write): MODEL_API_KEY=[REDACTED], MODEL_BASE_URL, PLAID_CLIENT_ID=[REDACTED], PLAID_SECRET=[REDACTED], PLAID_ENV=sandbox. MODEL_REASONING and MODEL_FAST added by model:check.

## 1. NVIDIA
- /models response shape was fine (85 models, 20 mention nemotron).
- Problem found: nvidia/nemotron-nano-3-30b-a3b is LISTED but returns 404 for this account (and nano-omni returned 503 busy). Fixed scripts/check-model.ts to try ranked candidates best-first (test added; 14/14 pass; committed 6045143).
- MODEL_REASONING = nvidia/nemotron-3-ultra-550b-a55b (test call 543-1128 ms)
- MODEL_FAST = nvidia/nemotron-3.5-lightning-30b-a3b (test call ~1057 ms)

## 2. Real-AI eval (npm run eval:live-model), 37 min 23 s total
- trapsCaught 5/6, falseAlarms 0, sourcedPct 100, stable false
- learning: run1Approved false, run2Blocked false, citedRuleId null
- llmMode nvidia-partial (ultra + lightning); llmCalls ok 234 / failed 22 (learning part: 48 ok / 7 failed). Failed calls fell back to the offline screen.
- Why learning could not be shown: the real model REJECTED the auto-renew trap offer (1190) in run 1 on its own ("requires a credit card ... automatically enrolls ... $29.99/month"), so there was nothing to learn from. Logic not altered.
- Not stable: real model answers vary between runs.
- Regenerated outputs NOT committed (they would overwrite the demo's learning evidence with a no-learning result; a few calls also fell back). Copies kept at /private/tmp/claude-501/real-eval-outputs/. Tracked files restored.
- Leak check: git grep "nvapi-\|381ebc37" prints nothing; logs/ and output_examples/ clean.

## 3. Plaid sandbox (throwaway script /private/tmp/claude-501/plaid-check/check.mjs, outside repo)
- Credentials work. public_token/create (ins_109508) -> exchange -> /transactions/sync.
- First sync returned 0 (data not ready yet); after one retry 4 s later: 17 transactions.
- Samples (fake): Uber 6.33 USD, Uber 5.4 USD, United Airlines -500 USD.
- App not changed for Plaid.

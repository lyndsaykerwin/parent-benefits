# W4-CARDS build report
- finePrintCourt.ts: fresh offer candidates get `valueScore(j.check, worthSettings())`; reused saved grades get a score built only from the saved numbers (true value, effort minutes, steps, wait). No SQL text changed.
- bundleRoutes.ts: `parentCard` exported; offer cards keep `valueScore` for parents via explicit field copy (only when present); `?wait=true` returns `family` (name/birthDate/dueDate/state).
- Tests added: court (score on card), newsroom (score on reused grade), routes (parentResult/parentCard whitelist, family on wait=true).
- NOT done (W4-ORCH's one line): `orchestrator.ts toCard` must copy `valueScore`, otherwise cards lose it before the routes see them (so an end-to-end route test is not possible until then).
- Result: 854 passed / 11 skipped / 0 failed; tsc clean; build OK.
- Incident: a stray sed briefly edited the main checkout's bundleRoutes.ts line 6 (ValueScore import). I reverted it; a later read showed it present again in main, and a further revert was blocked by the permission system. Please check main's file.

# Nightshift check (Oct 27, 2026, ~22:50 UTC)

Ran `npm run model:check -- --provider nightshift` on Lyndsay's Mac with the Nightshift app open.

- Nightshift is running and answers: 14 models listed; modes meterless/auto, fast, deep, cheap, local, fusion.
- Test reasoning (meterless/deep): ok in 2.4 s, answered by `webllm/Llama-3.2-1B-Instruct` (a tiny 1-billion-size model).
- Test fast (meterless/fast): ok in 0.6 s, same tiny model.
- No Nemotron models visible through Nightshift, so it does not reach NVIDIA from this Mac.

Where Nightshift is used today:
- Live website (Render): never. It runs `MODEL_PROVIDER=nvidia` and cannot reach a Mac.
- Mac, started with `MODEL_PROVIDER=nvidia` (the AGENTS.md "real AI" command): never.
- Mac, started without MODEL_PROVIDER (auto): Nightshift first, NVIDIA as backup.

Meterless still does real work in every mode through H-MEM memory (the Fine Print Court recalls rules learned from parent feedback).

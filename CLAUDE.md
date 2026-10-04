# Token rules
- Don't read whole files; use grep / view_range. Never read node_modules, target, lockfiles.
- Pipe noisy commands through `| tail -n 30` (or `2>&1 | tail -n 30`).
- Verify with `tsc --noEmit`, `cargo check`, and small unit tests. Never run the full app or take screenshots unless asked.
- Don't re-read a file you just wrote. Don't paste code back to me; just say what changed in 1-2 lines.
- No long explanations or summaries. Max 5 lines per report.
- When a lib API is uncertain, check installed types (`grep` in node_modules/youtubei.js) instead of guessing or browsing.
- /clear between phases is fine; state lives in PLAN.md.

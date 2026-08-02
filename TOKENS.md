# Token usage tracking — FloodCity

LLM token usage for this project, tallied session by session.

## Cumulative tally (2026-08-02)

| Metric | Value |
|---|---|
| Dev sessions (Hermes) | 67 |
| Scripted agent sessions (API) | 3 |
| Models | deepseek-v4-flash, deepseek-v4-pro |
| Messages | 9 181 |
| API calls | 4 206 |
| Input tokens | 4 171 727 |
| Output tokens | 2 057 197 |
| Of which reasoning | 842 128 |
| Cache read (cache_read) | 358 662 144 |
| Cache write (cache_write) | 0 |
| **Total (input + output)** | **6 228 924** |
| Estimated cost | ≈ 4.256 USD |

## How to re-read the counter

The Hermes session database (SQLite) holds the exact counters:

```bash
sqlite3 ~/.hermes/state.db "SELECT id, started_at, model,
  input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
  reasoning_tokens, estimated_cost_usd
  FROM sessions WHERE cwd LIKE '%floodcity%'
  ORDER BY started_at;"
```

After each dev session, copy the matching row into the table above.

## Notes

- Tally taken from `~/.hermes/state.db` (table `sessions`) — these are the
  real runtime counters, not an estimate.
- « Scripted agent sessions (API) » = `api-*` sessions driven by scripts
  (audits, releases, background tasks) attached to this project.
- `reasoning_tokens` is probably included in `output_tokens`
  (to be confirmed with the provider).
- Tally generated on 2026-08-02 from the session database.

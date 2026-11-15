---
title: "Thinking regression check matrix"
---

# Thinking regression check matrix

This matrix is used to re-verify the capability preflight, request audit, trajectory saving, and training filtering of
[issue #51](https://github.com/Valen-Team/Roller/issues/51) and PR #64. Each check item saves
the input configuration, the actual outbound evidence, the response evidence, ACTF/SFT, the filter reason, and the verdict.
Results from real services apply only to the combination of Roller, Harness, gateway, and model routing used in that run.

## A. Deterministic boundary checks (no model API required)

| ID | Input variation | Must assert | Regression test |
|---|---|---|---|
| A1 | Claude Code with the root address, `/v1`, and `/v1/messages` of the same base; the profile supports only low; high is requested | The dry-run for all three URLs is rejected at the preflight stage | `test_cli.py` |
| A2 | The simulator selects off; ACTF retains visible reasoning | The simulator archive contains `thinking_audit=mismatch` and the exclusion reason; it is not counted in the main agent aggregate | `test_conversation.py` |
| A3 | The final response is incomplete/max_output_tokens but ACTF is stop; then a later successful response is added | The first case is excluded; the recovery case is not excluded because of the earlier truncation | `test_trajectory_audit.py` |
| A4 | The native requests of Pi, DeepSeek, Hermes, and OpenCode specify high; metadata requests low; no wire trace | The audit in default actf reads from native and judges mismatch; excluded from training | `test_trajectory_audit.py` |
| A5 | Codex off, adaptive | dry-run and runtime use the same validator; both reject | `test_cli.py`, `test_codex.py` |
| A6 | Claude Code logical ultra maps to the transport value ultracode | metadata keeps both; the audit judges a match by the logical ultra | `test_trajectory_audit.py` |
| A7 | A wire recording exception and response association occur together | The tool capture error is still recorded; normal requests keep request_seq | `test_wire_trace.py`, `test_codex_tools.py` |

## B. Real-service matrix

| Stage | Harness | Model | Effort | Trace mode | Sample count |
|---|---:|---:|---:|---|---:|
| Connectivity smoke | 7 | 1 (Qwen) | low | actf | 7 |
| Main matrix | 7 | 7 | off, low, high, max | actf (default path) | 196 |
| Capture control | 7 | 1 (Qwen) | off, low, high, max | full | 28 |

Each cell runs one deterministic tool task: write `outputs/answer.txt`, read it back to verify,
and finally output only the agreed marker. Each cell runs once, with a 180-second timeout and Roller retries=0.
Four batches run concurrently, with two workers per batch. Cells rejected by the parameter gate still count toward the 196
but send no model request. The upstream Harness itself may still retry.

Recorded per cell:

1. Whether the Runner status, the target file, and the final answer all match the marker.
2. Whether the tool call and result counts and the `toolCallId` associations are complete.
3. The `matched/mismatch/unverified/not_observable` of the requested effort and the evidence source
   `wire/native`; "not observed" must not be counted as a match.
4. Whether visible reasoning, the final response completion status, and the ACTF completion status conflict.
5. Whether the per-sample SFT, the aggregate `sft.jsonl`, and the eligibility exclusion reason are consistent.
6. Whether the request and response model names are consistent; a name difference is only recorded, and the actual backend routing is not inferred.
7. Whether the artifacts contain this round's API token in plaintext; the report records only the paths that hit and does not output the token.

`PASS` requires the task, tools, saving, explicitly requested level, and eligibility verdict to pass together;
`S` is an explicit thinking conflict, `U` is an unverified parameter, `T` is a task mismatch,
`D` is a missing tool or save, `R` is a conversion that is impossible because of an unsupported SFT representation,
`C` is an exclusion caused by the completion status, `I` is a timeout,
`H` is an explicit capability gate rejection, and `X` is an execution error. Gated cells stay in the report
but produce no sample or model request.
A strict pass only means that the chain observable in this run passed; it cannot prove the model's internal reasoning level.

## Execution

Put the token in a temporary file **outside the repository** with permission 0600; the command line references only the file path:

```bash
python scripts/verify_thinking_matrix.py smoke --api-base <base-url>/v1 --token-file <token-file>
python scripts/verify_thinking_matrix.py full --api-base <base-url>/v1 --token-file <token-file>
python scripts/verify_thinking_matrix.py control --api-base <base-url>/v1 --token-file <token-file>
```

Each stage writes to the Git-ignored `runs/issue51-review-matrix-20260928/`:
`*-manifest.json`, per-batch logs, `*-results.json`, and Roller's raw artifacts.
The driver log replaces the token with `[REDACTED]`; the final report additionally scans the artifacts.
Delete the temporary credential file after the re-test is complete. If smoke does not produce an auditable sample,
diagnose the configuration or service fault first, and then run the 196-cell main matrix.

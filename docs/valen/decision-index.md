---
title: "Jev Decision Index"
---

# Jev Decision Index

Decision Index is an edition-specific benchmark, distinct from the JevBench task suite and from a generic average accuracy. JevalKit's frozen edition 0.3 public suite preserves the upstream question IDs, candidate order, structured state, gold labels, exclusions and weighting. Its 43 constituent datasets yield 140,178 public requests under that preparation protocol. Public scores do not include private leaderboard components.

Use the benchmark-owned chance-corrected weighted scorer; do not replace it with an unweighted accuracy average. Record edition, prepared data hashes, model revision, engine, failures and unsupported cases. A subset smoke or protocol check is not a full Decision Index result.

[JevalKit setup and scoring dependencies](/docs/jevalkit/quickstart/) · [benchmark protocol and provenance](/docs/jevalkit/benchmarks/) · [model engines](/docs/jevalkit/models/). The dataset implementation remains in [JevalKit](https://github.com/Valen-Team/JevalKit/tree/main/jevalkit/datasets).

---
title: Known limitations
sidebar_label: Known limitations
description: Where Valen's answers become unreliable, measured on public benchmarks, and how to restructure each case.
---

# Known limitations

Each entry says what goes wrong, how large the effect is, and the change that removes it. Measurements compare Valen 0.8B, 2B and 4B with the median of the seven other decision models of 4B parameters or fewer on the [JevalKit](/docs/jevalkit/) leaderboard (Intern-Decision 0.8B, 2B and 4B, StartLux v1.1 0.8B, 2B and 4B, and Liquid d1 3B), on the same benchmark questions, October 2026.

## Rule tables, long lists and arithmetic in the state

Decision models of this size, Valen included, apply a written rule table or find one record in a list reliably only while the table or list is short. Accuracy falls quickly as it grows, and combining numbers is weak at every size.

| Task in the question (ProceduralTypedDecisions) | Valen 0.8B / 2B / 4B | Other decision models up to 4B, median |
| --- | ---: | ---: |
| Route a ticket by a rule table: 4–7 rules, one condition each | 77 / 76 / 97% | 87% |
| 8–13 rules, up to two conditions each | 30 / 34 / 79% | 60% |
| 14–23 rules, up to three conditions each | 15 / 17 / 63% | 36% |
| 36–58 rules, up to four conditions each | 5 / 4 / 29% | 8% |
| Find one record by its ID: list under 1,000 characters | 93 / 92 / 97% | 96% |
| 1,000–4,000 characters | 47 / 49 / 62% | 55% |
| 4,000–16,000 characters | 33 / 34 / 40% | 38% |
| Apply written rules to a structured record | 70 / 74 / 74% | 79% |
| Infer a fact from counts and conflicting reports | 59 / 56 / 62% | 69% |
| Combine numbers: durations, balances, totals | 46 / 49 / 57% | 62% |

**Do the rule, the lookup and the arithmetic in code.** Ask Valen only for the judgments code cannot make, one condition per question, and combine the answers in code. On 40 routing questions with 8–13 rules, one Choice over the categories with the rules in the state scored 33/40 on Valen 4B and 8/40 on 0.8B; one Noul per rule, with code taking the rule that holds, scored 40/40 on both.

## Recorded hard cases

| Case | What happens | Restructure |
| --- | --- | --- |
| The correct category is missing from a Choice | Probability concentrates on the closest supplied candidate; an address change went to shipment tracking at 99.3% | Add a described `none` candidate and route it to review ([unknown categories](/cookbook/unknown-categories/)) |
| A trailing generic sentence ("Please let me know the next step.") | It can move an out-of-scope message back into an in-scope category | Include such suffixed variants in your validation cases; for requests that must never be automated, also ask a Noul about that request itself ("The customer asks to change the delivery address") and route it in code |
| Single-candidate Choice | Always probability 1 and confidence 1 | Ask a Noul instead |
| Score over two-peaked opinions | The expected index lands between the peaks | Read the level probabilities, or split the dimension into Nouls |
| Target occupies a few pixels of a large image | The question fails the human test | Crop or resize around the target in code before sending |
| Clip-wide labels from one frame | One frame describes one moment | Sample several frames, send one per request, average each candidate's probability in code, and count people per frame rather than adding counts across frames ([video tagging](/cookbook/video-tagging/)) |

## Hosted API limits

The hosted API limits the images, questions, candidates and characters in each request ([System One](./api/systemone.md#limits), [Decisions](./api/decisions.md#limits)) and returns HTTP 400 over a limit. It takes one image per request, so an integration that sends several video frames at once fails on every clip; send one frame per request and combine the answers in code.

## Report a case

If a clear question with complete state still gets a confidently wrong answer, open an issue at [Valen-Team/Valen](https://github.com/Valen-Team/Valen/issues) with the request payload, the answer and the answer you expected.

Next: [Question design](./question-design.md) · [Agent skill](./agent-skill.md)

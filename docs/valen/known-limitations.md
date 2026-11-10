---
title: Known limitations
sidebar_label: Known limitations
description: Where Valen's answers become unreliable, measured on public benchmarks, and how to restructure each case.
---

# Known limitations

Each entry says what goes wrong, how large the effect is, and the change that removes it. The benchmark table gives Valen-Decision-1.5 0.8B, 2B and 4B from full [JevalKit](/docs/jevalkit/) runs in November 2026, next to the October 2026 runs of Valen-Decision-1.0 0.8B, 2B and 4B and the median of the seven other decision models of 4B parameters or fewer on the JevalKit leaderboard (Intern-Decision 0.8B, 2B and 4B, StartLux v1.1 0.8B, 2B and 4B, and Liquid d1 3B), all on the same benchmark questions.

## Rule tables, long lists and arithmetic in the state

Valen-Decision-1.5 applies rule tables of up to 58 rules and finds one record in lists of up to 16,000 characters at 96–100% on every size. Valen-Decision-1.0 and the other decision models up to 4B do this reliably only while the table or list is short. Combining numbers is the hardest of these tasks for Valen-Decision-1.5, at 66 / 74 / 81% for 0.8B / 2B / 4B.

| Task in the question (ProceduralTypedDecisions) | Valen-Decision-1.5 0.8B / 2B / 4B | Valen-Decision-1.0 0.8B / 2B / 4B | Other decision models up to 4B, median |
| --- | ---: | ---: | ---: |
| Route a ticket by a rule table: 4–7 rules, one condition each | 100 / 100 / 100% | 77 / 76 / 97% | 87% |
| 8–13 rules, up to two conditions each | 100 / 100 / 100% | 30 / 34 / 79% | 60% |
| 14–23 rules, up to three conditions each | 100 / 100 / 100% | 15 / 17 / 63% | 36% |
| 36–58 rules, up to four conditions each | 99 / 100 / 100% | 5 / 4 / 29% | 8% |
| Find one record by its ID: list under 1,000 characters | 100 / 100 / 100% | 93 / 92 / 97% | 96% |
| 1,000–4,000 characters | 99 / 99 / 100% | 47 / 49 / 62% | 55% |
| 4,000–16,000 characters | 96 / 97 / 100% | 33 / 34 / 40% | 38% |
| Apply written rules to a structured record | 97 / 99 / 99% | 70 / 74 / 74% | 79% |
| Infer a fact from counts and conflicting reports | 94 / 97 / 97% | 59 / 56 / 62% | 69% |
| Combine numbers: durations, balances, totals | 66 / 74 / 81% | 46 / 49 / 57% | 62% |

**Do the arithmetic in code.** Ask Valen only for the judgments code cannot make, one condition per question, and combine the answers in code. On 40 routing questions with 8–13 rules (the first 40 level-1 `taxonomy_routing` records of the ProceduralTypedDecisions test split), Valen-Decision-1.5 0.8B, 2B and 4B on the hosted API answered all 40 correctly both ways, November 2026: one Choice over the categories with the rules in the state, and one Noul per rule with code taking the rule that holds. On Valen-Decision-1.0 the single Choice scored 33/40 on 4B and 8/40 on 0.8B, while one Noul per rule scored 40/40 on both.

## Recorded hard cases

| Case | What happens | Restructure |
| --- | --- | --- |
| The correct category is missing from a Choice | Probability concentrates on the closest supplied candidate; an address change went to shipment tracking at 99.1% on Valen-Decision-1.5-0.8B | Add a described `none` candidate and route it to review ([unknown categories](/cookbook/unknown-categories/)) |
| A generic wrapper sentence ("Hello support.", "Thank you for your help.") | It can move an out-of-scope message back into an in-scope category; on Valen-Decision-1.5-0.8B a size-exchange request chose `none` as written and went to refunds once a greeting or thank-you was added | Include such wrapped variants in your validation cases; for requests that must never be automated, also ask a Noul about that request itself ("The customer asks to change the delivery address") and route it in code |
| Single-candidate Choice | Always probability 1 and confidence 1 | Ask a Noul instead |
| Score over two-peaked opinions | The expected index lands between the peaks | Read the level probabilities, or split the dimension into Nouls |
| Target occupies a few pixels of a large image | The question fails the human test | Crop or resize around the target in code before sending |
| Clip-wide labels from one frame | One frame describes one moment | Sample several frames, send one per request, average each candidate's probability in code, and count people per frame rather than adding counts across frames ([video tagging](/cookbook/video-tagging/)) |

## Hosted API limits

The hosted API limits the images, questions, candidates and characters in each request ([System One](./api/systemone.md#limits), [Decisions](./api/decisions.md#limits)) and returns HTTP 400 over a limit. It takes one image per request, so an integration that sends several video frames at once fails on every clip; send one frame per request and combine the answers in code.

## Report a case

If a clear question with complete state still gets a confidently wrong answer, open an issue at [Valen-Team/Valen](https://github.com/Valen-Team/Valen/issues) with the request payload, the answer and the answer you expected.

Next: [Question design](./question-design.md) · [Agent skill](./agent-skill.md)

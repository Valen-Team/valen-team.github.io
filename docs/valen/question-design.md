---
title: Write questions that work
sidebar_label: Question design
description: How to turn a decision into Valen questions, design text and image state, write candidates, and restructure around recorded hard cases.
---

# Write questions that work

Valen answers typed questions about the state you send. Most accuracy gains come from the shape of the questions and the state, not from clever wording. This page collects the patterns that work and the hard cases recorded so far, each with the restructuring that fixes it.

## Valen judges, code decides

Write the decision as a truth table. Valen supplies the inputs ("Is there a watermark over the product?", "Which intent does the message express?"); code maps them to an action. A question such as "Should this listing be rejected?" hides the business rule inside the model. Split it into the judgments it depends on and keep the rule in code, where it can be read and tested. Arithmetic, dates, exact lookups and policy belong in code too.

## The human test

Could a smart person, shown only this state and this question, answer quickly by intuition? When the answer is no, improve the state first:

- Say what the text is, for example `"inbox": "Customer support email for a small online clothing shop"`. With that one field, a terse "where's my stuff" moved from `none` to shipment tracking at 0.99.
- Include what a person would look at: the subject line and body of an email, the sender of each message, the full thread, names instead of raw IDs, and only the item in question.
- State facts code already knows, and explain internal product names.
- Remove fields no question needs; a field added for one question can sway another.
- Send a JSON object with descriptive keys and refer to parts by path in backticks, such as `message` or `order.items`.
- Keep the user's language: English questions work over Chinese or other-language state.
- Crop images to the region a person would inspect. For video, choose frames in code (the middle frame for a static attribute, several spaced frames for an action) and keep the frame index with each answer.

## One judgment per question

- Ask the observable thing: "Is the product photo blurred?" rather than "Is the photo low quality?".
- Split conditions that lead to different actions, and give each rule in a checklist its own question. Several signs of one judgment (tone, sarcasm and threats all meaning "angry") work better as one Noul whose criteria name them; separate Nouls ORed in code add up their false positives.
- Name the subject directly and phrase the question so that a true answer means yes.
- Keep it plain. Preambles, step-by-step instructions and output formats add noise; option descriptions belong in the candidates.
- When two outcomes keep getting confused, describe the confusing case in the candidate it belongs to. If policy questions land on `refund`, list "questions about shop policies before buying" under `none`. Writing "a policy question is not a refund request" into `refund` mentions the concept there and pulls probability towards it. Rerun the cases that were already right after the change. If the case still lands on the wrong candidate, add a Noul that separates it structurally ("`message` is about an order the customer has already placed") and combine the answers in code.

## Candidates

- Use descriptive candidate values such as `refund_request`; `A` or `option_1` give the model nothing to go on.
- Ask for the distinctions the model can see and map them to business buckets in code: rather than one `other` covering dancing, music and walking, ask for those and map them. When several candidates lead to the same action, add their probabilities before thresholding.
- Keep candidates distinct. Shared wording pulls probability together; split a candidate that covers several meanings.
- Describe each Score level as a situation that reads on its own, lowest first.
- Describe a Noul's false case concretely with `criteria: {"true": "...", "false": "..."}` ("the package arrived on time").
- Use one Noul per statement when several can be true at once.
- Detect mixed requests with one Noul, "The customer makes more than one separate request", next to the intent Choice. One Noul per category drifts high on near-empty messages such as "hi". Its `false` criterion should name what is not a second request, such as a fallback ("exchange it, or refund if you can't") or a background remark, and the cost of review decides where its middle band goes.

## Bundle questions, keep the set stable

Questions in one request share a single forward pass over the state, so bundling them is much cheaper than separate calls. Ask speculatively: include the follow-up question ("Which item is being returned?") with the question that decides whether it matters, and let code read it only when needed.

Valen places a request's questions in one causal sequence ([multi-question inference](./qwen-shared-state.md)), so the other questions and their order are part of the input. Later questions barely move earlier ones, so put the most important, most stable question first. Freeze the set and order you validated, and revalidate after adding, removing or reordering questions. Use a separate request when one question measurably moves another, or when code needs an answer to build the next request.

## Recorded hard cases

Cases where Valen answers less reliably, how large the effect is and how to restructure around each one are on [Known limitations](./known-limitations.md): rule tables, long lists and arithmetic in the state; a missing category; generic trailing sentences; single-candidate Choices; two-peaked Scores; small targets in large images; and labels for a whole clip from one frame.

## Read answers and set thresholds

`confidence` measures how concentrated a distribution is; held-out accuracy decides what to automate. Start Noul thresholds at 0.7 and 0.3 and give the band between them its own outcome, usually review. Start Choice gates at a top probability of 0.8 and a gap of 0.2 to the second. Answers are deterministic for a given payload and model, so one run per wording compares variants. Fit final values on labeled cases from your workflow with the [calibration workflow](./calibration.md), and see [using probabilities](./probabilities.md) for the exact formulas.

## When an answer looks wrong

Check, in order: the payload as sent (images, model ID); the state against the human test; whether the right answer is among the candidates; whether the question can be split; the other questions in the request; and only then the wording. Wording written to force one value, criteria that name test items, and thresholds fitted to a handful of cases tend to break on new inputs. Write a held-out set before iterating and a second one after freezing the final version. Better state, a separate question, or code is the durable fix.

Next: [Agent skill](./agent-skill.md) · [API calls](./api.md) · [Cookbook](/cookbook/)

---
title: "First call"
---

# First call without downloading weights

Valen scores supplied candidates for text, images and video. Start with the hosted text API; availability and quotas depend on the service. No local model or training environment is needed.

```bash
curl https://api.valen-team.workers.dev/v1/decisions \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen-2b","input":"A cat is on the sofa.","questions":[{"name":"cat","type":"predicate","instructions":"A cat is present."}]}'
```

Read `answers[0].probability` as the model's probability of the statement. It is not a correctness guarantee. Confirm available model IDs through [model listing](./api/list-models.md). For authentication, limits and errors see [API](./api.md).

Next: [choose size, format and backend](./choosing.md), [use probabilities](./probabilities.md), or follow a complete [Cookbook workflow](/cookbook/). Local model downloads are optional and can be large.

The 26 October 2026 text probe succeeded for free-service valen-2b / valen-4b; listed valen-0.8b returned 403 (not allowed for the service credential). This page therefore starts with valen-2b. This is a service-availability check, not model quality or all-backend qualification.

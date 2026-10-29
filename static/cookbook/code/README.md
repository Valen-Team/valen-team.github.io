# Valen Cookbook

Runnable code for the [Valen Cookbook](https://valen-team.github.io/cookbook/). Each script matches one page.

```bash
python -m pip install -r requirements.txt
python rerank.py                  # recorded answers, no API key or network needed
python rerank.py --replay off     # call the free hosted API
```

## Recorded answers

Every script that calls the hosted API keeps its answers in `caches/<script>.json`. The recorded requests are the ones each page runs, so the page's command prints the page's result offline.

| `--replay` | Behavior |
| --- | --- |
| `auto` (default) | Use a recorded answer when the request matches; call the model for a new request and record it |
| `only` | Use recorded answers only; the site build runs every recipe this way |
| `off` | Always call the model; record nothing |

A request matches when its model name and full body are the same. Images are matched by their decoded pixels, so recorded answers replay on every platform. `_meta` in each cache file records, for each model name, the model, revision, endpoint and date of its recording, and the script prints it to stderr when it replays.

To record fresh answers, for example after a model update, delete the cache file and run the script once with `--replay auto`. The default endpoint is `https://api.valen-team.workers.dev/v1`; set `--base-url` and `--model`, or `VALEN_BASE_URL` and `VALEN_MODEL`, for another service. Use `--replay off` with your own deployment so its answers stay out of the published caches.

## Recipes

| Script | Command | Inputs |
| --- | --- | --- |
| `api_quickstart.py` | `python api_quickstart.py --asset-dir .` | `samples.json`, `sheep.jpg`, `momos.mp4` |
| `ticket_routing.py` | `python ticket_routing.py` | `samples.json` |
| `product_screening.py` | `python product_screening.py --asset-dir .` | `samples.json`, `sheep.jpg` |
| `video_tagging.py` | `python video_tagging.py --asset-dir .` | `samples.json`, `momos.mp4` |
| `event_monitoring.py` | `python event_monitoring.py --asset-dir .` | `momos.mp4` |
| `function_calling.py` | `python function_calling.py` | `function_calling_data.json` |
| `value_extraction.py` | `python value_extraction.py` | `value_extraction_data.json` |
| `rerank.py` | `python rerank.py` | `rerank_data.json` |
| `citation_check.py` | `python citation_check.py` | `citation_check_data.json` |
| `llm_guardrails.py` | `python llm_guardrails.py` | `llm_guardrails_data.json` |
| `composite_scoring.py` | `python composite_scoring.py` | `composite_scoring_data.json`, `media/mug-*.jpg` |
| `document_check.py` | `python document_check.py` | `document_check_data.json`, `media/loan-*.jpg` |
| `unknown_categories.py` | `python unknown_categories.py demo --text "Please change the delivery address before you ship my order."` | `unknown_categories_data.json` |
| `skill_support_router.py` | `python skill_support_router.py --message "Order was super late AND they forgot my drink" --order-status delivered` | none |

`sheep.jpg` and `momos.mp4` are downloaded separately:

```bash
curl -fL https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/cookbook/sheep.jpg -o sheep.jpg
curl -fL https://raw.githubusercontent.com/Valen-Team/Valen/main/assets/cookbook/momos.mp4 -o momos.mp4
```

Three recipes run a model on your machine and use no hosted answers: `local_inference.py` (ONNX through `Valen.local`), `calibrated_ticket_routing.py` (a local model's logits with your fitted calibration and policy) and `domain_finetuning.py` (LoRA training). Their pages list the model files they need.

## Licences

Code is under [Apache-2.0](LICENSE.txt). [DATA_SOURCES.md](DATA_SOURCES.md) lists where each data and media file comes from.

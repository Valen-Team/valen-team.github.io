---
title: Migration map
---

# Ownership and migration map

The four notebooks are two tutorials in two languages, not four distinct applications. This inventory separates duplicated material from content worth preserving. Complete tutorial code and JSON samples live only in the website repository; API and deployment references retain their own responsibilities.

| Previous source | Treatment and unique value retained | Maintained destination |
| --- | --- | --- |
| `Valen/cookbook/api_quickstart.ipynb` | Preserve API setup and the original text, image and sampled-video-frame examples; remove notebook-only display dependencies | [API basics](../api-quickstart/) |
| `Valen/cookbook/api_quickstart_zh.ipynb` | Chinese translation; shares executable source with English | [Chinese API basics](https://valen-team.github.io/zh-Hans/cookbook/api-quickstart/) |
| `Valen/cookbook/local_inference.ipynb` | Preserve native loading, both protocols, all three decision kinds, direct video and the unique action question; add an ONNX branch | [Local inference basics](../local-inference/) |
| `Valen/cookbook/local_inference_zh.ipynb` | Chinese translation; shares source and actual outputs | [Chinese local basics](https://valen-team.github.io/zh-Hans/cookbook/local-inference/) |
| Website `/docs/valen/quickstart/` and Chinese counterpart | Move complete image/video tutorial steps to Cookbook; retain installation, model loading, minimal protocol calls and execution/temperature reference; preserve the existing route | [Local inference basics](../local-inference/) |
| Website API reference and three interactive home-page examples | Retain protocol/field/error reference and shortest calls; interactive examples import the Cookbook sample JSON, with Chinese interaction copy retained | [API basics](../api-quickstart/) and API reference |
| Main README, bilingual inference/data-format docs, website resources/overview and old blog references | Update controllable notebook links; retain deployment and training-format reference | This directory and the foundation tutorials |
| Python/JavaScript SDK README multi-question business explanation and media walkthroughs | Replace application walkthroughs with Cookbook links; retain installation, minimal calls, backend options, browser integration and low-level media interface examples | [Ticket routing](../ticket-routing/), [product screening](../product-screening/), [video tagging](../video-tagging/) |
| C++ SDK | No duplicated complete notebook application; retain its unique SystemOne C++ text integration and add the Cookbook entry | Cookbook and C++ SDK reference |
| Native HF 0.8B/2B/4B cards with complete image/video walkthroughs | Remove duplicated media tutorials; retain shortest text calls, model configuration, protocol and download/training details | [Local inference basics](../local-inference/) |
| Bilingual ONNX/GGUF HF cards | Retain format-specific installation, graph/weight limits, quality checks and service startup; link complete workflows to Cookbook | Cookbook and backend deployment reference |
| `Valen-API` demo application | Retain unique browser behavior and bundled media; update provenance link; the interactive demo is not a second maintained tutorial | Official Cookbook |
| `Valen/assets/cookbook/` | Preserve shared media and stable URLs used by SDKs; do not remove with notebooks | Existing asset URLs |

Ticket routing adds review and ranking to the original intent example. Product screening adds matching/mismatching listing metadata to the sheep question. Video tagging adds frame provenance to the sauce-color question. These applications reuse the existing content rather than multiplying identical calls under different titles.

## What happens to old links

Controllable links point to the new home. `/docs/valen/quickstart/` remains a deployment reference. The website also provides filename-style convenience redirects such as `/cookbook/api_quickstart/`. Deleted GitHub `.ipynb` URLs **cannot be redirected by this website**. Update bookmarks and external links; notebooks in historical Git commits are historical snapshots, not maintained tutorials.

Deletion order: migrate → build and check links → deploy and verify live pages → delete the old notebooks. The old directory may retain only a short migration README. See [validation](../validation/) for execution and publication status.

## Maintenance sources

- Articles: website `cookbook/` and `i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current/`.
- Executable code and data: website `static/cookbook/code/`; pages import the code and the ZIP is generated from it.
- Actual outputs: `static/cookbook/results.json`; raw checks and performance reports are downloadable from validation.
- Main repository, SDKs and HF link complete workflows instead of copying application tutorials.

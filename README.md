# Valen website

The public site has two entry points: **Ask Valen** at `/` and **Documentation**
at `/docs/`. English is the default; Simplified Chinese lives at `/zh-Hans/`.
Documentation is grouped under Valen and JevalKit. Legacy project, about, and
news page URLs redirect to documentation. News publishing is disabled.

## Local development

Requires Node.js 22+ and npm.

```bash
npm ci
npm start
# Chinese development server:
npm start -- --locale zh-Hans
```

For a bilingual preview with the public API bridge:

```bash
npm run build
npm run preview:local
```

Open http://127.0.0.1:3030/. This loopback-only server bridges `/api/decisions`
to the public Worker with the required Origin. It stores no credentials and
makes no model request until a visitor submits a question.

## Chat and API

The empty composer accepts text, JPG/PNG/WebP images up to 3 MB, and
browser-decodable MP4/WebM videos up to 20 MB. Videos are processed locally:
only a resized JPEG of the middle frame is sent. A frame cannot establish motion
or event order. Three localized examples are available beneath the composer.
Conversation history stays in memory; recent decisions are included as bounded context.

The three output modes use native `predicate`, `choice`, and `score` requests.
Predicate displays `probability` and Yes/No bars; Yes corresponds to probability
at least 0.5. Choice displays the chosen alternative and its distribution.
Score displays the API's probability-weighted level index and distribution;
five ordered levels span **0–4**. Optional confidence is shown separately.
Raw answer JSON is available in result details.

The public endpoint is `https://api.valen-team.workers.dev/v1/decisions`.
`VALEN_DEMO_PROXY_URL` can override it at build time. Four models are selectable:
`valen-preview-0923`, `valen-2b`, `valen-4b`, and `valen-0-8b`.
Higher quotas can be requested from liuziyu77@sjtu.edu.cn.

`api-proxy/worker-dashboard.mjs` requires only the `VALEN_API_KEY` Worker Secret
and uses a best-effort per-instance limiter. `api-proxy/worker.mjs` uses the
`PER_IP` and `SHARED_BUDGET` bindings configured in `wrangler.jsonc`.
The upstream secret must never enter frontend code or the static build.
Origin checks are not authentication. Client requests time out after two minutes.

## Documentation

English sources are in `docs/`; Chinese sources are in
`i18n/zh-Hans/docusaurus-plugin-content-docs/current/`. One Docusaurus docs plugin
serves both locales. Local inference uses `noul`; the hosted API uses `predicate`
and `probability`. These contracts are documented separately.
Search indexes only the current documentation. Imported technical references
retain their source provenance in `content-sources.json` and the corresponding pages.
`node scripts/sync-docs.mjs --update` refreshes upstream snapshots and requires
review of any changes against the hosted API documentation.

## Build and publication

```bash
npm run typecheck
npm run build
npm run check-links
```

`npm run test:ask` runs isolated helper tests without network requests.
Pushes to `main` trigger `.github/workflows/deploy.yml`. Enable GitHub Pages
with **GitHub Actions** as the source. The workflow builds both languages and
publishes `build/` to https://valen-team.github.io/.

## Design and assets

The bundled design system is in `src/design-system/`, with a SHA-256 manifest.
Run `npm run design:check` to check snapshot integrity. The adjacent shared source
can be compared with `npm run design:verify-source`; export an intentional shared
release before updating consumers. Modern styles include the site's approved
layout and token profile. Fonts, brand assets, and imported materials retain
their license and attribution files. See `NOTICE.md`.

# Valen Team website

Organization homepage, project documentation, and news for **Valen Team / 万澜**.

Built with Docusaurus. Navigation: **Docs → Projects → News → About**. English is the default language, with a complete Simplified Chinese edition at `/zh-Hans/`.

## Local review

Requires Node.js 22+ and npm.

```bash
npm ci
npm run build
npm run serve -- --port 3000
```

Open http://localhost:3000. The production preview includes **both languages**. For fast editing of one locale:

```bash
npm start
# or
npm start -- --locale zh-Hans
```

## Checks

```bash
npm run typecheck
npm run build
npm run check-links
```

The link checker verifies internal pages, assets, and anchors in the generated website. Search runs locally in the browser against a generated bilingual index and does not require a search service.

### Build dependency audit

On 2026-10-19, `npm audit` reports one unresolved upstream advisory in `braces@3.0.3` (deeply nested glob patterns can exhaust the stack), propagated through the affected dependency chain. There is no published fix for that package at the time of review. It is part of the Node build toolchain; the deployed output is static HTML/CSS/JS. Patched transitive versions of the other flagged build dependencies are selected through `overrides` and verified by the production build.

## Content

| Location | Contents |
| --- | --- |
| `src/pages/` | Home, projects, benchmark, about |
| `src/components/` | Shared project data, news summaries, branded presentation |
| `docs/` | English documentation |
| `blog/` | English news and release posts |
| `i18n/zh-Hans/` | Chinese documents, posts, and UI translations |
| `src/theme/` | Local search and news index |
| `static/` | Branding, recorded demo, generated search index |
| `content-sources.json` | Source repositories, paths, and blob hashes of imported technical docs |

Technical references are synchronized snapshots from `Valen-Team/Valen` and `Valen-Team/JevalKit`, retrieved on 2026-10-19. Each imported page retains its source link and blob hash. To verify and regenerate those exact snapshots:

```bash
node scripts/sync-docs.mjs
```

To explicitly update snapshots to the current upstream branch:

```bash
node scripts/sync-docs.mjs --update
```

News is maintained as Markdown posts. Add a matching Chinese post with the same filename and slug. The three homepage news summaries live in `src/components/Content.ts`.

Reference flowcharts are accessible static SVGs. Their rendering source is `scripts/render-diagrams.mjs`; run it after editing a chart. The sync script stops before writing if an upstream graph changes, so its SVG can be reviewed and updated alongside `scripts/diagram-sources.json`. Local figures are separate snapshots and should be refreshed explicitly when the upstream figures change. No client-side chart library is needed.

## Review and publication

This repository was initialized locally on `main`. No GitHub repository was created, no remote was configured, and no files were pushed during initial creation.

After approval, create `Valen-Team/valen-team.github.io` on GitHub and push the reviewed files. Enable Pages with **GitHub Actions** as its source, then manually run **Deploy GitHub Pages**. The prepared workflow has no push trigger. The expected production URL is `https://valen-team.github.io/`.

## Sources and assets

- Organization copy and original blue mark: [Valen-Team/.github](https://github.com/Valen-Team/.github).
- Recorded Sokoban rollout: [Valen](https://github.com/Valen-Team/Valen/tree/main/assets/demos/games).
- Model, toolkit, dataset, and release facts: the corresponding public project READMEs and docs, linked from the site.
- The current blue V mark is the user-supplied Valen brand asset, with a white-background version prepared using built-in imagegen. Shared styles and locally hosted fonts come from the versioned design-system snapshot.
- Upstream projects are Apache-2.0; their terms continue to apply to imported material. See `NOTICE.md`.

## Shared design system

This site consumes **Valen Design System 0.2.0**, the local source for the proposed private `Valen-Team/design-system` repository. New Valen blue branding, white logo surfaces, the original editorial typography and orbital illustration, shared components, and the Infima adapter live in `src/design-system/`. Layout remains in `src/css/custom.css`. JevalKit retains its original project mark and local teal accent.

```sh
# Check the bundled release; no access to the private source is needed.
npm run design:check
# Compare with the adjacent local source repository.
npm run design:verify-source
# After editing the source, update this consumer:
node ../design-system/scripts/export.mjs .
```

The snapshot includes a version and SHA-256 file manifest. Fonts are locally hosted under the SIL Open Font License (`src/design-system/assets/fonts/OFL.txt`). Design changes do not alter benchmark data or technical documentation. The new logo remains on a pure white surface; the concept illustration retains the original wave and orbital composition in a coordinated blue palette.

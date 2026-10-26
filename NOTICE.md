# Content and asset provenance

Technical reference documents in `content-sources.json` are adapted from:

- [Valen-Team/Valen](https://github.com/Valen-Team/Valen), Apache License 2.0.
- [Valen-Team/JevalKit](https://github.com/Valen-Team/JevalKit), Apache License 2.0.

Changes include documentation frontmatter, removal of redundant language links, rewritten navigation links, static SVG renderings of the two model flowcharts, and historical source attribution. The JevalKit installation guide includes a repository checkout step. Source paths and content blob hashes are recorded in `content-sources.json`.

The current blue V / wave mark was supplied by the user on 2026-10-19 and is with a white-background version prepared using built-in imagegen. The JevalKit project mark is from `Valen-Team/JevalKit/assets/branding/jevalkit-light.svg`, commit `843c40d`. The Sokoban preview is from `Valen-Team/Valen/assets/demos/games/valen-sokoban-preview.gif`. The architecture figure is from `Valen-Team/Valen/assets/figures/readme-architecture.png`. Branding assets identify Valen Team; this notice does not grant third-party trademark rights.

Project and news copy is based on the linked public READMEs. New site layout, components, and the brand presentation were created for this local website draft. The existing site-code licensing policy is unchanged.

The Apache License 2.0 text for upstream material is in `LICENSE-UPSTREAM.txt`.

DM Sans and Space Grotesk are bundled under the SIL Open Font License. Copyright notices and license texts are retained in `src/design-system/assets/fonts/OFL.txt`. Shared design-system release metadata and asset sources are included alongside the snapshot.

## Cookbook migration (2026-10-26)

The Cookbook adapts the two bilingual notebooks formerly maintained in Valen, Apache-2.0. Executable code and authored JSON samples are maintained only in `static/cookbook/code/` under the included Apache-2.0 notice. Pages import those source files; the ZIP is generated. The old media URLs stay in `Valen/assets/cookbook/`; the migration creates no new media copies. Their original dataset attribution and separate media license were not recorded in the old notebooks, so the code license does not relicense them. See each recipe's provenance section.

## P2 documentation consolidation

Website prose is maintained here; content-sources.json is historical provenance, not a synchronization input. Migrated historical measurement/experiment details retain their original scope. The new domain_finetuning.py code uses the Cookbook Apache-2.0 license; its newly authored synthetic support text/labels are CC0-1.0, explicitly separated from third-party media.

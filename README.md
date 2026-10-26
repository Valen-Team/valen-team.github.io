# Valen website

Website and documentation for Valen and JevalKit: [valen-team.github.io](https://valen-team.github.io/).

## Local development

Requires Node.js 22+ and npm.

```bash
npm ci
npm start
```

## Build

```bash
npm run build
npm run serve
```

## Cookbook maintenance

Complete tutorials live in `cookbook/` and the matching Chinese docs-plugin locale directory. Executable code/data live only in `static/cookbook/code/`. MDX imports those files through the built-in Webpack asset/source rule, without another loader dependency. `python3 scripts/check-cookbook.py --bundle` checks policies and real-execution source hashes, then creates the deterministic download ZIP. Build and links are checked by Pages CI.

Immutable real-model outputs, failed attempts, runtime integrity and benchmark records are under `static/cookbook/validation/`; `versions.json` is the shared version/scope manifest. Update recorded hashes only after real execution of changed code. Never use synthetic checks to mark real-model validation passed.

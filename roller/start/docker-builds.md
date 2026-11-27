---
title: "Docker builds and package mirrors"
---

# Docker builds and package mirrors

This page describes how to select package repositories, base images, and proxies when building a Roller-provided Harness image locally.

The quickstart with OpenClaw usually does not require the build arguments below. Roller uses a pinned official OpenClaw image directly. See the [OpenClaw Harness guide](/roller/harnesses/openclaw-configuration/) for image preparation and overrides.

Prebuilt `linux/amd64` images of Codex, Hermes, OpenCode, DeepSeek, and Pi are published at `ghcr.io/valen-team`; each Harness guide gives the `docker pull` command, and pulling one avoids the build entirely. Claude Code has no prebuilt image and is always built locally.

Codex, Claude Code, Hermes, OpenCode, DeepSeek, and Pi use Dockerfiles in this repository. When the public package services are reachable, follow the default build command in the corresponding Harness guide. Continue with this page only when downloads are slow, an internal package service is required, a different base image is needed, or the build must use a proxy.

## 1. Identify the image source first

| Harness | How the image is prepared | Relevant parts of this page |
| --- | --- | --- |
| [OpenClaw](/roller/harnesses/openclaw-configuration/) | Uses a pinned upstream official image | The Roller Dockerfile arguments below do not apply |
| [Codex](/roller/harnesses/codex-configuration/) | Build locally with [`docker/codex/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/codex/Dockerfile) | Debian repositories and npm registry |
| [Claude Code](/roller/harnesses/claude-code-configuration/) | Build locally with [`docker/claude-code/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/claude-code/Dockerfile) | Debian repositories and npm registry |
| [Hermes](/roller/harnesses/hermes-configuration/) | Build locally with [`docker/hermes/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/hermes/Dockerfile) | Debian repositories, Hermes Python sources, base image, and proxies |
| [OpenCode](/roller/harnesses/opencode-configuration/) | Build locally with [`docker/opencode/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/opencode/Dockerfile) | Debian repositories, npm registry, base image, and proxies |
| [DeepSeek](/roller/harnesses/deepseek-configuration/) | Build locally with [`docker/deepseek/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/deepseek/Dockerfile) | Debian repositories, base image, and proxies |
| [Pi](/roller/harnesses/pi-configuration/) | Build locally with [`docker/pi/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/pi/Dockerfile) | Debian repositories, npm registry, base image, and proxies |

The corresponding Harness guide linked in the table provides the default image name, pinned version, and complete build command. This page covers download sources used during the build. Pass these settings to `docker build` with `--build-arg`. They are not `roller collect` options.

## 2. Choose settings by the failing download step

The arguments below have different scopes. Do not pass every argument to every Harness.

| Build step that cannot download | Applicable Harnesses | Settings |
| --- | --- | --- |
| Debian packages downloaded by `apt-get` | All six locally built Harnesses | `DEBIAN_MIRROR` and `DEBIAN_SECURITY_MIRROR` |
| Agent or plugin dependencies downloaded from npm | Codex, Claude Code, OpenCode, and Pi | `NPM_REGISTRY` |
| uv installed by pip | Hermes only | `PIP_INDEX_URL` and `PIP_TRUSTED_HOST` |
| Hermes dependencies downloaded from `uv.lock` | Hermes only | `PYPI_DOWNLOAD_BASE` and `UV_INSECURE_HOST` |
| A prepared base image | Hermes, OpenCode, DeepSeek, and Pi | `BASE_IMAGE` |
| Base-image pulls, GitHub access, or other downloads | Any affected Harness | Docker proxy and Docker daemon network settings |

## 3. Debian repositories

All six local Dockerfiles support these arguments:

| Argument | Purpose | When unset or empty |
| --- | --- | --- |
| `DEBIAN_MIRROR` | Debian main repository URL | Keep the base image's main repository settings |
| `DEBIAN_SECURITY_MIRROR` | Debian security repository URL | Keep the base image's security repository settings |

The two URLs work independently. Setting the main repository does not change the security repository. The security URL does not need to be the main URL with `-security` appended.

This Pi example configures the Debian main repository, security repository, and npm registry together. Replace the example addresses with working endpoints:

```bash
docker build \
  --build-arg DEBIAN_MIRROR=http://apt.example/repository/debian-proxy \
  --build-arg DEBIAN_SECURITY_MIRROR=http://apt.example/repository/debian-security-proxy \
  --build-arg NPM_REGISTRY=https://npm.example/repository/npm-proxy/ \
  -t roller-pi:1.6.1 docker/pi
```

The build checks `/etc/apt/sources.list` and the `.list` and `.sources` files under `/etc/apt/sources.list.d/`. It replaces complete official Debian repository URLs only. Distribution suites, components, and signature settings remain unchanged.

Custom repositories that already use other URLs, Ubuntu repositories, and third-party repositories remain unchanged. A missing source file is skipped. OpenCode, Pi, and DeepSeek run apt only when the base image lacks required tools. Hermes, Codex, and Claude Code run apt installation.

The Node slim base images used by Pi, Codex, and Claude Code may lack a system CA bundle. Before the first HTTPS apt request, the build checks `/etc/ssl/certs/ca-certificates.crt`. If the file is missing or empty, the build initializes it from [Node's bundled Mozilla root certificates](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlsrootcertificates). An existing non-empty file is preserved. HTTPS certificate verification and apt repository signature checks remain enabled.

## 4. npm registry

Only the four Harnesses that download content from npm use `NPM_REGISTRY`:

| Harness | Behavior when unset or empty |
| --- | --- |
| Codex | Use the existing npm configuration, including the base image's `.npmrc` |
| Claude Code | Use the existing npm configuration, including the base image's `.npmrc` |
| Pi | Use the existing npm configuration, including the base image's `.npmrc` |
| OpenCode | Use `https://registry.npmjs.org` |

Codex, Claude Code, and Pi use a non-empty `NPM_REGISTRY` during installation only. The value is not saved as a runtime environment variable in the image.

An OpenCode mirror must serve both npm package metadata and tarballs. Pi still downloads `fd` from GitHub Releases. Changing the npm registry does not redirect that download.

## 5. Python package sources for Hermes

This section applies only to Hermes. The Hermes image has two separate Python dependency steps, so it exposes two groups of settings:

1. pip installs the pinned uv version.
2. uv downloads the locked Hermes dependencies from `uv.lock`.

| Argument | Step controlled | Default |
| --- | --- | --- |
| `PIP_INDEX_URL` | pip installation of the pinned uv version | `https://pypi.org/simple` |
| `PIP_TRUSTED_HOST` | Host or host and port explicitly trusted by pip | Unset |
| `PYPI_DOWNLOAD_BASE` | Replaces the `files.pythonhosted.org` prefix in `uv.lock` | `https://files.pythonhosted.org` |
| `UV_INSECURE_HOST` | Host where uv explicitly permits an insecure connection | Unset |

`PIP_INDEX_URL` affects the uv installation only. It does not redirect dependency URLs already locked in `uv.lock`. `PYPI_DOWNLOAD_BASE` replaces only the download prefix in the lock file. The mirror must preserve the `/packages/` path layout. Dependency versions and SHA-256 checks remain unchanged. Hermes source is still fetched from GitHub.

Prefer an HTTPS index with a valid certificate. If a trusted internal HTTP index is required, explicitly configure its host:

```bash
docker build \
  --build-arg PIP_INDEX_URL=http://pypi.internal/simple \
  --build-arg PIP_TRUSTED_HOST=pypi.internal \
  -t roller-hermes:8fc037444731 docker/hermes
```

`PIP_TRUSTED_HOST` affects pip only. If the uv download host also needs relaxed connection checks, set `UV_INSECURE_HOST` separately. Neither option is enabled by default. See [pip trusted-host](https://pip.pypa.io/en/stable/cli/pip/#cmdoption-trusted-host) and [uv insecure host](https://docs.astral.sh/uv/reference/environment/#uv_insecure_host) for details.

The DeepSeek and OpenCode Dockerfiles also install Python components, but they do not currently expose these four Hermes-specific build arguments. They use the normal network and proxy settings, so the arguments in this section should not be copied to those builds. See their Harness guides for image requirements and default build commands.

## 6. Base images, proxies, and private CAs

The settings above control apt, npm, or the Hermes Python download steps. They do not make the entire build work offline. Base images, GitHub downloads, and other dependencies still require network access or an internal proxy.

- Hermes, OpenCode, DeepSeek, and Pi accept `BASE_IMAGE` to select a prepared base image.
- HTTP requests during the build can use Docker's `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` build arguments.
- Internal mirror addresses usually belong in `NO_PROXY`.
- The Docker daemon pulls base images and needs its own network and registry configuration.

See [Docker build variables](https://docs.docker.com/build/building/variables/#proxy-arguments) for proxy settings.

If an internal HTTPS package service uses a private CA, install that CA in the base image's system trust store first. Node's bundled roots do not include private enterprise CAs.

## 7. Maintainer build tests

This section is for regression checks after changing a Dockerfile or mirror behavior. Users who only need to build a Harness image can skip it.

Run the configuration tests from the repository root. CA initialization tests require Node, and npm configuration tests require npm:

```bash
python -m unittest discover -s tests -p test_docker_build_config.py -v
```

The real HTTPS test is skipped by default. It requires Docker and network access to `deb.debian.org`:

```bash
docker pull node:22.22.0-bookworm-slim
docker pull node:22-bookworm-slim
ROLLER_DOCKER_BUILD_NETWORK_TEST=1 python -m unittest discover \
  -s tests -p test_docker_build_https.py -v
```

The test uses the three Node Harnesses' default base images and checks CA initialization, repository rewriting, and apt installation. It does not install the Harness npm dependencies or call a model API.

The test passes `http_proxy`, `https_proxy`, `no_proxy`, and their uppercase forms to the container. If a proxy uses the host loopback address on Linux, set `ROLLER_DOCKER_TEST_NETWORK=host`. This changes the test container network only and does not modify Docker daemon configuration.

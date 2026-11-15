---
title: "Docker 构建与镜像源"
---

# Docker 构建与镜像源

本页说明在本地构建 Roller 提供的 Harness 镜像时，如何选择软件源、基础镜像和代理。

按照快速上手使用 OpenClaw 时，通常无需使用下文的构建参数。Roller 直接使用固定版本的 OpenClaw 官方镜像，镜像准备和替换方法见 [OpenClaw Harness 指南](/roller/harnesses/openclaw-configuration/)。

Codex、Hermes、OpenCode、DeepSeek 和 Pi 的 `linux/amd64` 预构建镜像发布在 `ghcr.io/valen-team`，各 Harness 指南给出了 `docker pull` 命令，拉取后无需构建。Claude Code 不提供预构建镜像，始终在本地构建。

Codex、Claude Code、Hermes、OpenCode、DeepSeek 和 Pi 使用本仓库中的 Dockerfile 构建镜像。可正常访问公共软件源时，按照各 Harness 指南中的默认命令构建即可。仅在下载缓慢、需要使用内部软件源、更换基础镜像或配置代理时，才需继续阅读本页。

## 1. 先确认镜像来源

| Harness | 镜像准备方式 | 本页适用内容 |
| --- | --- | --- |
| [OpenClaw](/roller/harnesses/openclaw-configuration/) | 使用固定版本的上游官方镜像 | 下文的 Roller Dockerfile 构建参数不适用 |
| [Codex](/roller/harnesses/codex-configuration/) | 使用 [`docker/codex/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/codex/Dockerfile) 本地构建 | Debian 软件源和 npm registry |
| [Claude Code](/roller/harnesses/claude-code-configuration/) | 使用 [`docker/claude-code/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/claude-code/Dockerfile) 本地构建 | Debian 软件源和 npm registry |
| [Hermes](/roller/harnesses/hermes-configuration/) | 使用 [`docker/hermes/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/hermes/Dockerfile) 本地构建 | Debian 软件源、Hermes Python 软件源、基础镜像和代理 |
| [OpenCode](/roller/harnesses/opencode-configuration/) | 使用 [`docker/opencode/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/opencode/Dockerfile) 本地构建 | Debian 软件源、npm registry、基础镜像和代理 |
| [DeepSeek](/roller/harnesses/deepseek-configuration/) | 使用 [`docker/deepseek/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/deepseek/Dockerfile) 本地构建 | Debian 软件源、基础镜像和代理 |
| [Pi](/roller/harnesses/pi-configuration/) | 使用 [`docker/pi/Dockerfile`](https://github.com/Valen-Team/Roller/blob/main/docker/pi/Dockerfile) 本地构建 | Debian 软件源、npm registry、基础镜像和代理 |

默认镜像名称、版本和完整构建命令见上表链接的对应 Harness 指南。本页仅说明构建时的下载源设置。这些设置通过 `docker build --build-arg` 传入，不是 `roller collect` 参数。

## 2. 根据下载步骤选择配置

下文的参数适用范围不同，请勿将所有参数同时传给每个 Harness。

| 无法完成下载的构建步骤 | 适用 Harness | 使用的配置 |
| --- | --- | --- |
| `apt-get` 下载 Debian 软件包 | 六个本地构建的 Harness | `DEBIAN_MIRROR` 和 `DEBIAN_SECURITY_MIRROR` |
| npm 下载 Agent 或插件依赖 | Codex、Claude Code、OpenCode、Pi | `NPM_REGISTRY` |
| pip 安装 uv | 仅 Hermes | `PIP_INDEX_URL` 和 `PIP_TRUSTED_HOST` |
| uv 根据 `uv.lock` 下载 Hermes 依赖 | 仅 Hermes | `PYPI_DOWNLOAD_BASE` 和 `UV_INSECURE_HOST` |
| 使用已经准备好的基础镜像 | Hermes、OpenCode、DeepSeek、Pi | `BASE_IMAGE` |
| 拉取基础镜像、访问 GitHub 或其他下载 | 涉及对应下载的 Harness | Docker 代理和 Docker daemon 网络配置 |

## 3. Debian 软件源

六个本地 Dockerfile 均支持以下两个参数：

| 参数 | 用途 | 未设置或为空时 |
| --- | --- | --- |
| `DEBIAN_MIRROR` | Debian 主仓库地址 | 保留基础镜像的主源配置 |
| `DEBIAN_SECURITY_MIRROR` | Debian 安全仓库地址 | 保留基础镜像的安全源配置 |

两个地址独立生效。只设置主源不会修改安全源，安全源也不必是主源地址加 `-security`。

以下以 Pi 为例，同时设置 Debian 主源、安全源和 npm registry。请将示例地址替换为实际可用的地址：

```bash
docker build \
  --build-arg DEBIAN_MIRROR=http://apt.example/repository/debian-proxy \
  --build-arg DEBIAN_SECURITY_MIRROR=http://apt.example/repository/debian-security-proxy \
  --build-arg NPM_REGISTRY=https://npm.example/repository/npm-proxy/ \
  -t roller-pi:0.85.1 docker/pi
```

构建会检查 `/etc/apt/sources.list` 和 `/etc/apt/sources.list.d/` 中的 `.list` 与 `.sources` 文件，只替换完整的 Debian 官方仓库地址。发行版代号、组件和签名配置保持不变。

已经指向其他地址的自定义仓库、Ubuntu 仓库和第三方仓库不会被修改。没有对应源文件时会跳过替换。OpenCode、Pi 和 DeepSeek 仅在基础镜像缺少所需工具时执行 apt。Hermes、Codex 和 Claude Code 会执行 apt 安装。

Pi、Codex 和 Claude Code 使用的 Node slim 基础镜像可能没有系统 CA 证书包。构建会在首次访问 HTTPS apt 软件源前检查 `/etc/ssl/certs/ca-certificates.crt`。文件缺失或为空时，构建将使用 [Node 内置的 Mozilla 根证书](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlsrootcertificates) 初始化。已有的非空证书文件不会被覆盖，HTTPS 证书验证和 apt 仓库签名校验也不会被关闭。

## 4. npm registry

只有需要从 npm 下载内容的四个 Harness 使用 `NPM_REGISTRY`：

| Harness | 未设置或为空时的行为 |
| --- | --- |
| Codex | 沿用 npm 配置，包括基础镜像中的 `.npmrc` |
| Claude Code | 沿用 npm 配置，包括基础镜像中的 `.npmrc` |
| Pi | 沿用 npm 配置，包括基础镜像中的 `.npmrc` |
| OpenCode | 使用 `https://registry.npmjs.org` |

Codex、Claude Code 和 Pi 只在安装步骤中使用非空的 `NPM_REGISTRY`，不会把它保存为镜像运行时环境变量。

OpenCode 使用的软件源须同时提供 npm 包元数据和 tarball。Pi 使用的 `fd` 仍从 GitHub Releases 下载，修改 npm registry 不会改变该下载地址。

## 5. Hermes 的 Python 软件源

本节仅适用于 Hermes。Hermes 镜像的 Python 依赖分为两个下载步骤，因此提供两组配置：

1. pip 安装固定版本的 uv。
2. uv 按照 Hermes 的 `uv.lock` 下载锁定依赖。

| 参数 | 控制的步骤 | 默认值 |
| --- | --- | --- |
| `PIP_INDEX_URL` | pip 安装固定版本的 uv | `https://pypi.org/simple` |
| `PIP_TRUSTED_HOST` | pip 显式信任的主机或主机与端口 | 未设置 |
| `PYPI_DOWNLOAD_BASE` | 替换 `uv.lock` 中 `files.pythonhosted.org` 下载地址的前缀 | `https://files.pythonhosted.org` |
| `UV_INSECURE_HOST` | uv 显式允许不安全连接的主机 | 未设置 |

`PIP_INDEX_URL` 只影响安装 uv，不会重定向 `uv.lock` 中已经锁定的依赖下载。`PYPI_DOWNLOAD_BASE` 只替换锁文件中的下载前缀，该软件源须保留 `/packages/` 路径布局。依赖版本和 SHA-256 校验保持不变。Hermes 源码仍从 GitHub 拉取。

优先使用证书有效的 HTTPS 索引。若必须使用可信的内部 HTTP 索引，须显式配置对应主机：

```bash
docker build \
  --build-arg PIP_INDEX_URL=http://pypi.internal/simple \
  --build-arg PIP_TRUSTED_HOST=pypi.internal \
  -t roller-hermes:d15ed4445207 docker/hermes
```

`PIP_TRUSTED_HOST` 只控制 pip。若 uv 下载端也需要放宽连接校验，须单独设置 `UV_INSECURE_HOST`。两者默认均不启用。具体规则见 [pip trusted-host](https://pip.pypa.io/en/stable/cli/pip/#cmdoption-trusted-host) 和 [uv insecure host](https://docs.astral.sh/uv/reference/environment/#uv_insecure_host)。

DeepSeek 和 OpenCode 的 Dockerfile 也会安装 Python 组件，但当前没有提供这四个 Hermes 专属构建参数。它们使用常规的网络和代理设置，不应将本节参数用于这些构建。镜像要求和默认构建命令见各自的 Harness 指南。

## 6. 基础镜像、代理和私有 CA

以上参数只控制 apt、npm 或 Hermes 的 Python 下载步骤，不能使整个构建离线完成。基础镜像、GitHub 下载和其他依赖仍需要可用的网络或内部代理。

- Hermes、OpenCode、DeepSeek 和 Pi 可以通过 `BASE_IMAGE` 使用已经准备好的基础镜像。
- 构建中的 HTTP 请求可以使用 Docker 的 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY` 构建参数。
- 内部软件源地址通常需要加入 `NO_PROXY`。
- 基础镜像由 Docker daemon 拉取，需单独配置 daemon 的网络和镜像仓库。

代理参数用法见 [Docker 构建变量](https://docs.docker.com/build/building/variables/#proxy-arguments)。

若内部 HTTPS 软件源使用私有 CA，请先将该 CA 安装到基础镜像的系统信任库中。Node 内置根证书不包含企业私有 CA。

## 7. 维护者构建测试

本节用于修改 Dockerfile 或软件源逻辑后的回归检查。仅需构建 Harness 镜像时可跳过本节。

在仓库根目录运行配置测试。CA 初始化测试需要 Node，npm 配置测试需要 npm：

```bash
python -m unittest discover -s tests -p test_docker_build_config.py -v
```

真实 HTTPS 测试默认跳过。它需要 Docker 和能够访问 `deb.debian.org` 的网络：

```bash
docker pull node:22.22.0-bookworm-slim
docker pull node:22-bookworm-slim
ROLLER_DOCKER_BUILD_NETWORK_TEST=1 python -m unittest discover \
  -s tests -p test_docker_build_https.py -v
```

该测试使用三个 Node Harness 的默认基础镜像，验证证书初始化、软件源替换和 apt 安装，不会安装 Harness 的 npm 依赖，也不会调用模型 API。

测试会向容器传递 `http_proxy`、`https_proxy`、`no_proxy` 及其大写形式。Linux 上的代理位于宿主机回环地址时，可设置 `ROLLER_DOCKER_TEST_NETWORK=host`。该设置仅影响测试容器的网络，不修改 Docker daemon 配置。

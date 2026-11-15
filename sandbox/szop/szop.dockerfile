# syntax=docker/dockerfile:1
# Szop's layer's overlay (ADR 0076, decision 4): the tools of `pnpm check:*`
# at the versions of docs/development/setup.md, as self-contained releases
# checked against their checksums, as in the base layer.
# shortcut: amd64 only (the owner's machine and CI); add arm64 checksums if a sandbox ever runs on arm64.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS build
ARG TARGETARCH
ARG UV_VERSION=0.13.0
ARG ACTIONLINT_VERSION=1.7.12
ARG TERRAFORM_VERSION=1.16.5
ARG TFLINT_VERSION=0.64.0
ARG TRIVY_VERSION=0.75.0
ARG ZIZMOR_VERSION=1.30.1
ARG GRAPHIFY_VERSION=0.9.97
# The Python the tools run on, as on WSL; uv would otherwise take the newest,
# for which tree-sitter (graphify) has no wheel.
ARG PYTHON_VERSION=3.14.7
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip
WORKDIR /tmp/dl
RUN set -eux; \
    [ "$TARGETARCH" = amd64 ] || { echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1; }; \
    bin=/out/usr/local/bin; mkdir -p "$bin"; \
    get() { curl -fsSL "$1" -o "$2"; echo "$3  $2" | sha256sum -c -; }; \
    get "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" uv.tar.gz \
      1468ebd5a5541121837c5a2817b9972ba6090fa6caa3d142620850a47fb75154; \
    tar -xzf uv.tar.gz --strip-components=1 -C "$bin" uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx; \
    get "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" actionlint.tar.gz \
      8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8; \
    tar -xzf actionlint.tar.gz -C "$bin" actionlint; \
    get "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" terraform.zip \
      2bc2fcfff033265c9e02ca0351f01794eb122f62a9b2a49a3294b9e49eaab5e4; \
    unzip -q -o terraform.zip terraform -d "$bin"; \
    get "https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/tflint_linux_amd64.zip" tflint.zip \
      cca9d13e2e1d7a2c627af60ff899a3c9b74212899416aeb96ec764d2ef954537; \
    unzip -q -o tflint.zip tflint -d "$bin"; \
    get "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" trivy.tar.gz \
      c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f; \
    tar -xzf trivy.tar.gz -C "$bin" trivy; \
    # shortcut: their dependencies resolve at build time, unpinned; add a uv constraints file if a rebuild ever breaks on one.
    # zizmor and graphify are Python tools: uv installs them with their own
    # Python under /opt, at the same paths they keep in the sandbox.
    export UV_TOOL_DIR=/opt/uv-tools UV_TOOL_BIN_DIR="$bin" UV_PYTHON_INSTALL_DIR=/opt/uv-python; \
    "$bin/uv" tool install --python "${PYTHON_VERSION}" "zizmor==${ZIZMOR_VERSION}"; \
    "$bin/uv" tool install --python "${PYTHON_VERSION}" "graphifyy==${GRAPHIFY_VERSION}"; \
    mkdir -p /out/opt; cp -a /opt/uv-tools /opt/uv-python /out/opt/; \
    # pnpm through Corepack, as `corepack enable` links it, from the base layer's Node.
    ln -s ../lib/node_modules/corepack/dist/pnpm.js "$bin/pnpm"; \
    ln -s ../lib/node_modules/corepack/dist/pnpx.js "$bin/pnpx"; \
    ln -s /usr/local/share/claude-szop/check-szop.sh "$bin/check-szop"; \
    chown -R 0:0 /out

FROM scratch
COPY --from=build /out /
COPY files/szop-setup.sh /usr/local/share/claude-setup.d/szop.sh
COPY files/check-szop.sh /usr/local/share/claude-szop/
# Corepack fetches the pnpm of package.json without asking.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

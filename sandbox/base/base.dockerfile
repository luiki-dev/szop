# syntax=docker/dockerfile:1
# The base layer's overlay (ADR 0076, decision 4). A mixin lands on a workload
# it has never seen, so every tool is staged under /out in a build stage and
# copied into scratch. Node, the AWS CLI and jq are self-contained releases,
# so they travel; nothing here is an apt package.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS build
ARG TARGETARCH
ARG NODE_VERSION=24.22.3
ARG AWSCLI_VERSION=2.40.3
ARG JQ_VERSION=1.8.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip xz-utils
WORKDIR /tmp/dl
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) node=x64; aws=x86_64; \
             node_sum=4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb; \
             jq_sum=b1c22172dd303f3be49e935aa56aa48a8b7a46e0bc838b4997d3bb451495870f ;; \
      arm64) node=arm64; aws=aarch64; \
             node_sum=6e51a2ada00f0011cc266f65d98922b403d7ad88f809ca2aa615a5fe1ce6e86c; \
             jq_sum=8b85c817833814ddca00a144c33705546355afccf0cf39b188f3cdb48b852309 ;; \
      *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    mkdir -p /out/usr/local/bin; \
    # Node for the whole system, so every hook finds it however Claude starts.
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node}.tar.xz" -o node.tar.xz; \
    echo "${node_sum}  node.tar.xz" | sha256sum -c -; \
    tar -xJf node.tar.xz -C /out/usr/local --strip-components=1 --no-same-owner \
      "node-v${NODE_VERSION}-linux-${node}/bin" "node-v${NODE_VERSION}-linux-${node}/lib"; \
    # The AWS CLI installs with a bundled Python under /usr/local/aws-cli.
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${aws}-${AWSCLI_VERSION}.zip" -o aws.zip; \
    unzip -q aws.zip; \
    ./aws/install -i /usr/local/aws-cli -b /usr/local/bin; \
    /usr/local/bin/aws --version | grep -q "aws-cli/${AWSCLI_VERSION} "; \
    cp -a /usr/local/aws-cli /out/usr/local/; \
    ln -s "/usr/local/aws-cli/v2/current/bin/aws" /out/usr/local/bin/aws; \
    curl -fsSL "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-${TARGETARCH}" -o jq; \
    echo "${jq_sum}  jq" | sha256sum -c -; \
    install -m 0755 jq /out/usr/local/bin/jq; \
    for s in claude-setup claude-start check-sandbox; do \
      ln -s "/usr/local/share/claude-base/$s.sh" "/out/usr/local/bin/$s"; \
    done; \
    chown -R 0:0 /out

FROM scratch
COPY --from=build /out /
COPY files/claude-backup.sh files/strip-transcripts.py files/claude-setup.sh \
     files/claude-start.sh files/check-sandbox.sh files/settings-fragment.json \
     files/sandbox-notes.md /usr/local/share/claude-base/
# Static env reaches the agent process (a mixin's ENV merges into the image).
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    BRAINSTORM_PORT=61935

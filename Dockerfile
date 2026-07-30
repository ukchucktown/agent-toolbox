# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim

ARG TARGETARCH
ARG AGENT_UID=501
ARG AGENT_GID=501
ARG CODEX_VERSION
ARG CLAUDE_CODE_VERSION
ARG HERDR_VERSION
ARG MOSHI_HOOK_VERSION

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/agent-tools/node_modules/.bin:/usr/local/bin:${PATH}"
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TERM=xterm-256color

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash-completion \
        build-essential \
        ca-certificates \
        curl \
        fd-find \
        git \
        git-lfs \
        gosu \
        iproute2 \
        jq \
        less \
        nano \
        netcat-openbsd \
        openssh-client \
        openssh-server \
        procps \
        ripgrep \
        sudo \
        tini \
        tmux \
        unzip \
        vim-tiny \
        zsh \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid "${AGENT_GID}" agent \
    && useradd --uid "${AGENT_UID}" --gid "${AGENT_GID}" --create-home --shell /bin/bash agent \
    && usermod --password NP agent \
    && printf '%s\n' 'agent ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/agent \
    && chmod 0440 /etc/sudoers.d/agent \
    && install -d -o agent -g agent /opt/agent-tools

USER agent

RUN npm install \
      --prefix /opt/agent-tools \
      --no-audit \
      --no-fund \
      "@openai/codex@${CODEX_VERSION}" \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

USER root

RUN ln -s /opt/agent-tools/node_modules/.bin/codex /usr/local/bin/codex \
    && ln -s /opt/agent-tools/node_modules/.bin/claude /usr/local/bin/claude

RUN case "${TARGETARCH}" in \
      amd64) herdr_arch="x86_64" ;; \
      arm64) herdr_arch="aarch64" ;; \
      *) echo "unsupported Docker architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl --fail --silent --show-error --location \
      "https://github.com/herdrdev/herdr/releases/download/v${HERDR_VERSION}/herdr-linux-${herdr_arch}" \
      --output /usr/local/bin/herdr \
    && chmod 0755 /usr/local/bin/herdr

RUN curl --fail --silent --show-error --location \
      https://getmoshi.app/install.sh \
      --output /tmp/install-moshi-hook.sh \
    && MOSHI_HOOK_VERSION="${MOSHI_HOOK_VERSION}" \
      INSTALL_DIR=/usr/local/bin \
      sh /tmp/install-moshi-hook.sh \
    && rm /tmp/install-moshi-hook.sh

COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/agent-sandbox-entrypoint
COPY scripts/add-authorized-key.cjs /usr/local/bin/add-authorized-key
COPY scripts/profile.sh /etc/profile.d/agent-sandbox.sh

RUN chmod 0755 \
      /usr/local/bin/agent-sandbox-entrypoint \
      /usr/local/bin/add-authorized-key \
      /etc/profile.d/agent-sandbox.sh \
    && install -d -m 0755 /run/sshd /etc/ssh/host_keys

WORKDIR /workspace

EXPOSE 22/tcp

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/agent-sandbox-entrypoint"]

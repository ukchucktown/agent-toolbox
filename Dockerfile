# syntax=docker/dockerfile:1.7

ARG UV_VERSION
ARG JAVA_VERSION
ARG MAVEN_VERSION
ARG TREE_SITTER_CLI_VERSION

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv-toolchain
FROM maven:${MAVEN_VERSION}-eclipse-temurin-${JAVA_VERSION} AS java-toolchain
FROM rust:1.88-bookworm AS tree-sitter-toolchain

ARG TREE_SITTER_CLI_VERSION

RUN cargo install \
      --locked \
      --no-default-features \
      --root /opt/tree-sitter \
      --version "${TREE_SITTER_CLI_VERSION}" \
      tree-sitter-cli

FROM node:22-bookworm-slim

ARG TARGETARCH
ARG AGENT_UID=501
ARG AGENT_GID=501
ARG PYTHON_VERSION
ARG GH_VERSION
ARG NEOVIM_VERSION
ARG NEOVIM_SHA256_AMD64
ARG NEOVIM_SHA256_ARM64
ARG C8CTL_VERSION
ARG OH_MY_ZSH_VERSION
ARG POWERLEVEL10K_VERSION
ARG ZSH_AUTOSUGGESTIONS_VERSION
ARG ZSH_SYNTAX_HIGHLIGHTING_VERSION
ARG FZF_TAB_VERSION
ARG CODEX_VERSION
ARG CLAUDE_CODE_VERSION
ARG HERDR_VERSION
ARG MOSHI_HOOK_VERSION

ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/opt/java/openjdk
ENV MAVEN_HOME=/usr/share/maven
ENV UV_PYTHON_INSTALL_DIR=/opt/python
ENV ZDOTDIR=/etc/agent-shell
ENV PATH="${JAVA_HOME}/bin:${MAVEN_HOME}/bin:/opt/agent-tools/node_modules/.bin:/usr/local/bin:${PATH}"
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TERM=xterm-256color

COPY --from=uv-toolchain /uv /uvx /usr/local/bin/
COPY --from=java-toolchain /opt/java/openjdk /opt/java/openjdk
COPY --from=java-toolchain /usr/share/maven /usr/share/maven
COPY --from=tree-sitter-toolchain /opt/tree-sitter/bin/tree-sitter /usr/local/bin/tree-sitter

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash-completion \
        bat \
        build-essential \
        ca-certificates \
        curl \
        fd-find \
        fzf \
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
        tree \
        unzip \
        vim-tiny \
        zsh \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/batcat /usr/local/bin/bat \
    && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
    && ln -sf "${MAVEN_HOME}/bin/mvn" /usr/local/bin/mvn \
    && corepack enable pnpm

RUN install_component() { \
      destination="$1"; \
      repository="$2"; \
      revision="$3"; \
      git init --quiet "${destination}"; \
      git -C "${destination}" remote add origin "${repository}"; \
      git -C "${destination}" fetch --quiet --depth=1 origin "${revision}"; \
      git -C "${destination}" checkout --quiet --detach FETCH_HEAD; \
      rm -rf "${destination}/.git"; \
    }; \
    install_component \
      /opt/oh-my-zsh \
      https://github.com/ohmyzsh/ohmyzsh.git \
      "${OH_MY_ZSH_VERSION}"; \
    install_component \
      /opt/oh-my-zsh/custom/themes/powerlevel10k \
      https://github.com/romkatv/powerlevel10k.git \
      "${POWERLEVEL10K_VERSION}"; \
    install_component \
      /opt/oh-my-zsh/custom/plugins/zsh-autosuggestions \
      https://github.com/zsh-users/zsh-autosuggestions.git \
      "${ZSH_AUTOSUGGESTIONS_VERSION}"; \
    install_component \
      /opt/oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
      https://github.com/zsh-users/zsh-syntax-highlighting.git \
      "${ZSH_SYNTAX_HIGHLIGHTING_VERSION}"; \
    install_component \
      /opt/oh-my-zsh/custom/plugins/fzf-tab \
      https://github.com/Aloxaf/fzf-tab.git \
      "${FZF_TAB_VERSION}"

RUN UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR}" \
      XDG_BIN_HOME=/usr/local/bin \
      uv python install --default "${PYTHON_VERSION}"

RUN case "${TARGETARCH}" in \
      amd64) gh_arch="amd64" ;; \
      arm64) gh_arch="arm64" ;; \
      *) echo "unsupported Docker architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && gh_archive="gh_${GH_VERSION}_linux_${gh_arch}.tar.gz" \
    && curl --fail --silent --show-error --location \
      "https://github.com/cli/cli/releases/download/v${GH_VERSION}/${gh_archive}" \
      --output "/tmp/${gh_archive}" \
    && curl --fail --silent --show-error --location \
      "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt" \
      --output /tmp/gh-checksums.txt \
    && grep " ${gh_archive}$" /tmp/gh-checksums.txt \
      | (cd /tmp && sha256sum --check --strict -) \
    && tar --extract --gzip \
      --file "/tmp/${gh_archive}" \
      --strip-components 2 \
      --directory /usr/local/bin \
      "gh_${GH_VERSION}_linux_${gh_arch}/bin/gh" \
    && rm "/tmp/${gh_archive}" /tmp/gh-checksums.txt

RUN case "${TARGETARCH}" in \
      amd64) neovim_arch="x86_64"; neovim_sha256="${NEOVIM_SHA256_AMD64}" ;; \
      arm64) neovim_arch="arm64"; neovim_sha256="${NEOVIM_SHA256_ARM64}" ;; \
      *) echo "unsupported Docker architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && neovim_archive="nvim-linux-${neovim_arch}.tar.gz" \
    && curl --fail --silent --show-error --location \
      "https://github.com/neovim/neovim/releases/download/v${NEOVIM_VERSION}/${neovim_archive}" \
      --output "/tmp/${neovim_archive}" \
    && printf '%s  %s\n' "${neovim_sha256}" "/tmp/${neovim_archive}" \
      | sha256sum --check --strict - \
    && tar --extract --gzip \
      --file "/tmp/${neovim_archive}" \
      --directory /opt \
    && mv "/opt/nvim-linux-${neovim_arch}" /opt/nvim \
    && ln -s /opt/nvim/bin/nvim /usr/local/bin/nvim \
    && rm "/tmp/${neovim_archive}"

RUN groupadd --gid "${AGENT_GID}" agent \
    && useradd --uid "${AGENT_UID}" --gid "${AGENT_GID}" --create-home --shell /usr/bin/zsh agent \
    && usermod --password NP agent \
    && printf '%s\n' 'agent ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/agent \
    && chmod 0440 /etc/sudoers.d/agent \
    && install -d -o agent -g agent /opt/agent-tools

USER agent

RUN npm install \
      --prefix /opt/agent-tools \
      --no-audit \
      --no-fund \
      "@camunda8/cli@${C8CTL_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

USER root

RUN ln -s /opt/agent-tools/node_modules/.bin/c8 /usr/local/bin/c8 \
    && ln -s /opt/agent-tools/node_modules/.bin/c8ctl /usr/local/bin/c8ctl \
    && ln -s /opt/agent-tools/node_modules/.bin/codex /usr/local/bin/codex \
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
COPY scripts/camunda-host.cjs /usr/local/bin/camunda-host
COPY scripts/profile.sh /etc/profile.d/agent-sandbox.sh
COPY shell/zshrc /etc/agent-shell/.zshrc
COPY shell/tmux.conf /etc/tmux.conf

RUN chmod 0755 \
      /usr/local/bin/agent-sandbox-entrypoint \
      /usr/local/bin/add-authorized-key \
      /usr/local/bin/camunda-host \
      /etc/profile.d/agent-sandbox.sh \
    && chmod 0644 /etc/agent-shell/.zshrc /etc/tmux.conf \
    && install -d -m 0755 /run/sshd /etc/ssh/host_keys

WORKDIR /workspace

EXPOSE 22/tcp

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/agent-sandbox-entrypoint"]

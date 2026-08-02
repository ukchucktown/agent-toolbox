# Debian fzf integration.
for fzf_file in \
  /usr/share/doc/fzf/examples/key-bindings.zsh \
  /usr/share/doc/fzf/examples/completion.zsh; do
  if [[ -o zle && -r "${fzf_file}" ]]; then
    source "${fzf_file}"
  fi
done
unset fzf_file

if command -v fd >/dev/null 2>&1; then
  export FZF_DEFAULT_COMMAND='fd --type f --hidden --strip-cwd-prefix'
  export FZF_CTRL_T_COMMAND="${FZF_DEFAULT_COMMAND}"
fi

export FZF_DEFAULT_OPTS='
  --height=60%
  --layout=reverse
  --border=rounded
  --prompt="  "
  --pointer="  "
  --preview-window=right:65%:wrap:border-left
'

if command -v bat >/dev/null 2>&1; then
  export _FZF_PREVIEW_CMD='bat --color=always --style=plain,numbers --line-range=:500 {}'
else
  export _FZF_PREVIEW_CMD='sed -n "1,500p" {}'
fi
export FZF_CTRL_T_OPTS="--preview '${_FZF_PREVIEW_CMD}'"

_fzf_file_no_hidden() {
  local cmd result
  cmd="${FZF_DEFAULT_COMMAND/--hidden /}"
  result=$(eval "${cmd:-find . -type f}" | fzf --preview "${_FZF_PREVIEW_CMD}") \
    && LBUFFER+="${result}"
  zle reset-prompt
}
if [[ -o zle ]]; then
  zle -N _fzf_file_no_hidden
fi

#!/bin/bash

# Graft CLI Bash Completion

_graft() {
  local cur prev opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  opts="--help --version --focus --budget --verbose"

  case "${prev}" in
    graft)
      COMPREPLY=( $(compgen -W "serve map stats impact search" -- ${cur}) )
      return 0
      ;;
    map)
      COMPREPLY=$(compgen -W "--focus --budget --verbose" -- ${cur})
      return 0
      ;;
    stats)
      COMPREPLY=()
      return 0
      ;;
    impact)
      _filedir
      return 0
      ;;
    search)
      COMPREPLY=()
      return 0
      ;;
    --focus)
      _filedir
      return 0
      ;;
    --budget)
      COMPREPLY=()
      return 0
      ;;
    *)
      COMPREPLY=$(compgen -W "${opts}" -- ${cur})
      ;;
  esac

  COMPREPLY=( $(compgen -W "${opts} serve map stats impact search" -- ${cur}) )
}

complete -F _graft graft
# Graft CLI Zsh Completion

_graft() {
  local -a commands
  commands=(
    'serve:Index and start MCP server over stdio'
    'map:Output ranked codebase tree to stdout'
    'stats:Display file count, definition count, edge count, and cache age'
    'impact:Show transitively affected files for a given source file'
    'search:Find definitions by name with optional kind filter'
  )

  local -a opts
  opts=(
    '--help[Show help]'
    '--version[Show version]'
    '--focus[File path for personalization]:file:_files'
    '--budget[Token budget for output]:number:'
    '--verbose[Show PageRank scores in output]'
  )

  _describe 'command' commands
  _describe 'option' opts
}

_graft "$@"
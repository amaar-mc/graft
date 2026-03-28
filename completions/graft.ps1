# Graft CLI PowerShell Completion

# To use: 
# 1. Save this file as graft.ps1 in your PowerShell profile directory
# 2. Add to your PowerShell profile: . graft.ps1
# Or copy directly to: ~/Documents/WindowsPowerShell/Modules/graft/graft.ps1

$commands = @{
  'serve' = 'Index and start MCP server over stdio'
  'map' = 'Output ranked codebase tree to stdout'
  'stats' = 'Display file count, definition count, edge count, and cache age'
  'impact' = 'Show transitively affected files for a given source file'
  'search' = 'Find definitions by name with optional kind filter'
}

$options = @{
  '--help' = 'Show help'
  '--version' = 'Show version'
  '--focus' = 'File path for personalization'
  '--budget' = 'Token budget for output (default: 2048)'
  '--verbose' = 'Show PageRank scores in output'
  '--kind' = 'Filter by definition kind (function, class, type, etc.)'
}

function Graft-Completer {
  param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$words
  )

  $current = $words[-1]
  $previous = $words[-2]

  # If we're after a command, show options
  if ($previous -and $commands.ContainsKey($previous)) {
    $completions = $options.Keys | Where-Object { $_ -like "$current*" }
    return $completions
  }

  # Otherwise show commands or options
  if (-not $previous -or $previous -eq 'graft') {
    $completions = $commands.Keys | Where-Object { $_ -like "$current*" }
    return $completions
  }

  # Show all options
  $completions = $options.Keys | Where-Object { $_ -like "$current*" }
  return $completions
}

Register-ArgumentCompleter -CommandName graft -ScriptBlock Graft-Completer
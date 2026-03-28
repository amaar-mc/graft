# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Graft, please report it responsibly.

**Do not open a public issue.** Instead, email: amaardevx@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

I will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

Graft is a local-first tool. Its attack surface includes:

- **MCP server inputs** — tool parameters and resource URIs from MCP clients
- **CLI inputs** — command-line arguments and flags
- **File system access** — file discovery, parsing, and cache read/write
- **Cache files** — `.graft/cache.json` deserialization

## Security Measures

- Path traversal protection on all MCP tool inputs
- Input length limits on all string parameters
- No `eval`, `exec`, or dynamic code execution
- Symbolic links are not followed during file discovery
- All logging goes to stderr (prevents stdout contamination in MCP mode)
- No network requests, no telemetry, no cloud dependencies

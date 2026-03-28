// All output goes to stderr to prevent stdout contamination in MCP server mode
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const prefix = `[graft:${level}] ${message}`;
  const output = meta !== undefined ? `${prefix} ${JSON.stringify(meta)}` : prefix;
  process.stderr.write(`${output}\n`);
}

function debug(message: string, meta?: Record<string, unknown>): void {
  log('debug', message, meta);
}

function info(message: string, meta?: Record<string, unknown>): void {
  log('info', message, meta);
}

function warn(message: string, meta?: Record<string, unknown>): void {
  log('warn', message, meta);
}

function error(message: string, meta?: Record<string, unknown>): void {
  log('error', message, meta);
}

export { log, debug, info, warn, error };
export type { LogLevel };

// Unit tests for warn() and error() functions from src/logger.ts.
// Uses vi.spyOn on process.stderr.write to capture output without actually writing.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { warn, error } from '../src/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('warn()', () => {
  it('writes formatted warn message to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    warn('test msg');
    expect(spy).toHaveBeenCalledWith('[graft:warn] test msg\n');
  });

  it('appends serialized meta to stderr output', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    warn('test msg', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[graft:warn] test msg {"key":"val"}\n');
  });
});

describe('error()', () => {
  it('writes formatted error message to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    error('test msg');
    expect(spy).toHaveBeenCalledWith('[graft:error] test msg\n');
  });

  it('appends serialized meta to stderr output', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    error('test msg', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[graft:error] test msg {"key":"val"}\n');
  });
});

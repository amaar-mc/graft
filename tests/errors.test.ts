// Unit tests for all GraftError subclasses.
// Verifies name, code, hint, message, and prototype chain for each class.

import { describe, it, expect } from 'vitest';
import {
  GraftError,
  ParseError,
  DiscoveryError,
  GrammarLoadError,
  CacheError,
} from '../src/errors';

describe('GraftError', () => {
  it('stores message, hint, and code', () => {
    const err = new GraftError('something failed', 'try again', 'CUSTOM_CODE');
    expect(err.message).toBe('something failed');
    expect(err.hint).toBe('try again');
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.name).toBe('GraftError');
  });

  it('is an instance of Error and GraftError', () => {
    const err = new GraftError('msg', 'hint', 'CODE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GraftError);
  });
});

describe('ParseError', () => {
  it('stores message and hint with correct code and name', () => {
    const err = new ParseError('parse failed', 'check file syntax');
    expect(err.message).toBe('parse failed');
    expect(err.hint).toBe('check file syntax');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.name).toBe('ParseError');
  });

  it('is an instance of Error, GraftError, and ParseError', () => {
    const err = new ParseError('msg', 'hint');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GraftError);
    expect(err).toBeInstanceOf(ParseError);
  });
});

describe('DiscoveryError', () => {
  it('stores message and hint with correct code and name', () => {
    const err = new DiscoveryError('discovery failed', 'check directory');
    expect(err.message).toBe('discovery failed');
    expect(err.hint).toBe('check directory');
    expect(err.code).toBe('DISCOVERY_ERROR');
    expect(err.name).toBe('DiscoveryError');
  });

  it('is an instance of Error, GraftError, and DiscoveryError', () => {
    const err = new DiscoveryError('msg', 'hint');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GraftError);
    expect(err).toBeInstanceOf(DiscoveryError);
  });
});

describe('GrammarLoadError', () => {
  it('stores message and hint with correct code and name', () => {
    const err = new GrammarLoadError('grammar load failed', 'reinstall grammars');
    expect(err.message).toBe('grammar load failed');
    expect(err.hint).toBe('reinstall grammars');
    expect(err.code).toBe('GRAMMAR_LOAD_ERROR');
    expect(err.name).toBe('GrammarLoadError');
  });

  it('is an instance of Error, GraftError, and GrammarLoadError', () => {
    const err = new GrammarLoadError('msg', 'hint');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GraftError);
    expect(err).toBeInstanceOf(GrammarLoadError);
  });
});

describe('CacheError', () => {
  it('stores message and hint with correct code and name', () => {
    const err = new CacheError('cache failed', 'clear cache directory');
    expect(err.message).toBe('cache failed');
    expect(err.hint).toBe('clear cache directory');
    expect(err.code).toBe('CACHE_ERROR');
    expect(err.name).toBe('CacheError');
  });

  it('is an instance of Error, GraftError, and CacheError', () => {
    const err = new CacheError('msg', 'hint');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GraftError);
    expect(err).toBeInstanceOf(CacheError);
  });
});

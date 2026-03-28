// Error hierarchy for Graft — each error includes a hint that tells the user what to do

class GraftError extends Error {
  readonly hint: string;
  readonly code: string;

  constructor(message: string, hint: string, code: string) {
    super(message);
    this.name = 'GraftError';
    this.hint = hint;
    this.code = code;
    // Maintain proper prototype chain in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class ParseError extends GraftError {
  constructor(message: string, hint: string) {
    super(message, hint, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}

class DiscoveryError extends GraftError {
  constructor(message: string, hint: string) {
    super(message, hint, 'DISCOVERY_ERROR');
    this.name = 'DiscoveryError';
  }
}

class GrammarLoadError extends GraftError {
  constructor(message: string, hint: string) {
    super(message, hint, 'GRAMMAR_LOAD_ERROR');
    this.name = 'GrammarLoadError';
  }
}

export { GraftError, ParseError, DiscoveryError, GrammarLoadError };

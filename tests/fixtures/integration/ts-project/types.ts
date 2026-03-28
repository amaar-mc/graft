// Core types for the ts-project fixture — no local imports

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface Config {
  readonly maxUsers: number;
  readonly debug: boolean;
}

export type UserId = string;

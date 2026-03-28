// Utility functions for the ts-project fixture
import type { User, Config, UserId } from './types';

export function createUser(id: UserId, name: string, email: string): User {
  return { id, name, email };
}

export function formatUser(user: User): string {
  return `${user.name} <${user.email}>`;
}

export function applyConfig(users: User[], config: Config): User[] {
  if (users.length > config.maxUsers) {
    return users.slice(0, config.maxUsers);
  }
  return users;
}

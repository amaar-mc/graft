// Entry point for the ts-project fixture
import type { User, Config } from './types';
import { createUser, applyConfig, formatUser } from './utils';

export function buildUserList(config: Config): User[] {
  const users: User[] = [
    createUser('1', 'Alice', 'alice@example.com'),
    createUser('2', 'Bob', 'bob@example.com'),
    createUser('3', 'Carol', 'carol@example.com'),
  ];
  return applyConfig(users, config);
}

export function describeUsers(config: Config): string {
  const users = buildUserList(config);
  return users.map(formatUser).join(', ');
}

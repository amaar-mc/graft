import { UserId } from './other';

export const MAX_USERS = 100;

export type UserId = string;

export enum Role {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

export interface User {
  id: UserId;
  name: string;
  role: Role;
}

export function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

export class UserService {
  private users: User[] = [];

  getUser(id: UserId): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}

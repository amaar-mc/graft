from os import path
import json

MAX_USERS = 100


def greet(name: str) -> str:
    return f"Hello, {name}!"


class UserService:
    def __init__(self) -> None:
        self.users: list[dict] = []

    def get_user(self, user_id: str) -> dict | None:
        for user in self.users:
            if user.get("id") == user_id:
                return user
        return None

    def add_user(self, user: dict) -> None:
        self.users.append(user)

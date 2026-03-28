# Data models for the python-project fixture — no local imports


class User:
    def __init__(self, user_id: str, name: str, email: str) -> None:
        self.user_id = user_id
        self.name = name
        self.email = email

    def format(self) -> str:
        return f"{self.name} <{self.email}>"


class Post:
    def __init__(self, post_id: str, title: str, author: User) -> None:
        self.post_id = post_id
        self.title = title
        self.author = author

    def describe(self) -> str:
        return f"{self.title} by {self.author.name}"

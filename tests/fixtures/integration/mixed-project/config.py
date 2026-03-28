# Config module for the Python cluster in the mixed-project fixture
from .utils import clamp, slugify


class AppConfig:
    def __init__(self, max_items: int, title: str) -> None:
        self.max_items = int(clamp(max_items, 1, 100))
        self.title = slugify(title)

    def describe(self) -> str:
        return f"{self.title} (max {self.max_items})"

from dataclasses import dataclass
from functools import cache


@dataclass
class Config:
    host: str
    port: int
    debug: bool = False

    def connection_string(self) -> str:
        return f"{self.host}:{self.port}"


@cache
def compute(n: int) -> int:
    if n <= 1:
        return n
    return compute(n - 1) + compute(n - 2)


class Repository:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._cache: dict[str, object] = {}

    def get(self, key: str) -> object | None:
        return self._cache.get(key)

    def set(self, key: str, value: object) -> None:
        self._cache[key] = value

    def clear(self) -> None:
        self._cache.clear()

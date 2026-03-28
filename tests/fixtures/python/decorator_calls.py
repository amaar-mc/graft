# Fixture for testing decorator-call patterns (e.g., @dataclass(frozen=True)).
# Covers python.ts line 50: 'call' type decorator where fn is the callable.
from dataclasses import dataclass


@dataclass(frozen=True)
class ImmutablePoint:
    x: float
    y: float


@dataclass(order=True, frozen=False)
class MutablePoint:
    x: float
    y: float

    def distance_from_origin(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

# Utility functions for the Python cluster in the mixed-project fixture — no local imports


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, value))


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-")

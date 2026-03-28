# Tests PARSE-05 relative import handling
from . import utils
from ..core import base
from .models import User


def use_imports() -> None:
    # Reference the imported names to make them visible to the parser
    _ = utils
    _ = base
    _ = User

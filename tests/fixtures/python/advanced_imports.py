# Fixture for testing wildcard and aliased Python import parsing.
# Covers tree-sitter grammar nodes: wildcard_import, aliased_import.
# Also covers: plain import with alias (import X as Y), multiple imports.
from os.path import join, exists
from typing import List, Dict
from collections import OrderedDict as OD
from json import loads as json_loads
from os import *
import os.path as osp
import json as j


def use_all() -> None:
    _ = join
    _ = exists
    _ = OD
    _ = json_loads
    _ = osp
    _ = j

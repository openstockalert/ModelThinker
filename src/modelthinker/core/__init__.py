"""Shared utilities used by every model: metadata dataclass, RNG helper, plotting theme."""

from .base import ModelMeta
from .plotting import PALETTE, apply_theme
from .rng import get_rng

__all__ = ["ModelMeta", "PALETTE", "apply_theme", "get_rng"]

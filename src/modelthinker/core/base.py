"""Metadata dataclass carried by every model."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

REDCAPE = ("Reason", "Explain", "Design", "Communicate", "Act", "Predict", "Explore")


@dataclass(frozen=True)
class ModelMeta:
    """Descriptive metadata for a single model.

    Attributes
    ----------
    chapter:
        Book chapter number (5–28).
    name:
        Human-readable model name.
    slug:
        Filename-safe identifier, used to locate the model doc at
        ``docs/models/ch{chapter:02d}_{slug}.md``.
    part:
        Which part of the book this model lives in (matches the package name:
        ``distributions``, ``functional``, ``networks``, ``dynamics``,
        ``strategy``, ``learning``).
    redcape:
        Subset of :data:`REDCAPE` — which of Page's seven model uses this model
        supports well.
    summary:
        One-sentence description shown on the Home page and page header.
    """

    chapter: int
    name: str
    slug: str
    part: str
    redcape: tuple[str, ...]
    summary: str
    tags: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        bad = [r for r in self.redcape if r not in REDCAPE]
        if bad:
            raise ValueError(f"Unknown REDCAPE entries {bad}; must be a subset of {REDCAPE}.")

    @property
    def doc_filename(self) -> str:
        return f"ch{self.chapter:02d}_{self.slug}.md"

    def doc_path(self, docs_root: Path | str = "docs/models") -> Path:
        return Path(docs_root) / self.doc_filename

    @property
    def guide_anchor(self) -> str:
        """Slug-style anchor into ``docs/model_guide.md`` for this chapter.

        Matches the auto-generated GitHub/Markdown heading anchor: e.g. chapter 5
        (heading "Ch. 5. Normal Distributions: The Bell Curve") -> ``ch-5-normal-distributions-the-bell-curve``.
        We only need the ``ch-N`` prefix reliably; browsers accept partial anchors
        that don't resolve as jumping to the top of the doc, which is fine as a
        graceful fallback.
        """
        return f"ch-{self.chapter}"

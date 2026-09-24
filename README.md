# ModelThinker

Interactive Python implementations of the models catalogued in Scott E. Page's *[The Model Thinker](https://www.basicbooks.com/titles/scott-e-page/the-model-thinker/9780465094639/)* (Basic Books, 2018), organized to mirror the book's chapter structure and exposed through a Streamlit UI so you can experiment with parameters live.

The v1 release ships **5 flagship models** — one from each major book part — plus the skeleton for the remaining chapters. The template is deliberately simple: adding a new model means dropping in a doc, a module, a test, a page, and a notebook.

**Book companion.** For the full picture — including chapters that don't yet have a live model — see [`docs/model_guide.md`](docs/model_guide.md), a chapter-by-chapter reader's guide to all 29 chapters. Each in-app model doc points back to the relevant section.

---

## Quickstart

```bash
# 1. Install (uses uv — https://github.com/astral-sh/uv)
uv sync --extra dev

# 2. Launch the interactive app
uv run streamlit run app/Home.py

# 3. Run the tests
uv run pytest

# 4. Lint
uv run ruff check .

# 5. Open the notebooks
uv run jupyter lab notebooks/
```

If you don't have `uv`, install it with `pip install --user uv`.

---

## Available models (v1)

| Chapter | Model | Package path | Streamlit page | Doc |
|---|---|---|---|---|
| 5  | Normal distributions / CLT     | `modelthinker.distributions.normal`     | `app/pages/05_Normal_Distribution.py`     | [ch05_normal.md](docs/models/ch05_normal.md) |
| 6  | Power laws (Barabási–Albert)   | `modelthinker.distributions.power_law`  | `app/pages/06_Power_Laws.py`              | [ch06_power_law.md](docs/models/ch06_power_law.md) |
| 11 | SIR epidemic (contagion)       | `modelthinker.networks.sir`             | `app/pages/11_SIR_Epidemic.py`            | [ch11_sir.md](docs/models/ch11_sir.md) |
| 15 | Schelling segregation          | `modelthinker.dynamics.schelling`       | `app/pages/15_Schelling_Segregation.py`   | [ch15_schelling.md](docs/models/ch15_schelling.md) |
| 28 | NK rugged landscape            | `modelthinker.learning.nk_landscape`    | `app/pages/28_NK_Landscape.py`            | [ch28_nk_landscape.md](docs/models/ch28_nk_landscape.md) |

The Home page (`app/Home.py`) shows the full book chapter map with `available` / `planned` badges — planned models will populate as more chapters are implemented.

---

## Repository layout

```
ModelThinker/
├── pyproject.toml
├── src/modelthinker/          # pure Python model implementations
│   ├── core/                  # shared: ModelMeta, RNG, Plotly theme
│   ├── distributions/         # Part I: Ch 5–6
│   ├── functional/            # Part II: Ch 7–9   (planned)
│   ├── networks/              # Part III: Ch 10–11
│   ├── dynamics/              # Part IV: Ch 12–19
│   ├── strategy/              # Part V: Ch 20–25  (planned)
│   └── learning/              # Part VI: Ch 26–28
├── app/                       # Streamlit UI
│   ├── Home.py                # landing page + model index
│   ├── pages/                 # one file per model
│   ├── components/layout.py   # shared page anatomy (header, doc link, full doc)
│   └── registry.py            # list of every model + status
├── docs/models/               # long-form Markdown doc per model (with LaTeX)
├── notebooks/                 # one Jupyter notebook per model
└── tests/                     # pytest invariants for every model
```

---

## Design principles

- **Pure model core, thin UI shell.** Every model in `src/modelthinker/` is a plain Python module — no Streamlit imports. This keeps the models testable, importable from notebooks, and reusable in scripts.
- **Deterministic given a seed.** Every stochastic model exposes a `seed` parameter and uses `modelthinker.core.rng.get_rng` — same seed, same output.
- **Book-faithful structure.** Package sub-directories map one-to-one to the book's parts. You can find a chapter's code from the table of contents.
- **Documentation is first-class.** Every model has a canonical Markdown doc (`docs/models/chNN_*.md`) that follows the template in `docs/models/_template.md`. That doc is (a) rendered inline in the Streamlit page and (b) linked at the top of the page.

---

## How to add a new model

For chapter `NN`, model `foo` in part `<part>`:

1. **Doc first.** Copy `docs/models/_template.md` to `docs/models/chNN_foo.md` and fill in all 8 sections. The Parameters table becomes the single source of truth for slider tooltips.
2. **Module.** Create `src/modelthinker/<part>/foo.py` with:
   - A module-level `META = ModelMeta(chapter=NN, name=..., slug="foo", part="<part>", redcape=(...), summary=...)`.
   - A `simulate(*, ..., seed=...)` function (or class) returning a frozen dataclass.
   - Docstrings that quote the doc's *Intuition* section.
3. **Test.** Create `tests/test_foo.py` covering invariants: seed determinism, conservation laws, monotonicity, bounds — not fragile numerical equalities.
4. **Page.** Create `app/pages/NN_Foo.py` following the pattern in the existing pages:
   ```python
   render_header(META)
   render_doc_link(META)
   # sidebar widgets + main plotly chart
   render_full_doc(META)
   ```
5. **Notebook.** Create `notebooks/chNN_foo.ipynb` — narrative walk-through with 2–3 what-ifs.
6. **Registry.** Flip the entry in `app/registry.py` from `status="planned"` to `status="available"` and set `page="NN_Foo"`.

Then run `uv run pytest tests/test_foo.py` and `uv run streamlit run app/Home.py` to verify.

---

## References

- Page, S. E. (2018). *The Model Thinker: What You Need to Know to Make Data Work for You.* Basic Books.
- Coursera: [*Model Thinking*](https://www.coursera.org/learn/model-thinking) — the free companion course.

---

## Licence

MIT.

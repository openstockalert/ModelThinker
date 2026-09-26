# ModelThinker

Playable, scroll-through stories for the models in Scott E. Page's *[The Model Thinker](https://www.basicbooks.com/titles/scott-e-page/the-model-thinker/9780465094639/)* (Basic Books, 2018) — plus a full Python + Streamlit companion for anyone who wants to run the same models with every knob exposed.

## 🎮 Try it live — no install

### **→ [modelthinker.web](https://openstockalert.github.io/ModelThinker/) ←**

Ten chapters as **playable web stories** in the spirit of [Parable of the Polygons](https://ncase.me/polygons/). Scroll, drag, tap. Learn a model in five minutes without opening a stats book.

| Chapter | Story | Live page |
|---|---|---|
| Ch 5  | 🔔 Bell curves emerge from anything — Galton board + CLT | [normal/](https://openstockalert.github.io/ModelThinker/normal/) |
| Ch 6  | 📈 Rich-get-richer, MusicLab, log-log tails | [power-laws/](https://openstockalert.github.io/ModelThinker/power-laws/) |
| Ch 11 | 🦠 SIR epidemic — one number (R₀) decides everything | [sir/](https://openstockalert.github.io/ModelThinker/sir/) |
| Ch 12 | 🎲 Entropy — one number for surprise; four fates for every system | [entropy/](https://openstockalert.github.io/ModelThinker/entropy/) |
| Ch 13 | 🚶 Random walks — the √t rule and the return-time paradox | [random-walk/](https://openstockalert.github.io/ModelThinker/random-walk/) |
| Ch 14 | 🏺 Path dependence — three urns, three worlds | [path-dependence/](https://openstockalert.github.io/ModelThinker/path-dependence/) |
| Ch 15 | 🟦🟧 Schelling segregation — mild bias, dramatic sorting | [schelling/](https://openstockalert.github.io/ModelThinker/schelling/) |
| Ch 15 | 🎮 Conway's Life + Local Majority — emergence vs clustering | [life-and-majority/](https://openstockalert.github.io/ModelThinker/life-and-majority/) |
| Ch 17 | 🌐 Markov chains — the world forgets; only rule changes stick | [markov/](https://openstockalert.github.io/ModelThinker/markov/) |
| Ch 28 | 🏔 NK rugged landscape — climb, get stuck, race the explorers | [nk/](https://openstockalert.github.io/ModelThinker/nk/) |

All pages are vanilla HTML/CSS/JS — no build step, no framework, phone-friendly. See [`web/`](web/) for the source.

---

## 🧠 The full Python + Streamlit companion

For every model above, this repo also ships:

- A **pure Python module** in `src/modelthinker/` — testable, importable, no Streamlit dependency.
- A **Streamlit page** in `app/pages/` — every parameter as a slider, side plots, log-log tails, downloadable simulations. Best on a laptop.
- A **Jupyter notebook** in `notebooks/` — narrative walk-through with what-ifs.
- A **long-form Markdown doc** in `docs/models/` — the canonical write-up, with LaTeX, rendered inline in the Streamlit page.
- **Pytest invariants** in `tests/` — seed determinism, conservation laws, monotonicity.

There's also a chapter-by-chapter **[Book Guide](docs/model_guide.md)** covering all 29 chapters, including the ones without a live model yet.

### Quickstart — Streamlit (Python)

```bash
# Install (uses uv — https://github.com/astral-sh/uv)
uv sync --extra dev

# Launch the interactive app
uv run streamlit run app/Home.py

# Run the tests
uv run pytest

# Open the notebooks
uv run jupyter lab notebooks/
```

If you don't have `uv`, install it with `pip install --user uv`.

### Quickstart — Web stories locally

The deployed site above is the fastest path. To hack on the source locally, serve `web/` with any static file server — the built-in Python one works:

```bash
python -m http.server 8000 --directory web
# Then open http://localhost:8000
```

ES modules mean a `file://` URL won't work — you need any tiny static server (`npx serve web`, `php -S localhost:8000 -t web`, VS Code Live Server, etc.). Deployment: `web/` is fully static, upload as-is to any host.

---

## Models available

| Chapter | Model | Python module | Streamlit page | Web story | Doc |
|---|---|---|---|---|---|
| 5  | Normal / CLT             | `modelthinker.distributions.normal`         | `05_Normal_Distribution`     | [web](web/normal/)          | [doc](docs/models/ch05_normal.md) |
| 6  | Power laws               | `modelthinker.distributions.power_law`      | `06_Power_Laws`              | [web](web/power-laws/)      | [doc](docs/models/ch06_power_law.md) |
| 11 | SIR epidemic             | `modelthinker.networks.sir`                 | `11_SIR_Epidemic`            | [web](web/sir/)             | [doc](docs/models/ch11_sir.md) |
| 12 | Entropy                  | `modelthinker.dynamics.entropy`             | `12_Entropy`                 | [web](web/entropy/)         | [doc](docs/models/ch12_entropy.md) |
| 13 | Random walks             | `modelthinker.dynamics.random_walk`         | `13_Random_Walks`            | [web](web/random-walk/)     | [doc](docs/models/ch13_random_walk.md) |
| 14 | Path dependence          | `modelthinker.dynamics.path_dependence`     | `14_Path_Dependence`         | [web](web/path-dependence/) | [doc](docs/models/ch14_path_dependence.md) |
| 15 | Schelling segregation    | `modelthinker.dynamics.schelling`           | `15_Schelling_Segregation`   | [web](web/schelling/)       | [doc](docs/models/ch15_schelling.md) |
| 15 | Life & Local Majority    | `modelthinker.dynamics.life_and_majority`   | `15_Life_and_Majority`       | [web](web/life-and-majority/) | [doc](docs/models/ch15b_life_and_majority.md) |
| 17 | Markov chains            | `modelthinker.dynamics.markov`              | `17_Markov_Chains`           | [web](web/markov/)          | [doc](docs/models/ch17_markov.md) |
| 28 | NK rugged landscape      | `modelthinker.learning.nk_landscape`        | `28_NK_Landscape`            | [web](web/nk/)              | [doc](docs/models/ch28_nk_landscape.md) |

The remaining chapters (7–10, 16, 18–27, 29) are stubbed out in `app/registry.py` as `planned` — the package structure is ready, just drop in a module + page + doc + notebook.

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
│   ├── components/layout.py   # shared page anatomy
│   └── registry.py            # list of every model + status
├── web/                       # zero-install playable stories
│   ├── index.html             # landing page
│   ├── shared/                # common CSS + tiny canvas / UI helpers
│   └── <chapter>/             # one directory per story: index.html + <name>.js
├── docs/models/               # long-form Markdown doc per model (with LaTeX)
├── notebooks/                 # one Jupyter notebook per model
├── tests/                     # pytest invariants for every model
└── .github/workflows/pages.yml  # auto-deploys web/ to GitHub Pages on push
```

---

## Design principles

- **Web-first for readers, Streamlit-first for tinkerers.** The web stories tell a specific narrative with hand-picked interactions. The Streamlit pages expose *every* parameter and hand you a laboratory. Both share the same Python model core.
- **Pure model core, thin UI shell.** Every model in `src/modelthinker/` is a plain Python module — no Streamlit imports. Testable, importable from notebooks, reusable in scripts.
- **Deterministic given a seed.** Every stochastic model exposes a `seed` parameter and uses `modelthinker.core.rng.get_rng` — same seed, same output.
- **Book-faithful structure.** Package sub-directories map one-to-one to the book's parts. You can find a chapter's code from the table of contents.
- **Documentation is first-class.** Every model has a canonical Markdown doc (`docs/models/chNN_*.md`) that follows the template in `docs/models/_template.md`. That doc is rendered inline in the Streamlit page and linked at the top of the page.

---

## How to add a new model

For chapter `NN`, model `foo` in part `<part>`:

1. **Doc first.** Copy `docs/models/_template.md` to `docs/models/chNN_foo.md` and fill in all 8 sections. The Parameters table becomes the single source of truth for slider tooltips.
2. **Module.** Create `src/modelthinker/<part>/foo.py` with:
   - A module-level `META = ModelMeta(chapter=NN, name=..., slug="foo", part="<part>", redcape=(...), summary=...)`.
   - A `simulate(*, ..., seed=...)` function returning a frozen dataclass.
3. **Test.** Create `tests/test_foo.py` covering invariants: seed determinism, conservation laws, monotonicity, bounds — not fragile numerical equalities.
4. **Streamlit page.** Create `app/pages/NN_Foo.py` following the pattern in existing pages:
   ```python
   render_header(META)
   render_doc_link(META)
   # widgets + main plotly chart
   render_full_doc(META)
   ```
5. **Notebook.** Create `notebooks/chNN_foo.ipynb` — narrative walk-through with 2–3 what-ifs.
6. **Web story** (optional but encouraged). Create `web/<slug>/index.html` + `web/<slug>/<slug>.js`. Follow the pattern in any existing story — vanilla HTML/CSS/JS, no build step, uses `web/shared/canvas.js` + `web/shared/ui.js` helpers.
7. **Registry.** Flip the entry in `app/registry.py` from `status="planned"` to `status="available"` and set `page="NN_Foo"`. Add a card to `web/index.html`.

Then `uv run pytest tests/test_foo.py`, `uv run streamlit run app/Home.py`, and (if you added a web story) `python -m http.server 8000 --directory web` to verify.

---

## References

- Page, S. E. (2018). *The Model Thinker: What You Need to Know to Make Data Work for You.* Basic Books.
- Coursera: [*Model Thinking*](https://www.coursera.org/learn/model-thinking) — the free companion course.
- Inspiration for the web stories: [Parable of the Polygons](https://ncase.me/polygons/) (Vi Hart & Nicky Case, 2014); Bret Victor's *Explorable Explanations*.

---

## Licence

MIT.

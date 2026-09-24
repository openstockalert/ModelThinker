<!--
Canonical documentation template for every ModelThinker model.
Copy this file to `docs/models/chNN_<slug>.md` and fill in each section.
Sections and their order are load-bearing: `render_full_doc()` and the
notebook narrative both assume this structure.
-->

# Ch NN — Model Name

**Tagline:** _One sentence: what this model is about._

**REDCAPE:** Explain · Predict _(subset of the seven uses this model supports well)_

---

## 1. Intuition

Plain-language explanation (~150–250 words). No math. What phenomenon does the model capture? Why is it useful? What's the "aha" a first-time reader should leave with?

## 2. The model

The formal setup: state variables, assumptions, and the update rule or objective.

$$
\text{main equation goes here}
$$

Where:
- $x$ — description
- $y$ — description

## 3. Parameters

| Name | Symbol | Meaning | Range | Default | Effect of increasing |
|------|--------|---------|-------|---------|----------------------|
| `param_a` | $a$ | ... | $[0, 1]$ | `0.5` | Increases X, decreases Y |
| `param_b` | $b$ | ... | $\mathbb{N}^+$ | `100` | ... |
| `seed`    | —   | RNG seed for reproducibility | any int | `42` | — |

## 4. Key results

1. **Result 1** — one line stating a famous property this model demonstrates.
2. **Result 2** — ...
3. **Result 3** — ...

## 5. What to try

Concrete parameter recipes with the expected outcome (the "aha" experiments).

- **Recipe A — _short name_.** Set `param_a = X`, `param_b = Y`. _Expected: ..._
- **Recipe B — _short name_.** Set `param_a = X`, `param_b = Y`. _Expected: ..._
- **Recipe C — _short name_.** Set `param_a = X`, `param_b = Y`. _Expected: ..._

## 6. Limits and pitfalls

- What the model does **not** capture.
- Common misinterpretations.
- Assumptions that break in the real world.

## 7. Connections

Other chapters/models that combine with this one — the many-model-thinking payoff.

- **Ch X — Other Model** — how it complements this one.
- **Ch Y — Other Model** — ...

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. NN.
- Original paper #1 — Author, Year, Title.
- Original paper #2 — Author, Year, Title.

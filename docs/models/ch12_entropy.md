# Ch 12 — Entropy

**Tagline:** _One number scores uncertainty in a distribution — and the same one number sorts the whole world into four classes: equilibrium, periodic, random, complex._

**REDCAPE:** Reason · Explain · Communicate · Explore

---

## 1. Intuition

Entropy started as a physics word about heat and disorder. Claude Shannon (1948) borrowed the term for something else: **how surprised are you, on average, by an outcome?** A weighted die with a heavy 6 is almost predictable — low entropy. A fair die is maximally unpredictable — high entropy. Whichever distribution you're staring at, one number tells you where between "certain" and "wide open" it sits.

That single-number trick shows up in three different jobs across Page's Chapter 12. **First**, as a measure of diversity: entropy scores how many kinds of things a market carries, how many species a rainforest holds, how varied a portfolio is. **Second**, as a rule for honest guessing: if you know a range but nothing else, spread your belief uniformly — that's the *maximum-entropy* distribution given the constraint, and it's the least presumptuous answer. Any peakier distribution has less entropy and smuggles in unspoken structure. **Third**, and most striking, as a system-behaviour classifier. Wolfram noticed that dynamical systems — cellular automata, ecosystems, markets — produce exactly four kinds of long-run output: they equilibrate, cycle, produce randomness, or produce structured-but-non-periodic complexity. Entropy tells them apart.

The "aha" for a first-time reader: uncertainty, diversity, and complexity are the *same* number wearing different hats.

## 2. The model

**Shannon entropy** of a distribution $p = (p_1, \ldots, p_K)$ is

$$
H(p) = -\sum_{i=1}^K p_i \log_2 p_i \quad \text{(bits)}
$$

with the convention $0 \log 0 = 0$. It has three defining properties:
- $H(p) \ge 0$, with $H = 0$ iff exactly one $p_i = 1$.
- $H(p) \le \log_2 K$, with equality iff $p$ is uniform.
- $H$ is *additive* over independent components: $H(X, Y) = H(X) + H(Y)$ when $X \perp Y$.

**Maximum-entropy distributions** are the answer to: "given a constraint, which distribution maximises $H$?" Three canonical cases:

| Constraint | Max-entropy answer | Entropy (nats) |
|------------|--------------------|----------------|
| Known range $[a, b]$ | **Uniform** on $[a, b]$ | $\ln(b - a)$ |
| Known mean $\mu > 0$, support $[0, \infty)$ | **Exponential**($\mu$) | $1 + \ln \mu$ |
| Known mean & variance $\sigma^2$ | **Normal**($\mu, \sigma^2$) | $\tfrac{1}{2} \ln(2 \pi e \sigma^2)$ |

**Wolfram's four classes**, illustrated on the 256 elementary 1-D cellular automata. A rule maps a length-3 binary neighbourhood $(l, c, r)$ to a new value for the centre cell. Bit $b$ of the 8-bit rule number gives the output for the pattern with binary value $b$. Iterated on a row of cells, the space-time diagram falls into one of:

1. **Class 1 · equilibrium** — the row collapses to a monochrome fixed point.
2. **Class 2 · periodic** — the row locks into a repeating cycle.
3. **Class 3 · random** — the row is statistically indistinguishable from a good PRNG.
4. **Class 4 · complex** — structured "particles" (gliders) traverse a fixed background; never repeats, but not random either.

## 3. Parameters

### Shannon primitives

| Name | Symbol | Meaning | Range | Default | Effect of increasing |
|------|--------|---------|-------|---------|----------------------|
| `p` | $p$ | Probability vector | $\sum p_i = 1$, $p_i \ge 0$ | — | Peakier `p` → lower `H` |
| `base` | — | Log base | $> 1$ | `2` (bits) | Just rescales the answer |

### Cellular automata

| Name | Symbol | Meaning | Range | Default | Effect of increasing |
|------|--------|---------|-------|---------|----------------------|
| `rule` | — | Wolfram rule number | $[0, 255]$ | `30` | No monotone effect — each rule is qualitatively different |
| `width` | $W$ | Cells per row | $\mathbb{N}^+$ | `121` | Sharper statistics, longer transients |
| `steps` | $T$ | Time steps to simulate | $\mathbb{N}^+$ | `200` | Reveals more of the long-run behaviour |
| `initial_kind` | — | Starting row: `"single"` or `"random"` | — | `"single"` | Single seed reveals a rule's *signature* |
| `initial_density` | — | For random start, fraction of 1s | $[0, 1]$ | `0.5` | Higher density → more collisions early on |
| `wrap` | — | Toroidal edges | bool | `True` | Off → boundary artefacts |
| `seed` | — | RNG seed | any int | `42` | Reproducibility |
| `block_k` | $k$ | Window length for block entropy | $\mathbb{N}^+$ | `4` | Bigger $k$ → higher max, more sensitivity |

## 4. Key results

1. **$H = 0$ ↔ certainty; $H = \log_2 K$ ↔ maximum uncertainty.** Any distribution on $K$ outcomes falls in the range $[0, \log_2 K]$ bits. That range is the whole "how surprising" axis.
2. **The max-entropy principle.** Under any constraint, the distribution with maximum entropy is the *least-presumptuous* choice. It's the honest default in Bayesian analysis, statistical mechanics (Jaynes 1957), and machine learning.
3. **Four-class dichotomy.** Every deterministic dynamical system on a finite substrate falls into one of four classes; the boundaries between them are where interesting behaviour lives. Class 4 (complex) is where computation — and, Page argues, cities, markets, and ecosystems — actually happen.
4. **Entropy scores diversity.** In ecology it's called the **Shannon–Wiener index**; in economics **1 / effective number of brands** ($e^H$). Same math, different name each time.

## 5. What to try

Concrete parameter recipes to build intuition:

- **Recipe A — the entropy dial.** In the Shannon tab, start with a uniform 4-outcome distribution ($H = 2$ bits). Now slowly push one outcome's weight toward 1 while pulling the others toward 0. Watch $H$ collapse. Any distribution's entropy is a linear-in-log-space blend of these two extremes.
- **Recipe B — max-ent = laziest guess.** In the max-entropy tab, pick the "mean μ" constraint with $\mu = 1$. The exponential's entropy is $1 + \ln 1 = 1$ nat. Now cook up any *other* non-negative distribution with mean 1 (a mixture, a shifted delta) — every honest attempt has $H < 1$ nat. That's the max-ent principle in action.
- **Recipe C — meet the four classes.** In the CA tab, click through Rule 0 → Rule 184 → Rule 30 → Rule 110. Watch the space-time diagram *and* the row-entropy plot. Class 1 dies at $H = 0$; Class 2 oscillates in a narrow band; Class 3 hugs the $H = 1$ ceiling; Class 4 fluctuates in a middle band.
- **Recipe D — the classifier is fallible.** With rule 110 and a *random* starting row, the block-entropy heuristic misclassifies it as class 3 (random) even though everyone agrees it's class 4. That statistical ambiguity is why Wolfram spent years hand-classifying rules — and it's the reason Page uses class 4 to argue that complexity resists reduction to summary statistics.
- **Recipe E — the diversity index.** Feed a market-share vector (e.g. `[0.4, 0.3, 0.2, 0.1]`) into `shannon_entropy` and compare against `log2(4)`. Their ratio is the market's *evenness*.

## 6. Limits and pitfalls

- **The classifier is a heuristic.** Distinguishing "random" (class 3) from "complex" (class 4) via a single block-entropy statistic is genuinely hard; rule 30 (Wolfram's PRNG) and rule 110 (Turing complete) both produce high-entropy tails. The `WOLFRAM_CLASSES` dict is a curated reference; the on-the-fly `classify_ca` function is a rough spot check.
- **Differential entropy is not the same as Shannon entropy.** The max-entropy formulas above measure *differential* entropy on continuous supports; they can be negative and change under a change of variables. Bits are meaningful for discrete distributions, weird for continuous ones (interpret them as relative to the reference measure).
- **Entropy ignores value.** A market whose four brands are Toyota, Ford, Honda, and Chevy has the same entropy as one whose four brands are four kinds of vinegar. Entropy scores *evenness of shares*, not the meaning of the outcomes.
- **Independent-outcome assumption.** Shannon entropy over marginals ignores dependence. The joint entropy $H(X, Y)$ ≤ $H(X) + H(Y)$; the gap ($=$ *mutual information*) is where the structure lives.
- **Real dynamical systems rarely stay in one class.** A market can look periodic for years, then spike into class-3 chaos. Class 4 systems can lock into class 2 patches. Page's four-class scheme is a lens, not a partition.

## 7. Connections

- **Ch 5 — Normal distributions.** Normal = max-entropy given mean & variance; the CLT plus max-ent is why so many empirical distributions look Gaussian.
- **Ch 6 — Power laws.** Power laws are *not* max-entropy under the standard constraints. Their emergence signals a mechanism (preferential attachment, sandpile) other than pure ignorance.
- **Ch 14 — Path dependence.** Page measures the difference between path-dependent and tipping-point processes using *changes in entropy* over time — the entropy is high while history is still open, low once an outcome is locked in.
- **Ch 15 — Local interactions.** Conway's Game of Life is a 2-D Class 4 system; the Local Majority model freezes into Class 1. Same-family cellular-automata dynamics, different classes.
- **Ch 28 — Rugged landscapes.** Landscape ruggedness is a spatial cousin of temporal complexity: rugged landscapes have many local maxima the way class-4 systems have many recurring "particles". Entropy of the fitness distribution is one way to score ruggedness.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 12.
- Shannon, C. E. (1948). *A Mathematical Theory of Communication*. Bell System Technical Journal 27, 379–423.
- Jaynes, E. T. (1957). *Information Theory and Statistical Mechanics*. Physical Review 106, 620–630. — the max-entropy principle.
- Wolfram, S. (1984). *Universality and complexity in cellular automata*. Physica D 10, 1–35.
- Wolfram, S. (2002). *A New Kind of Science*. — the four-class taxonomy and hand-classifications used by `WOLFRAM_CLASSES`.
- Cook, M. (2004). *Universality in Elementary Cellular Automata*. Complex Systems 15. — proof that rule 110 is Turing complete.

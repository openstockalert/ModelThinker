# Ch 13 — Random walks

**Tagline:** _A directionless process produces long streaks, apparent trends, and returns-to-zero that are guaranteed to happen but take forever on average. Almost every "hot hand" you'll ever see is one of these._

**REDCAPE:** Explain · Explore · Predict · Communicate

---

## 1. Intuition

Stand on a number line at 0. Flip a coin: heads → step right, tails → step left. Repeat forever. That's a **simple random walk** — the humblest stochastic process there is. Almost every big lesson about randomness lives inside it.

Two headline results, which point in opposite directions:

1. **A 1-D walk returns to zero — with probability 1.** No matter how far you drift, you're guaranteed to come back. And back again. And back infinitely many times.
2. **The average time to return is infinite.** Half of all walks return in the very first two steps. Yet the mean waiting time is $\infty$. "Certain to happen" and "expected to happen soon" are unrelated properties.

The reason is a slow-decaying tail: the probability you haven't returned by time $t$ falls off as $1/\sqrt{t}$ — so slowly that the rare marathon excursions dominate the average even though quick returns are common. The **median** return is 2 steps; the mean is undefined.

Beyond the paradox lie three deep facts:

- **The √t rule.** After $t$ steps, a 1-D walk is typically $\sqrt{t}$ away from home. Distance grows as the *square root* of time. This is why "trend" and "noise" can look identical.
- **Pólya's theorem.** In 1-D and 2-D a walk returns to its start with probability 1. In 3-D and above it doesn't — the probability of ever returning is about 0.34 in 3-D, 0.19 in 4-D. Kakutani's summary: *"A drunk man will find his way home; a drunk bird may get lost forever."*
- **The arcsine law.** In a fair contest between two walkers, the most likely fraction of time one side leads is not 50 % — it's *close to 0 or close to 1*. In a truly balanced game, one side tends to dominate the visible clock. So "one team is clearly better" is what fair games *look like*, not evidence they aren't fair.

These three combine to explain why financial markets, sports streaks, business "momentum," and firm lifetimes look far more patterned than they actually are.

## 2. The model

### 2.1 Simple (Bernoulli) 1-D random walk

Let $X_1, X_2, \ldots$ be i.i.d. with $\Pr(X_i = +1) = \Pr(X_i = -1) = \tfrac{1}{2}$. The position after $t$ steps is

$$
S_t \;=\; \sum_{i=1}^{t} X_i .
$$

Then $\mathbb{E}[S_t] = 0$ and $\mathrm{Var}(S_t) = t$, so the typical displacement is $\sqrt{t}$. By the CLT (see Ch 5), for large $t$, $S_t / \sqrt{t} \approx \mathcal{N}(0, 1)$.

### 2.2 Normal (Brownian) walk

Replace $X_i$ with $X_i \sim \mathcal{N}(\mu, \sigma^2)$. When $\mu = 0$ the walk still has zero drift, and $S_t \sim \mathcal{N}(0, t\sigma^2)$ exactly (no CLT approximation needed). This is the discrete-time analogue of Brownian motion, and the process Samuelson's efficient-market model applies to log prices.

Adding a small drift $\mu > 0$ changes everything: the walk becomes **transient** in *any* dimension (it drifts off to $+\infty$), and expected return times become infinite in a different way.

### 2.3 Return-time distribution (1-D, driftless)

For a driftless 1-D walk starting at 0, the probability of first returning at exactly step $2k$ (returns can only happen at even times) is

$$
\Pr(T = 2k) \;=\; \frac{1}{2k - 1}\binom{2k}{k}\!\bigl(\tfrac{1}{2}\bigr)^{2k}
$$

whose tail satisfies $\Pr(T > t) \sim \sqrt{2 / (\pi t)}$ — a **power-law decay with exponent $\tfrac{1}{2}$**. Hence:

- Return is certain: $\sum_k \Pr(T = 2k) = 1$.
- Mean return time diverges: $\mathbb{E}[T] = \sum_k 2k \Pr(T = 2k) = \infty$.

### 2.4 Pólya's theorem — recurrence by dimension

For a walk on $\mathbb{Z}^d$ (each step: pick an axis at random, move $\pm 1$):

| Dimension $d$ | Recurrent? | Approx. return probability | Intuition |
|---|---|---|---|
| 1 | **Yes** | 1.000 | fast returns, fat tail |
| 2 | Yes (barely) | 1.000 (very slowly) | log-scale return time |
| 3 | **No** | 0.3405 | 66 % drift off forever |
| 4 | No | 0.193 | more room, more escape |
| $d \ge 3$ | No | decreasing in $d$ | too much space |

### 2.5 Arcsine law

For a driftless 1-D walk of length $2n$, the fraction of time $S_t \ge 0$ has distribution

$$
\Pr\!\left(\tfrac{\#\{t \le 2n : S_t \ge 0\}}{2n} \le x\right) \;=\; \tfrac{2}{\pi}\arcsin\!\sqrt{x} .
$$

This distribution is **U-shaped**: the density explodes at 0 and 1 and is minimal at ½. In plain terms: one side leads *almost all the time* or *almost none of the time* — leading exactly half the time is the *rarest* outcome, not the most common.

## 3. Parameters

| Name | Symbol | Meaning | Range | Default | Effect of increasing |
|------|--------|---------|-------|---------|----------------------|
| `steps` | $t$ | Length of each walk | $[10, 100{,}000]$ | `1000` | More displacement (as √t), longer runs |
| `n_walks` | $N$ | Number of independent walks | $[1, 20{,}000]$ | `500` | Smoother statistics, slower sim |
| `step_type` | — | `"bernoulli"` (±1) or `"normal"` (Gaussian) | choice | `"bernoulli"` | Normal is continuous; means and variances match up to scale |
| `drift` | $\mu$ | Mean of each step | $[-0.1, 0.1]$ | `0.0` | Non-zero drift makes the walk **transient** in every dimension |
| `dim` | $d$ | Lattice dimension for Pólya experiments | $\{1, 2, 3, 4\}$ | `2` | Higher $d$ = lower return rate |
| `seed` | — | RNG seed | any int | `42` | — |

## 4. Key results

1. **√t scaling.** RMS displacement grows as $\sqrt{t}$. Doubling time only multiplies typical distance by $\sqrt{2}$.
2. **Certain return with infinite expected time (1-D).** Median return: 2 steps. Mean: $\infty$. This is *the* prototype of a distribution where quoting the mean is a category error.
3. **Return-time distribution is a power law** ($\Pr(T > t) \sim t^{-1/2}$) — the same shape that appears in firm lifetimes and species durations (bridge back to Ch 6).
4. **Pólya's theorem.** Recurrent in 1-D and 2-D; transient in 3-D+. Space matters.
5. **Arcsine law.** Fair walks look unfair. The *most likely* time-in-the-lead split is highly one-sided.
6. **Efficient market hypothesis.** If prices reflect all information, price changes have zero autocorrelation → price paths are random walks → hot streaks are what randomness *produces*, not evidence of skill (Samuelson 1965; Fama 1970).

## 5. What to try

- **Recipe A — The √t rule live.** Open **Many walks**. Set `n_walks=500`, `steps=2000`. _Expected: the swarm's spread grows as a √t envelope. Double `steps` — the envelope only widens by √2._
- **Recipe B — The return-time paradox.** Open **Return times**. Simulate 5,000 walks. _Expected: median ≈ 2 steps, 99th percentile in the thousands, mean shown as "∞ (undefined)". The log-log tail is a straight line with slope ≈ −½ — a power law._
- **Recipe C — Pólya's theorem.** Open **Dimensions**. Compare 1-D, 2-D, 3-D, 4-D at `steps=10000`. _Expected: 1-D returns ≈ 99 %, 2-D ~75 % (climbing slowly), 3-D ≈ 34 %, 4-D ≈ 19 %._
- **Recipe D — Arcsine surprise.** Open **Arcsine law**. Simulate 5,000 pairs of walks. _Expected: histogram of "fraction of time A leads" is U-shaped, not bell-shaped. Leading exactly half the time is the rarest outcome. This is why a truly even matchup usually *looks* like one team is dominant._
- **Recipe E — Add a tiny drift.** In **Watch a walk**, set `drift = 0.01` (about 1 %). _Expected: the walk still looks noisy, but over 10,000 steps it drifts to ≈ +100 — indistinguishable from a "trend" if you didn't know. This is the whole problem with reading intentions out of noisy time series._
- **Recipe F — Efficient market thought experiment.** Toggle `step_type = "normal"`, `steps = 252` (one trading year). Simulate 500 walks. _Expected: several will look like "spectacular manager years" purely by chance. This is why 5-year track records don't identify skill._

## 6. Real-world examples

### 6.1 Stock prices and mutual-fund performance

Samuelson (1965) formalised the efficient-market intuition: if prices reflect all public information, then price changes must be unpredictable — i.e., log-prices follow a random walk. The empirical consequences are stark:

- **The "hot hand" of mutual funds vanishes with time.** Fama & French (2010) show most top-quartile funds don't remain top-quartile — the persistence is roughly what a random-walk null model predicts. The SPIVA report has documented for two decades that over 15-year horizons, ~85–90 % of active US large-cap funds underperform the S&P 500. Random walks + fees ≈ observed performance.
- **"Momentum" strategies work, but modestly and with drawdowns** — a real anomaly, but small enough that it fits inside a mostly random-walk world.

### 6.2 Sports streaks and the "hot hand"

Gilovich, Vallone & Tversky (1985) analysed NBA shooting sequences and found that streaks of made shots were roughly what independent Bernoulli trials predict. Recent work (Miller & Sanjurjo 2018) reintroduces a small hot-hand effect, but the *headline* stays: **most win-streaks and hitting-streaks match a random-walk model.** DiMaggio's 56-game hitting streak is remarkable — but so is *some* record that far into the tail of a fair process.

The arcsine law explains why fair contests *look* dominated: leading almost the whole time is the modal outcome, not the exception.

### 6.3 Firm and species lifetimes

Model a firm's size as a random walk absorbed at 0 (bankruptcy). The distribution of first-passage times to 0 is a power law with exponent $\tfrac{3}{2}$. Empirically:

- **Firm lifetimes** follow power laws (Amaral et al. 1998; Cabral & Mata 2003) — small firms die quickly, but the tail of very-long-lived firms is heavy.
- **Species durations** in the fossil record follow the same distribution (Van Valen 1973; Newman & Sibani 1999).
- **Individual careers** in many domains (musicians' chart tenure, actors' active years) show the same shape.

This is the bridge from Ch 13 back to Ch 6: random walks are one of the natural *generators* of power-law distributions.

### 6.4 Diffusion in chemistry and biology

Pólya's theorem has a wet-lab consequence. A protein diffusing freely in 3-D solution rarely returns to any specific spot — 3-D is transient. Confine it to a **2-D membrane** and the walk becomes recurrent: it sweeps its neighbourhood thoroughly. This is why many cellular processes reduce dimensionality (proteins attach to membranes, transcription factors slide along DNA one dimension at a time) — it dramatically increases the probability of finding the target.

### 6.5 Gambler's ruin

A gambler with finite wealth $w$ playing a fair game against an infinitely-rich casino goes broke with probability 1. The "certain return to zero" result gets you back to break-even, but between now and then you're guaranteed to visit $-w$ (and lose everything) at some point. This is why sound money management matters more than being right on average.

## 7. Limits and pitfalls

- **Correlated steps aren't random walks.** Real markets, cascading failures, and epidemics violate the independence assumption. The √t rule can under- or over-estimate risk badly when steps cluster.
- **Fat-tailed steps aren't random walks either.** If step sizes have infinite variance (Lévy flights, Cauchy noise), scaling is not √t but $t^{1/\alpha}$ for stability index $\alpha \in (0, 2]$. Extreme events dominate.
- **Any drift breaks the recurrence result.** The classic 1-D "certain return" needs *exactly* zero drift. A drift of even 0.1 % per step makes the walk transient.
- **Finite horizons matter.** "Certain return" is a statement about eternity. In any finite experiment 20 % of your walks may not have returned yet — that's not a bug, that's the tail.

## 8. Connections

- **Ch 5 — Normal distributions.** A random walk's position after $t$ steps is (by CLT) approximately $\mathcal{N}(0, t\sigma^2)$. Normal walks make this exact.
- **Ch 6 — Power laws.** Return times to zero follow a power law with exponent ½; first-passage times to distance $D$ scale like $D^2$. Random walks are one of the fundamental generators of long-tail distributions.
- **Ch 14 — Path dependence.** Random walks don't have path dependence *in equilibrium* (they wander forever), but at finite horizons past history strongly conditions where they'll be next.
- **Ch 17 — Markov models.** A random walk is a Markov chain on $\mathbb{Z}^d$. The chain is recurrent iff Pólya's condition holds.
- **Ch 21 — Games / Ch 27 — Bandits.** Any decision rule tested against noisy performance data faces the random-walk problem: how much of "manager A beat manager B for 5 years" is skill, and how much is a Brownian excursion?

## 9. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 13.
- Pólya, G. (1921). "Über eine Aufgabe der Wahrscheinlichkeitsrechnung betreffend die Irrfahrt im Straßennetz." *Mathematische Annalen*, 84.
- Feller, W. (1968). *An Introduction to Probability Theory and Its Applications*, Vol. I. Wiley. — the classic reference for the arcsine law and first-passage results.
- Samuelson, P. A. (1965). "Proof that properly anticipated prices fluctuate randomly." *Industrial Management Review*, 6.
- Fama, E. F. (1970). "Efficient capital markets: a review of theory and empirical work." *Journal of Finance*, 25(2).
- Gilovich, T., Vallone, R. & Tversky, A. (1985). "The hot hand in basketball." *Cognitive Psychology*, 17(3).
- Amaral, L. A. N. et al. (1998). "Power law scaling for a system of interacting units with complex internal structure." *PRL*, 80.
- Van Valen, L. (1973). "A new evolutionary law." *Evolutionary Theory*, 1.
- Kakutani, S. — apocryphal but widely quoted: *"A drunk man will find his way home, but a drunk bird may get lost forever."*

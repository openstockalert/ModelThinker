# Ch 5 — Normal distributions

**Tagline:** _Sums and averages of many small independent effects pile up into the bell curve — the workhorse of statistics, quality control, and prediction._

**REDCAPE:** Explain · Predict · Communicate

---

## 1. Intuition

Take *any* well-behaved random source — the toss of a coin, the length of a phone call, the return of a stock on a random day. On its own each draw can look strange, skewed, or discrete. But start averaging many draws together, and the histogram of those averages settles into the same bell-shaped curve no matter what the source looked like. That's the **Central Limit Theorem (CLT)**, and it's the reason the normal distribution shows up everywhere: heights, measurement errors, test scores, manufacturing tolerances, portfolio returns.

Two practical consequences that Page emphasises:

1. **The √n rule.** Averaging *n* independent draws shrinks the standard deviation of the average by a factor of √n. Doubling sample size does *not* halve error — you need four times as many samples to halve it.
2. **Six-sigma.** In the normal, ≈ 99.7% of mass lies within three standard deviations of the mean; ≈ 99.9999998% within six. Manufacturing tolerances built on this promise a defect rate of ~3.4 per million — provided the process really is normal.

The simulator lets you pick any starting distribution — even a wild one like Bernoulli(0.02) or Exponential(1) — and watch the average of *n* draws converge to a bell curve as *n* grows.

## 2. The model

Let $X_1, X_2, \ldots, X_n$ be i.i.d. draws from **any** distribution with finite mean $\mu$ and finite variance $\sigma^2$. Define the sample mean

$$
\bar{X}_n \;=\; \frac{1}{n} \sum_{i=1}^{n} X_i .
$$

The Central Limit Theorem says the standardised sample mean converges in distribution to a standard normal:

$$
\sqrt{n} \, \frac{\bar{X}_n - \mu}{\sigma} \;\xrightarrow{d}\; \mathcal{N}(0, 1) \quad \text{as } n \to \infty.
$$

Equivalently, for large $n$, $\bar{X}_n \approx \mathcal{N}\!\left(\mu, \sigma^2/n\right)$.

## 3. Parameters

| Name          | Symbol | Meaning                                                                         | Range           | Default    | Effect of increasing                    |
|---------------|--------|---------------------------------------------------------------------------------|-----------------|------------|-----------------------------------------|
| `source`      | —      | Underlying distribution the samples are drawn from (uniform, exponential, bernoulli, chi²) | choice | `uniform`  | Changes convergence *speed*, not the limit |
| `n`           | $n$    | Number of draws averaged into each sample mean                                  | $[1, 5{,}000]$  | `30`       | Sample-mean distribution gets tighter and more Gaussian |
| `num_samples` | $N$    | How many sample means to draw for the histogram                                 | $[100, 100{,}000]$ | `10{,}000` | Histogram gets smoother                 |
| `seed`        | —      | RNG seed for reproducibility                                                    | any int         | `42`       | —                                       |

## 4. Key results

1. **CLT.** Sample-mean distributions converge to a normal, regardless of the underlying distribution (given finite variance).
2. **√n scaling.** Standard error of the mean equals $\sigma / \sqrt{n}$ — to halve it, quadruple the sample size.
3. **Skewness dies slowly.** For very skewed sources (e.g. Exponential(1)) the sample mean is *close to* normal for $n = 30$ but visibly right-skewed until $n \approx 100+$.
4. **Six-sigma promise.** Under a true normal, $\Pr(|X - \mu| > 6\sigma) \approx 2 \times 10^{-9}$ — the basis for "3.4 defects per million" quality targets.

## 5. What to try

- **Recipe A — CLT from a fair coin.** `source = bernoulli(0.5)`, `n = 30`, `num_samples = 10000`. _Expected: a beautifully symmetric bell despite the underlying distribution having exactly two outcomes._
- **Recipe B — Slow convergence from skew.** `source = exponential(1)`, `n = 5`, then `n = 30`, then `n = 200`. _Expected: the histogram is visibly right-skewed at n=5, near-normal at n=30, indistinguishable from normal at n=200._
- **Recipe C — The √n rule in action.** Fix `source = uniform(0, 1)` and toggle `n` between 25, 100, and 400. _Expected: the sample-mean standard deviation halves each step (from ≈ 0.058 to 0.029 to 0.014)._
- **Recipe D — Rare-event stress test.** `source = bernoulli(0.02)`, `n = 30`. _Expected: heavy right skew — the CLT approximation is poor. Normal-based confidence intervals here would be badly wrong. This is exactly the pitfall six-sigma methods hit when the underlying process isn't normal._
- **Recipe E — Lognormal is stubborn.** `source = lognormal`, `n = 30` then `n = 200` then `n = 1000`. _Expected: the sample-mean histogram is still visibly right-skewed at n = 30, and only cleanly Gaussian at n ≈ 1000. Multiplicative processes need much larger samples than additive ones for the CLT to kick in — this is why raw incomes look lognormal even though log-incomes look normal (see §7)._

### Application vignette — the small-schools puzzle (Page, Ch 5)

Because the standard error of a mean is $\sigma / \sqrt{n}$, **small samples have wider distributions of averages**. In the early 2000s, a well-intentioned foundation noticed that small schools were disproportionately represented among the *best-performing* schools in state test rankings — and funded a large push to break big schools into small ones. But small schools also disproportionately fill the *worst-performing* ranks, for exactly the same statistical reason. The signal wasn't school quality; it was sample size. This is the CLT lesson in reverse: **before celebrating extreme averages, ask how many observations they're based on.**

## 6. Limits and pitfalls

- **Finite variance required.** Distributions with infinite variance (Cauchy, some power laws — see Ch 6) do *not* obey the CLT. Averaging Cauchy draws gives you another Cauchy, not a tighter one.
- **"Large enough n" depends on skew.** The rule of thumb "n ≥ 30" is a lie for very skewed or heavy-tailed sources. Recipe D shows why.
- **Independence is load-bearing.** Correlated draws inflate the variance of the mean; the effective sample size can be far smaller than $n$. Financial time series are the classic gotcha.
- **The tails can lie.** A distribution can look normal in the middle but have much heavier tails — and it's the tails that drive risk.

## 7. Connections

- **Lognormal (Ch 5.3 in the book).** The *multiplicative* counterpart of the normal: when effects multiply, the **log** of the outcome is normal — the raw outcome is right-skewed with a long tail (incomes, city sizes, firm sizes). Try `source = lognormal` in the simulator: sample means of lognormal draws also converge to a normal via the CLT, but *very slowly*. The book calls out this pair (normal / lognormal) as the two shapes additive vs. multiplicative processes produce.
- **Ch 6 — Power laws.** The natural counterpoint at the extreme end: additive averaging → normals; heavily multiplicative + preferential attachment → power laws. Different generating processes → very different tails.
- **Ch 7 — Linear regression.** Ordinary least-squares confidence intervals assume normally-distributed errors — the CLT is what usually rescues them for large samples.
- **Ch 13 — Random walks.** A random walk is a running sum; by the CLT its position after $n$ steps is approximately normal with variance $\propto n$.
- **Ch 17 — Markov models.** The stationary distribution of an ergodic chain often looks approximately normal around its mean.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 5.
- Central Limit Theorem — de Moivre (1733); Laplace (1810); Lyapunov (1901).
- Six Sigma — Bill Smith at Motorola (1986); Harry & Schroeder (2000) *Six Sigma: The Breakthrough Management Strategy*.

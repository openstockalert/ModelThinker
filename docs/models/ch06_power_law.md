# Ch 6 — Power laws (long tails)

**Tagline:** _When success feeds success, the outcome distribution has no meaningful average — a few winners take almost everything._

**REDCAPE:** Explain · Predict · Explore

---

## 1. Intuition

Power laws are the distributional shape you get when **growth is proportional to current size**. City populations, book sales, website popularity, wildfire sizes, and word frequencies all follow one. Unlike the normal distribution (Chapter 5), a power law has:

- **No meaningful mean** at low exponents — the mean is dominated by rare gigantic outliers.
- **Scale invariance** — zoom in on any part of the distribution and it looks the same shape as the whole.
- **"80/20 rule" (or worse)** — a small fraction of items account for most of the mass.

The model here is Barabási–Albert **preferential attachment**: start with a small seed graph; each new node connects to *m* existing nodes chosen with probability proportional to their current degree. Popular nodes get more edges; the "rich get richer." Degree distributions from this process follow $P(k) \propto k^{-3}$ asymptotically — the canonical power law of network science.

The simulator lets you grow a network, then shows: the degree distribution on log-log axes (a power law is a straight line), a Lorenz curve of degree concentration, and a table of the top-k hubs. It's the counterpart to Chapter 5: same interactive UI, radically different tail.

## 2. The model

**Barabási–Albert preferential attachment.** Start with a small connected seed of $m_0 \ge m$ nodes. At each step $t = 1, 2, \ldots$ add one new node and connect it to $m$ existing nodes chosen without replacement, where node $i$ (currently having degree $k_i$) is chosen with probability

$$
p_i \;=\; \frac{k_i}{\sum_{j} k_j}.
$$

Repeat until you have $n$ nodes. In the limit $n \to \infty$, the degree distribution approaches a power law

$$
P(k) \;\propto\; k^{-\gamma}, \qquad \gamma = 3.
$$

**Estimating the exponent** from an empirical degree sample $\{k_i\}$ with minimum $k_{\min}$ uses Clauset's MLE:

$$
\hat{\gamma} \;=\; 1 + n \left[\sum_{i=1}^{n} \ln \frac{k_i}{k_{\min} - \tfrac{1}{2}}\right]^{-1}.
$$

## 3. Parameters

| Name          | Symbol | Meaning                                    | Range          | Default | Effect of increasing                  |
|---------------|--------|--------------------------------------------|----------------|---------|---------------------------------------|
| `n`           | $n$    | Final number of nodes                      | $[100, 20{,}000]$ | `2000` | Sharper power-law shape; slower       |
| `m`           | $m$    | Edges added per new node                   | $[1, 20]$      | `2`    | Denser graph; taller minimum degree   |
| `seed`        | —      | RNG seed                                   | any int        | `42`   | —                                     |

## 4. Key results

1. **Straight line on log-log.** The degree distribution appears as a line when plotted with $\log k$ vs $\log P(k)$. Slope $\approx -3$ for pure BA. **Zipf's law** — a special case where $\text{rank} \times \text{size} \approx \text{const}$ — is what you get when the exponent is close to 1 (city sizes, word frequencies).
2. **Hubs dominate.** The top 1% of nodes hold a large fraction of edges. Compare to a random ER graph — its degree distribution is Poisson (no hubs).
3. **The mean isn't representative.** For $\gamma \le 2$ the mean is infinite in the theoretical limit; for $2 < \gamma \le 3$ the variance is infinite. Reporting "average node degree" understates the range.
4. **Scale-free ⇒ robust *and* fragile.** Removing random nodes barely dents connectivity (most are low-degree); removing hubs shatters the network. Different failure modes than random graphs.

### Where power laws show up (from Page's chapter)

City sizes · earthquake magnitudes · casualties in wars · book and music sales · website in-links · word frequencies (Zipf) · wealth · firm sizes · forest-fire areas.

### Three generating mechanisms (only #1 is implemented here)

1. **Preferential attachment** (this simulator). Rich-get-richer growth.
2. **Self-organized criticality** — the sandpile model. Grains drop onto a grid; overly steep piles topple onto neighbours, cascading in avalanches whose sizes are power-law distributed. Explains earthquakes, forest fires, and financial crashes as *systems that build up tension slowly and release it in any size of event*.
3. **Random return times** — the time for a random walk to return to zero is power-law distributed. Explains firm lifetimes and species survival.

Different mechanisms, same shape: fitting a power law doesn't identify the cause.

## 5. What to try

- **Recipe A — Classic BA scale-free.** `n = 2000, m = 2`. _Expected: on log-log, points fall along a line with slope ≈ -3. Top hub has hundreds of edges._
- **Recipe B — Denser attachment.** `n = 2000, m = 8`. _Expected: same power-law shape but shifted right (minimum degree = m). Exponent still ≈ 3._
- **Recipe C — Concentration inequality.** Same as A. _Expected: Lorenz curve shows top 20 % of nodes hold ~60–70 % of the edges — the 80/20 rule in graph form._
- **Recipe D — Small-network noise.** `n = 100`. _Expected: the log-log plot is too noisy to see the line clearly. Power laws are a large-sample phenomenon._

### Application vignette — MusicLab (Salganik, Dodds & Watts, 2006)

Page uses this experiment to make the case for power laws in cultural markets. Users on a music download site were split into groups: some saw download counts (social influence on), some didn't (independence). In the *independence* group, hit rankings were fairly predictable and inequality was modest. In the *social influence* groups, hit rankings became **far more unequal and far more unpredictable** — many different songs could become the top hit across parallel worlds. Preferential attachment (people click what others have clicked) turns modest quality differences into runaway winner-take-all outcomes. Same generating mechanism, same signature: a power-law tail of hits.

## 6. Limits and pitfalls

- **Log-log looks fool the eye.** Many distributions look linear on log-log over a limited range. Real power-law claims need tail-based MLE + a goodness-of-fit test (Clauset, Shalizi & Newman 2009).
- **Finite-size cutoffs.** No real system produces arbitrarily large events — there's always an upper cutoff.
- **The mechanism matters.** Preferential attachment is one of several generators — self-organized criticality, multiplicative noise, and rich-get-richer with an offset all give power laws. Fitting the shape doesn't identify the cause.
- **Independence is out the window.** Unlike Chapter 5, samples here are highly dependent — the CLT does not apply.

## 7. Connections

- **Ch 5 — Normal distributions.** The point-blank contrast: additive averaging ⇒ normal; multiplicative growth with preferential attachment ⇒ power law.
- **Ch 5.3 — Lognormal.** A middle ground: multiplicative but with finite variance — heavy right tail but no infinite moments.
- **Ch 10 — Network models.** BA is one of the canonical random-graph generators. Compare to Erdős–Rényi (Poisson degrees) and Watts–Strogatz (small-world with narrow degree distribution).
- **Ch 11 — Contagion.** On scale-free networks the effective R₀ can be very different from the mean-field SIR result; hubs are super-spreaders.
- **Ch 14 — Path dependence (Pólya urn).** Another rich-get-richer generator — Pólya urns produce beta-distributed shares that also encode preferential attachment.
- **Sandpile / SOC.** The other mechanism the book highlights for producing power laws — slow tension buildup + sudden avalanches (earthquakes, forest fires, market crashes).

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 6.
- Barabási, A.-L. & Albert, R. (1999). "Emergence of scaling in random networks." *Science*, 286, 509–512.
- Clauset, A., Shalizi, C. R. & Newman, M. E. J. (2009). "Power-law distributions in empirical data." *SIAM Review*, 51(4), 661–703.

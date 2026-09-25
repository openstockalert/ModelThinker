# Ch 14 — Path dependence (urn models)

**Tagline:** _Three urns, one coin flip per step — three completely different worlds. Positive feedback locks history in; negative feedback erases it; no feedback ignores it._

**REDCAPE:** Explain · Predict · Explore

---

## 1. Intuition

Some outcomes are shaped by their history. QWERTY keyboards, driving on the left in the UK, VHS beating Betamax, Silicon Valley being in Silicon Valley — none of these were inevitable. Small early events cascaded into locked-in equilibria. *That* is **path dependence**: what happens later depends not just on the current state of the system but on the sequence of events that got you here.

The urn framework is the cleanest way to isolate when history matters. You have a bag of coloured balls. At each step you draw one, look at its colour, and then something happens to the urn. The "something" is the entire story. Three rules give three completely different long-run worlds:

- **Bernoulli urn** — put the ball back, urn unchanged. No feedback. Draws are IID; the urn's composition never changes, and any statistic converges to its true value by the Law of Large Numbers. Past irrelevant.
- **Pólya urn** — put the ball back plus **one more of the same colour**. Positive feedback. The colour drawn first gets over-represented, biasing subsequent draws in its favour. The long-run fraction of red balls is *random*, and equally likely to end up anywhere in [0, 1]. History fully locks in.
- **Balancing urn** — put the ball back plus one of the **opposite** colour. Negative feedback. Whatever fraction of red you had, the next step nudges it back toward ½. History is erased.

Page uses this to distinguish path dependence (Pólya-like) from **tipping points** (a single moment sharply changes the likely outcome) and from **no dependence** at all (Bernoulli, and equilibrium Markov chains — see Ch 17).

## 2. The model

State: an urn containing $R$ red balls and $B$ blue balls. At each step $t$ you draw one uniformly at random. The probability of drawing red is $R / (R + B)$. Then the urn is updated by rule:

| Urn        | If red drawn      | If blue drawn     |
|------------|-------------------|-------------------|
| Bernoulli  | urn unchanged     | urn unchanged     |
| Pólya      | $R \leftarrow R + 1$ | $B \leftarrow B + 1$ |
| Balancing  | $B \leftarrow B + 1$ | $R \leftarrow R + 1$ |

Track $p_t = R_t / (R_t + B_t)$ — the fraction of red in the urn after step $t$. Its long-run behaviour distinguishes the three worlds:

$$
p_\infty \;\to\;
\begin{cases}
R_0 / (R_0 + B_0) & \text{(Bernoulli — constant)} \\
X \sim \text{Beta}(R_0,\, B_0)      & \text{(Pólya — random limit)} \\
1/2                                  & \text{(Balancing — deterministic)}
\end{cases}
$$

Starting from a symmetric urn ($R_0 = B_0 = 1$), the Pólya limit is $\text{Uniform}(0, 1)$: *every* long-run share is equally likely. This is Pólya's classical urn theorem (Pólya, 1930).

**Entropy as a signal of path dependence.** Run $N$ trajectories from the same starting state and record the final fraction $p_\infty^{(1)}, \ldots, p_\infty^{(N)}$. Then measure the Shannon entropy $H$ of this empirical distribution. Path-dependent processes produce spread-out outcomes ⇒ **high entropy**. Non-path-dependent processes concentrate at a point ⇒ **low entropy**.

## 3. Parameters

| Name              | Symbol   | Meaning                                   | Range        | Default | Effect of increasing                  |
|-------------------|----------|-------------------------------------------|--------------|---------|---------------------------------------|
| `urn_type`        | —        | `"bernoulli"`, `"polya"`, or `"balancing"` | choice       | `"polya"` | Selects the update rule                |
| `steps`           | $T$      | Number of draws per trajectory             | $[10, 10^5]$ | `500`   | Sharpens the long-run distribution     |
| `initial_red`     | $R_0$    | Starting red balls                         | $\mathbb{N}^+$ | `1`     | Biases Pólya limit toward more red     |
| `initial_blue`    | $B_0$    | Starting blue balls                        | $\mathbb{N}^+$ | `1`     | Biases Pólya limit toward more blue    |
| `n_walks`         | $N$      | Independent trajectories to run            | $[1, 10^4]$  | `1`     | Reveals the shape of the final-share distribution |
| `seed`            | —        | RNG seed                                   | any int      | `42`    | —                                      |

## 4. Key results

1. **Bernoulli — LLN, no drama.** Any observable statistic (running sample-mean, urn composition) converges to a fixed number determined only by the initial state. History irrelevant.
2. **Pólya — Uniform limit.** With $R_0 = B_0 = 1$, the final fraction is $\text{Uniform}(0, 1)$. Any outcome is equally likely, and *which* outcome you get is a compounding of early luck. This is the pure form of **equilibrium path dependence** (Page's term).
3. **Beta generalisation.** For general starting counts, the Pólya limit is $\text{Beta}(R_0, B_0)$. Increasing the starting counts makes the Beta narrower — you can crush path dependence by pre-loading the urn.
4. **Balancing — deterministic ½.** Whatever composition you start with, the fraction of red drifts back to ½. Negative feedback erases initial conditions.
5. **Entropy as diagnostic.** Empirical entropy of the final-fraction distribution is ~0 for Bernoulli and Balancing (concentrated), high for Pólya (spread over [0,1]).

## 5. What to try

- **Recipe A — Pólya's uniform limit.** `urn_type = "polya"`, `steps = 2000`, `n_walks = 5000`, `R0 = B0 = 1`. _Expected: histogram of final fractions is roughly flat over [0, 1]. Sample trajectories drift to wildly different endpoints._
- **Recipe B — Bias the Pólya urn.** `urn_type = "polya"`, `R0 = 5`, `B0 = 1`. _Expected: final-fraction distribution is now Beta(5, 1), peaked near 1. Adding starting balls quietly kills path dependence._
- **Recipe C — Balancing erases history.** `urn_type = "balancing"`, `R0 = 90`, `B0 = 10`. _Expected: even from 90 % red start, the fraction drifts to 0.5. Give it enough steps to see convergence._
- **Recipe D — Bernoulli's boring flatness.** `urn_type = "bernoulli"`, any settings. _Expected: every trajectory is a flat line at `R0 / (R0 + B0)`. That flat line **is** the message: no update rule ⇒ no memory ⇒ no dependence._
- **Recipe E — The entropy comparison.** Run all three urns with the same params, look at the entropy of the final-share distribution. Pólya ≈ log₂(bins); Bernoulli/Balancing ≈ 0.

## 6. Limits and pitfalls

- **The urn is a metaphor, not a mechanism.** Real path dependence in technology adoption or institutional design involves network externalities, coordination costs, sunk investments — messier than "add a ball." The Pólya urn is the *canonical* form; it captures the *why* but not the specifics.
- **Reversibility.** In the pure model, once locked in you stay locked in. Real systems can be un-locked (Dvorak keyboards, metric-system reforms) though the friction is high.
- **Initial state matters more than you'd think.** For Pólya, the whole distribution of long-run outcomes is $\text{Beta}(R_0, B_0)$. Choosing $R_0 = B_0 = 1$ gives the "maximum path dependence" (uniform). Larger seed values reduce it.
- **Balancing needs steps.** Convergence to ½ is slow when you start far from it. Don't declare "history erased" after 100 steps if you started at 90 %.

## 7. Connections

- **Ch 6 — Power laws / preferential attachment.** The Barabási–Albert graph-growth model *is* a multi-urn generalisation of Pólya. New nodes attach with probability proportional to current degree ⇒ hubs get more hubs. Path dependence produces the power-law degree distribution.
- **Ch 11 — Contagion / MusicLab.** Salganik, Dodds & Watts (2006) is Pólya-in-the-wild for music popularity: with social influence, the winner is unpredictable and depends on early clicks. Same math, different labelling.
- **Ch 15 — Local interaction.** Coordination games on networks lock in conventions (drive-on-left) through positive feedback — a spatial Pólya.
- **Ch 17 — Markov chains.** The Markov convergence theorem says ergodic chains forget their starting state — the *opposite* of path dependence. Pólya urns are famously non-ergodic; that's what makes them memory-preserving.
- **Ch 19 — Threshold models and tipping points.** Related but distinct: tipping points are *sharp* thresholds where a single event flips the outcome; path dependence is *gradual* accumulation. Page distinguishes them via changes in entropy.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 14.
- Pólya, G. (1930). "Sur quelques points de la théorie des probabilités." *Annales de l'Institut Henri Poincaré*, 1(2), 117–161.
- Arthur, W. B. (1994). *Increasing Returns and Path Dependence in the Economy*. University of Michigan Press.
- Salganik, M. J., Dodds, P. S. & Watts, D. J. (2006). "Experimental study of inequality and unpredictability in an artificial cultural market." *Science*, 311(5762), 854–856.
- David, P. A. (1985). "Clio and the economics of QWERTY." *American Economic Review*, 75(2), 332–337.

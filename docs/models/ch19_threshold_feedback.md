# Ch 19 — Threshold models with feedback

**Tagline:** _Same skeleton — "I watch what others do, then decide" — but the sign of the feedback flips everything: positive feedback (riots) is bimodal and unpredictable; negative feedback (El Farol) stabilises the average and randomises the individual case._

**REDCAPE:** Reason · Explain · Communicate · Explore

---

## 1. Intuition

Chapter 19 studies two very common social dynamics that share a rule shape and differ only in one sign. In both, people watch what others are doing and then decide. The difference is:

- **Positive feedback (Granovetter 1978).** *Join if enough others act.* Once a few people move, more get pulled in, then more. Small initial differences amplify. Outcomes are bimodal (all-or-nothing) and outcome-unpredictable — two crowds with nearly identical distributions of preferences can end up at opposite outcomes. Standard examples: riots, standing ovations, bank runs, fashion adoption, standing to leave a lecture.

- **Negative feedback (Brian Arthur's El Farol, 1994).** *Act if few others do.* When most people conclude "it'll be crowded," they stay away and it's quiet. When they conclude "it'll be quiet," they show up and it's crowded. Any shared forecast destroys itself. Outcomes stabilise near an efficient level, but *individual* weeks are noisy and unpredictable. Standard examples: traffic, restaurants, popular hiking trails, water conservation during droughts.

**Tipping points** provide the bridge: both dynamics feature "small parameter change ⇒ qualitative outcome flip." Page's careful definition — a tipping point is a property of a *model*, not the world — comes with a testable signature: **at the tip, the outcome distribution's Shannon entropy peaks**. Away from the tip, the outcome is nearly certain; at the tip, the same setup produces "full riot" half the time and "fizzle" the other half.

The single practical lesson: **for positive-feedback systems, the average outcome is never a typical outcome**, so planning around expected values is malpractice. For negative-feedback systems, the average is fine and the variance is where the interesting story lives.

## 2. The model

### Granovetter cascade (count-based)

Each of $n$ agents has a threshold $t_i \in [0, n]$: "I join iff the number of others currently acting is at least $t_i$." Sort thresholds; the process is the fixed-point iteration

$$
x_{k+1} = |\{i : t_i \le x_k\}|
$$

starting from a small seed (usually $x_0 = 1$ for one instigator). It stops at the first $x$ where $x = |\{i : t_i \le x\}|$. Graphically, plot the cumulative distribution $F(x) = |\{i : t_i \le x\}|$ against the 45° line — the cascade climbs the diagonal until $F$ first drops below it, and stops there.

### Fractional-threshold cascade on a network (Watts 2002)

Each node $v$ has a threshold $\phi \in [0, 1]$. Node $v$ acts iff the fraction of *its neighbours* currently acting reaches $\phi$. Seeded with a small set of initial actors on graph $G$. **Global cascades** (majority of the network joins) exist only in a middle window of graph density: too sparse, nothing propagates; too dense, each neighbour dilutes the others' influence.

### El Farol bar (Arthur 1994)

$N$ agents, one bar with capacity $c$. Going is fun if attendance $< c$, unpleasant otherwise. Each week each agent uses one of a *personal* small set of predictors (last week, moving average, mirror, constant, trend, …) to forecast next week's attendance; they attend iff their forecast $< c$. Any predictor everyone uses gets falsified — the *diversity* of predictors is what makes attendance settle near $c$.

### Tipping-point signature

For any parameter $\theta$ controlling the model, sweep $\theta$; at each value run many simulations; discretise outcomes into equal bins over the possible range and compute Shannon entropy:

$$
H(\theta) = -\sum_{b=1}^{B} p_b(\theta) \log_2 p_b(\theta) \quad \text{bits}
$$

$H$ peaks at the tipping point.

## 3. Parameters

### Granovetter cascade

| Name | Symbol | Meaning | Range | Default | Effect |
|------|--------|---------|-------|---------|--------|
| `thresholds` | $(t_i)$ | Per-person triggering thresholds | $\mathbb{R}^n$ | — | Wider variance → more likely to cascade (up to a limit) |
| `instigators` | — | External actors seeded outside the population | $\mathbb{N}$ | `0` | More instigators → cascade more likely to start |

### Variance sweep

| Name | Meaning | Range | Default | Effect |
|------|---------|-------|---------|--------|
| `mean_threshold` | Mean of the normal threshold distribution | $[0, n]$ | `25` | Higher mean → harder to cascade |
| `sds` | Array of SDs to sweep | $[0, n]$ | — | See recipes |
| `n_agents` | Population size | $\mathbb{N}^+$ | `100` | Bigger = smoother statistics |
| `n_runs` | Runs per SD value | $\mathbb{N}^+$ | `400` | Bigger = tighter tipping-point estimate |

### Network cascade (Watts)

| Name | Meaning | Default | Effect |
|------|---------|---------|--------|
| `threshold_frac` $\phi$ | Fraction of neighbours needed to trigger | `0.18` | Higher φ → harder to cascade |
| `initial_seeds` | Initial acting set | random single node | Seed identity matters (hubs vs periphery) |

### El Farol

| Name | Meaning | Default | Effect |
|------|---------|---------|--------|
| `n_agents` | Population | `100` | Scales attendance directly |
| `capacity` | Fun-if-below threshold | `60` | Sets the target attendance |
| `n_weeks` | Simulation length | `100` | More weeks = more data for statistics |
| `predictors_per_agent` | How many rules each agent keeps | `3` | 1 = homogeneous catastrophe; 3+ diverse |
| `homogeneous` | Force every agent to use the same predictor | `False` | `True` reproduces Arthur's cautionary case |

## 4. Key results

1. **Two crowds with identical means, opposite outcomes.** Move one threshold from 1 to 2 (mean shifts by 0.01) and the cascade goes from 100 people to 1 person. The average is a useless summary; what matters is whether the cumulative curve has any gaps.
2. **Variance matters more than the mean.** At fixed mean, low SD → nobody starts; medium SD → full cascades most of the time; high SD → cascades start but stall on stubborn holdouts. The cascade regime is a middle band of diversity.
3. **Outcomes are bimodal, not average.** In the transition band, ~85% of runs land at "full riot" and ~14% at "fizzle" — almost nothing in between. The average outcome is a number that essentially never happens.
4. **Instigators are highly leveraged.** Changing one person's threshold from a middle value to 0 can turn "no cascade possible" into "cascade half the time." That's why authoritarian regimes arrest a handful of named organisers.
5. **Watts' cascade window.** On networks, global cascades happen only in a middle band of network density. Too sparse: fire doesn't jump. Too dense: each neighbour's influence gets diluted by the others.
6. **El Farol's diversity paradox.** With identical predictors, attendance oscillates violently between empty and packed. With diverse predictors, attendance self-organises near capacity with no coordination at all. **Diversity of belief** is what stabilises the aggregate.
7. **Tipping-point signature.** Outcome-distribution Shannon entropy spikes at the tip. This is testable — a signature you can detect from data before you know which model applies.

## 5. What to try

- **Recipe A — the canonical pair.** In the Streamlit page's Granovetter tab, set N = 100, mean = 25, SD = 15. Try seeds 1, 2, 3 in succession. Watch the outcome swing between full cascade and near-zero across seeds. Same distribution, different outcomes.
- **Recipe B — the tipping-point signature.** In the Tipping-point tab, watch the entropy curve peak. Notice how the *mean cascade size* line rises smoothly through the transition — it hides the story. Only the entropy plot exposes it. This is Page's argument for using entropy over first moments.
- **Recipe C — instigator arithmetic.** Set SD = 10 (fizzle regime), instigators = 0 → no cascade. Bump instigators to 3 → occasional full cascade. Bump to 5 → nearly always cascade. Understand why "arrest the organisers" is such an effective authoritarian move.
- **Recipe D — Arthur's cautionary case.** In the El Farol tab, toggle "everyone uses the same predictor" ON. Watch attendance oscillate between packed and empty. Toggle OFF and 3+ predictors per agent → attendance settles cleanly near capacity, but *individual weeks* remain unpredictable.
- **Recipe E — Watts' cascade window.** In the Bonus panel on the Granovetter tab, sweep mean degree from 1 to 20 at fixed φ = 0.18. The global-cascade fraction rises then falls — a *cascade window* with both a floor and a ceiling. Too dense is worse than sparse.

## 6. Limits and pitfalls

- **Thresholds are private and often falsified.** You can't survey them honestly — asking "would you join a riot if 30 others did?" gets you a lie, especially where the answer is dangerous. Timur Kuran calls this **preference falsification**. The cumulative curve is invisible right up until the cascade reveals it, which is why revolutions surprise everyone including their own participants.
- **The count-based version ignores structure.** Real thresholds involve friends and neighbours, not the whole population. The Watts network version is the pedagogically important refinement.
- **"Tipping point" is the most abused term in popular social science.** Page's definition: *a property of a model*, not of the world. Say which model and which variable, or you're just narrating that "something big happened." The entropy signature makes it a testable claim.
- **The El Farol simulation depends on the predictor pool.** With a broader / more sophisticated pool, agents can coordinate better. With a narrower pool, homogeneity effects dominate. The exact numbers here are illustrative, not universal.
- **Delayed negative feedback flips sign.** If agents react to *stale* information (last quarter's shortage → this quarter's investment), the same negative-feedback rule that stabilises can start oscillating violently. That's Ch 18's systems-dynamics point arriving in threshold clothing.
- **The count-based cascade is *monotone* — no one un-joins.** Real cascades can reverse (protests peter out, fashions die). Adding reversibility introduces cycles.

## 7. Connections

- **Ch 10 — Networks.** Watts' fractional-threshold cascade lives on networks. The identity of the seed (hub vs periphery) matters a lot — connects to Ch 10's friendship-paradox intuition.
- **Ch 11 — Contagion / SIR.** R₀ crossing 1 is the classic direct tipping point. The threshold cascade is the discrete-agent version of SIR's continuous phase transition.
- **Ch 12 — Entropy.** Outcome entropy is Chapter 12's Shannon entropy applied to model outcomes — the tipping-point signature is entropy in a specific role.
- **Ch 14 — Path dependence.** Path dependence *accumulates* small events; a tip is a single moment. Page calls out this distinction explicitly and it's easy to conflate.
- **Ch 3 — Diversity Prediction Theorem.** The El Farol diversity result is the same mechanism — diverse errors cancel, correlated errors compound.
- **Ch 24 — Mechanism design.** Deposit insurance for bank runs: don't try to raise thresholds through reassurance (which itself signals danger), change the *payoffs* so the threshold is never reached. The best illustration in the book of combining two model families to solve a real problem.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 19.
- Granovetter, M. (1978). *Threshold models of collective behavior.* American Journal of Sociology 83(6), 1420–1443. — the count-based threshold model.
- Watts, D. J. (2002). *A simple model of global cascades on random networks.* PNAS 99(9), 5766–5771. — the fractional-threshold network version and the cascade window.
- Arthur, W. B. (1994). *Inductive reasoning and bounded rationality: the El Farol problem.* American Economic Review 84(2), 406–411.
- Kuran, T. (1991). *Now out of never: the element of surprise in the East European revolution of 1989.* World Politics 44(1), 7–48. — preference falsification.
- Miller, J. H., & Page, S. E. (2004). *The standing ovation problem.* Complexity 9(5), 8–16.
- Diamond, D., & Dybvig, P. (1983). *Bank runs, deposit insurance, and liquidity.* Journal of Political Economy 91(3), 401–419. — deposit insurance as a threshold intervention.

# Ch 15 — Schelling segregation

**Tagline:** _Individually mild preferences ("I want at least ⅓ of my neighbours to be like me") produce dramatic collective segregation. Emergence, in one grid._

**REDCAPE:** Explain · Explore · Communicate

---

## 1. Intuition

Thomas Schelling's 1971 model is the canonical demonstration that **micro-motives don't equal macro-behaviour**. Put two coloured populations on a grid. Give every agent a tolerance rule: "I'm happy if at least a fraction *τ* of my neighbours share my colour." Unhappy agents move to a random empty cell. Nobody wants segregation. Yet within a few dozen steps, the grid separates into large monochrome clusters.

The unnerving lesson: **outcomes are not preferences.** Even when every individual would accept a mixed neighbourhood, if they insist on *not* being a small minority, aggregate segregation is nearly unavoidable. The threshold at which this happens is surprisingly low — clusters emerge even when agents are content in a 50/50 neighbourhood, and become severe once τ passes ~0.3.

The simulator lets you set the grid size, empty-cell fraction, and tolerance, then watch the grid rearrange step by step. A segregation index (average fraction of same-colour neighbours) tracks the collective outcome, so you can see the phase transition directly.

## 2. The model

- Grid: an $L \times L$ square lattice with two agent types and empty cells.
- Density $d$: fraction of cells occupied by agents; each occupied cell is type A with probability $1/2$, else type B.
- Tolerance $\tau \in [0, 1]$: an agent is *happy* if the fraction of its non-empty Moore-neighbours (up to 8) of its own type is $\ge \tau$.
- **Dynamics.** At each step, an unhappy agent is picked at random and moved to a random empty cell. Repeat until every agent is happy or a step budget is exhausted.

Segregation index at time $t$:

$$
S_t \;=\; \frac{1}{N} \sum_{i} \frac{|\{j \in \mathcal{N}(i) \,:\, \text{type}(j) = \text{type}(i)\}|}{|\mathcal{N}(i)|}
$$

where $\mathcal{N}(i)$ is the set of non-empty Moore-neighbours of agent $i$ and $N$ is the number of agents. $S_t = 0.5$ under a random placement (in a balanced population); $S_t \to 1$ under complete segregation.

## 3. Parameters

| Name         | Symbol | Meaning                                             | Range           | Default | Effect of increasing                     |
|--------------|--------|-----------------------------------------------------|-----------------|---------|------------------------------------------|
| `grid_size`  | $L$    | Side length of the square grid                      | $[10, 100]$     | `40`    | More agents, slower to converge, sharper clusters |
| `density`    | $d$    | Fraction of cells occupied                          | $[0.1, 0.95]$   | `0.9`   | Fewer empty cells ⇒ harder for unhappy agents to move |
| `tolerance`  | $\tau$ | Minimum same-type neighbour fraction to be happy    | $[0.0, 1.0]$    | `0.3`   | Higher τ ⇒ much more segregation, up to a point where nobody can ever be happy |
| `max_steps`  | —      | Simulation step budget (one unhappy agent moved per step) | $[100, 50{,}000]$ | `5000` | Longer runs settle further                |
| `seed`       | —      | RNG seed                                            | any int         | `42`    | —                                        |

## 4. Key results

1. **Emergent segregation.** Even at $\tau = 0.3$ (agents happy being a 30% minority), the equilibrium segregation index is typically $> 0.75$.
2. **Sharp threshold.** Around $\tau \approx 0.5$ the system starts to *fail* to settle — some agents are permanently unhappy because no move satisfies them.
3. **Density matters.** Very high density ($d > 0.95$) traps unhappy agents; very low density loosens clusters.
4. **Micro-motives ≠ macro-behaviour.** Nobody in the model *wants* segregation; it emerges anyway. This is Schelling's headline lesson.

### Ch 15 in the book covers a family of local-interaction models

Schelling is the flagship, but Page's Chapter 15 (*Local Interaction Models*) sits it alongside three sister models. All share the same idea — global patterns emerge from simple local rules — but differ in the rule and what emerges:

- **Local Majority.** Each cell copies whatever state most of its neighbours hold. Grid freezes into stable clusters. Explains dialects, local customs, political leanings.
- **Conway's Game of Life.** A cell survives with 2–3 live neighbours, is born with exactly 3, dies otherwise. Simple rules → gliders, oscillators, and (astonishingly) self-replicating structures. Shows *all four* Wolfram outcome classes: fixed, periodic, random, complex.
- **Pure coordination games on a network.** Agents gain by matching their neighbours' actions. Explains driving-side conventions (right vs left), metric vs imperial units, greeting customs, corporate cultures — and *why* mergers clash.

The unifying takeaway (Page's *cognitive-closure* point restated locally): if a pattern emerges under all four rules, it's a robust feature of local interaction, not an artefact of the specific rule.

## 5. What to try

- **Recipe A — The classic result.** `grid_size = 40`, `density = 0.9`, `tolerance = 0.3`. _Expected: segregation index climbs from ~0.5 to 0.8+ within ~2000 steps; distinct monochrome patches emerge._
- **Recipe B — Tolerance sweep.** Fix everything else; try τ = 0.1, 0.3, 0.5, 0.7. _Expected: near-random at 0.1, clear clusters at 0.3, severe segregation at 0.5, no equilibrium at 0.7._
- **Recipe C — Density trap.** `tolerance = 0.4`, `density = 0.98`. _Expected: even willing movers can't find good empty cells; the system stalls in a moderately-segregated but unhappy state._
- **Recipe D — Perverse "integration."** Set `tolerance = 0.7` and watch: what looks like a demand for majority-status leaves many agents permanently unhappy but doesn't dramatically increase segregation beyond τ = 0.5.

## 6. Limits and pitfalls

- **The rule is a caricature.** Real housing choice involves prices, schools, commute, family — not just neighbour composition. Don't over-index on this model as a literal account of segregation.
- **Random relocation.** Real agents move to *better* cells, not random empty ones. The classic Schelling rule is a lower-bound demonstration; smarter movers segregate *faster*.
- **Symmetric population.** The 50/50 split makes both groups active seekers. Asymmetric populations (say 80/20) show different dynamics.
- **Grid effects.** Boundaries and grid topology matter; hex grids or continuous space soften the effect.

## 7. Connections

- **Sister models in Ch 15.** Local Majority (consensus by copying), Game of Life (self-organised complexity), Coordination on a network (locked-in conventions). Same "simple local rule → emergent macro pattern" template, different rule.
- **Ch 11 — Contagion & networks.** Both models are agent-based and produce macro patterns from local rules — but Schelling has spatial state, SIR has state changes without movement.
- **Ch 19 — Threshold models with feedback.** Same conceptual family at the population level: an individual threshold triggers a cascade. Schelling is the *spatial* version.
- **Ch 20 — Spatial choice.** Formalises the *why* of location choice that Schelling abstracts away.
- **Ch 23 — Collective action problems.** Another case where individually rational behaviour aggregates to a socially bad outcome — and where designing institutions (Ostrom's principles) can prevent it.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 15.
- Schelling, T. C. (1971). "Dynamic models of segregation." *Journal of Mathematical Sociology*, 1(2), 143–186.
- Schelling, T. C. (1978). *Micromotives and Macrobehavior*. Norton.

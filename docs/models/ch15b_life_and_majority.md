# Ch 15b — Life & Local Majority

**Tagline:** _Two cellular automata on the same grid, one produces frozen consensus, the other produces spaceships. Complexity is a matter of the rule._

**REDCAPE:** Explain · Explore · Communicate

---

## 1. Intuition

*The Model Thinker*'s Chapter 15 (Local Interaction Models) is really four models sharing one mechanic — a 2-D grid of cells, each updated by looking at its neighbours. This page hosts the two automata *besides* Schelling: **Conway's Game of Life** (§15.2) and the **Local Majority Model** (§15.1). Same grid, same neighbourhood, radically different long-run behaviour.

- **Local Majority.** Every cell copies whichever state is in the local majority. The grid rapidly *freezes* into contiguous clusters of same-value cells. Small changes in initial conditions produce different cluster boundaries, but *some* clustering is inevitable. Page uses this to model how dialects, greeting customs, and political leanings drift into local pockets.
- **Game of Life.** John Conway's 1970 zero-player game. A live cell survives with 2 or 3 live neighbours; a dead cell is born with exactly 3. That's the entire rulebook. What emerges from three lines of rules is astonishing: still lifes, oscillators, spaceships that translate through the grid, Turing-complete computation, and self-replicating patterns. Conway's game is *the* canonical demonstration of emergence — arbitrary complexity from arbitrarily simple local rules.

The pedagogical pair is: **Local Majority = simple stable, Life = simple emergent.** Same neighbourhood function, tiny rule change, wildly different worlds. Which of your systems is which?

## 2. The models

### Local Majority
Grid $G_t \in \{0, 1\}^{N \times N}$. Each cell's next state is:

$$
G_{t+1}(r, c) \;=\;
\begin{cases}
1 & \text{if } n_1(r, c) > 4 \\
0 & \text{if } n_1(r, c) < 4 \\
G_t(r, c) & \text{if } n_1(r, c) = 4 \text{ (tie)}
\end{cases}
$$

where $n_1(r, c)$ is the number of 1s among the 8 Moore neighbours of $(r, c)$. Optionally, ties can be resolved by a coin flip instead of "keep current". Boundary treatment: toroidal wrap (default) or zero-padding.

**Result.** Rapid convergence to a fixed point with contiguous single-value clusters. Convergence usually takes fewer than $\log N$ rounds for a random start.

### Game of Life
Same grid. Same $n_1$ neighbour count. Update rule:

$$
G_{t+1}(r, c) \;=\;
\begin{cases}
1 & \text{if } G_t(r, c) = 1 \text{ and } n_1(r, c) \in \{2, 3\} \\
1 & \text{if } G_t(r, c) = 0 \text{ and } n_1(r, c) = 3 \\
0 & \text{otherwise}
\end{cases}
$$

The rule fits on a napkin. What comes out doesn't. A partial menagerie:

- **Still lifes** (block, beehive) — never change.
- **Oscillators** (blinker period 2, pulsar period 3) — cycle forever.
- **Spaceships** (glider, LWSS) — translate across the grid at speeds ≤ c/2.
- **Methuselahs** (R-pentomino, acorn) — tiny inputs, hundreds or thousands of steps of chaos before settling.
- **Guns** (Gosper glider gun) — infinite growth, emitting a new spaceship every 30 steps.
- **Computers** — Life is Turing-complete; someone has built a working universal Turing machine inside it.

## 3. Parameters

| Name              | Symbol | Meaning                                  | Range          | Default | Effect of increasing                    |
|-------------------|--------|------------------------------------------|----------------|---------|-----------------------------------------|
| `grid_size`       | $N$    | Side length of square grid               | $[10, 100]$    | `40`    | More space for patterns to evolve       |
| `steps`           | $T$    | Max update rounds                        | $[10, 10^4]$   | `200`   | Longer runs; catches methuselahs        |
| `wrap`            | —      | Toroidal boundary?                       | bool           | `true`  | Off: patterns can escape                |
| `initial_density` | $p$    | Fraction of 1s at start (majority only)  | $[0, 1]$       | `0.5`   | Higher: majority favours 1s             |
| `tie_flip`        | —      | Randomise on 4-4 majority ties            | bool           | `false` | Adds stochastic wobble                  |
| `seed`            | —      | RNG seed                                 | any int        | `42`    | —                                       |

Life-specific parameters:

| Name              | Meaning                                                 | Default |
|-------------------|---------------------------------------------------------|---------|
| `pattern`         | Named starting pattern (block, glider, r_pentomino, …)  | `glider` |
| `stop_when_stable`| Halt once the grid is unchanged from previous step      | `true`   |

## 4. Key results

1. **Local Majority always converges rapidly.** For an $N \times N$ grid, typically $O(\log N)$ rounds to a fixed point. The fixed point is a *clustered* configuration — never all-1s or all-0s from a random start.
2. **Cluster count decreases monotonically over time** as small islands get absorbed into their larger neighbours. The final cluster count depends on initial density and grid size, but is always << $N^2$.
3. **Game of Life has no closed-form theory of eventual behaviour** — famously *undecidable* in general (a corollary of Turing completeness). Even predicting whether a small starting pattern will die out is undecidable.
4. **Emergence.** The set of long-lived Life patterns (oscillators + spaceships + guns) is *strictly larger* than what the three rules can be summarised by. This is the mathematical content of "emergence": the state space of the system is richer than the rule that generates it.
5. **Tiny inputs, huge outputs.** The **acorn** pattern is 7 cells and stabilises at step **5206** with 633 live cells + 13 escaping gliders. The **R-pentomino** is 5 cells and stabilises at step 1103.

## 5. What to try

- **Recipe A — The glider tour.** In the Life tab, load `glider`, `grid_size = 30`, `wrap = true`, `steps = 100`. _Expected: a diagonal line of 100 glider positions covering half the grid._
- **Recipe B — Emergence in miniature.** Load `r_pentomino`, `grid_size = 60`, `wrap = false`, `steps = 1200`. _Expected: chaotic peak population ~319 around step ~1000, settling into a mess of oscillators + gliders that don't collide._
- **Recipe C — The gun.** Load `glider_gun`, `grid_size = 45`, `wrap = false`, `steps = 200`. _Expected: 30-step-period emission of gliders indefinitely._
- **Recipe D — Cluster consensus.** In the Local Majority tab, `grid_size = 50`, `initial_density = 0.5`, `steps = 100`. _Expected: converges in <20 steps to a stable configuration with 5–15 clusters._
- **Recipe E — Below-threshold minority.** Local Majority with `initial_density = 0.2`. _Expected: converges to nearly all 0s — sparse 1s get absorbed by their 0-majority neighbourhoods._

## 6. Limits and pitfalls

- **The grid is a metaphor.** Real "local interaction" happens in social networks, not literal 2-D lattices. The clustering intuition carries over; the specific dynamics don't.
- **Toroidal boundaries change everything for Life.** A glider on a torus returns to its start; on a bounded grid it escapes into empty space. Choose deliberately.
- **Life's beauty is generic; Local Majority's is specific.** Life produces the *same* menagerie from wildly different seeds (glider, gun, pulsar). Local Majority produces *different-shaped* clusters from different seeds, but the clustering itself is universal.
- **Simulation cost.** Both models are $O(N^2)$ per step. For 100 × 100 grids over 1000 steps, that's 10 million updates — still fast, but not free.

## 7. Connections

- **Ch 15.3 — Schelling.** Same grid, different update rule (agents move to satisfy a preference). Schelling exhibits path-dependent segregation; Local Majority converges deterministically to clusters. Both produce macro patterns from micro rules.
- **Ch 12 — Entropy / cellular automata.** Wolfram's four-classes framework (fixed, periodic, random, complex) is the standard classification for CA output. Life is class 4 (complex); Local Majority is class 2 (periodic/fixed).
- **Ch 6 — Power laws.** The distribution of Life oscillator sizes, glider return times, and methuselah stabilisation times all follow heavy-tailed distributions.
- **Ch 17 — Markov chains.** Local Majority is a deterministic Markov chain on the finite state space $\{0,1\}^{N^2}$. Life is too — but on a state space of $2^{N^2}$ configurations (astronomically large for $N > 10$).

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 15.
- Conway, J. H. (via Gardner, M.) (1970). "Mathematical Games — The fantastic combinations of John Conway's new solitaire game 'life'." *Scientific American*, 223(4), 120–123.
- Berlekamp, E. R., Conway, J. H. & Guy, R. K. (1982). *Winning Ways for Your Mathematical Plays*, Vol. 2, Ch. 25 — the mathematical treatment of Life.
- Rendell, P. (2011). "A universal Turing machine in Conway's Game of Life." *Turing Centenary Conference*.
- Wolfram, S. (2002). *A New Kind of Science* — cellular automata classification.
- LifeWiki. https://conwaylife.com/wiki/ — the canonical reference for Life patterns.

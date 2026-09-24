# Ch 28 — NK rugged landscapes

**Tagline:** _When decisions interact, local hill-climbing gets stuck. Rugged landscapes explain why smart search sometimes needs long jumps._

**REDCAPE:** Explore · Explain · Design

---

## 1. Intuition

Imagine you're tuning $N$ binary decisions — features to include in a product, genes in an organism, policy levers in a plan — and each decision's contribution to overall "fitness" depends not just on itself but on $K$ other decisions. When $K = 0$, decisions are independent: pick the best value of each in isolation and you're done — a **Mount Fuji landscape**, one clean peak. As $K$ grows, decisions interact — improving one may worsen another — and the fitness landscape develops many local peaks: a **rugged landscape**. Local search (flip one bit at a time) gets stuck on a nearby hilltop that isn't the global best.

This is Stuart Kauffman's **NK model**. Its two knobs control the *ruggedness* of the search problem:

- **$N$** — number of dimensions (bits). Bigger = larger search space.
- **$K$** — interaction breadth. $K = 0$ ⇒ single-peaked (smooth) landscape. $K = N-1$ ⇒ maximum ruggedness (each solution's fitness is essentially uncorrelated with its neighbours).

The simulator lets you build a random NK landscape and try three search strategies: **hill climbing** (local, greedy), **random restart** (many hill climbs from different starts), and **long jumps** (mutate several bits at once). You'll see empirically why complex problems reward exploration.

## 2. The model

Encode a solution as a bit-string $x \in \{0, 1\}^N$. For each position $i$ pre-assign a set of $K$ neighbouring positions $\mathcal{N}(i) \subseteq \{1, \ldots, N\} \setminus \{i\}$. For every possible pattern of the $K+1$ bits at positions $\{i\} \cup \mathcal{N}(i)$, draw a random fitness contribution $f_i(\cdot) \sim \mathrm{Uniform}(0, 1)$. The total fitness of solution $x$ is the average:

$$
F(x) \;=\; \frac{1}{N} \sum_{i=1}^{N} f_i\!\left(x_i, x_{\mathcal{N}(i)}\right).
$$

Because each $f_i$ depends on $K+1$ bits, flipping bit $j$ changes the contributions of *all* positions $i$ for which $j \in \{i\} \cup \mathcal{N}(i)$ — that's roughly $K+1$ positions. Hence bigger $K$ ⇒ more entangled ⇒ more local peaks.

**Number of local peaks** in expectation scales as

$$
\mathbb{E}[\text{peaks}] \;\approx\; \frac{2^N}{N + 1} \cdot \frac{K}{N-1} + \text{const}.
$$

## 3. Parameters

| Name           | Symbol | Meaning                                        | Range              | Default    | Effect of increasing                        |
|----------------|--------|------------------------------------------------|--------------------|------------|---------------------------------------------|
| `N`            | $N$    | Number of binary decisions (bits)              | $[4, 22]$          | `12`       | Exponentially larger search space ($2^N$)   |
| `K`            | $K$    | Number of interacting neighbours per bit       | $[0, N-1]$         | `2`        | More ruggedness, more local peaks           |
| `budget`       | —      | Total search steps allowed per strategy        | $[50, 5{,}000]$    | `500`      | More search ⇒ higher fitness (diminishing)  |
| `n_restarts`   | —      | For random-restart hill climbing               | $[2, 50]$          | `10`       | More starts ⇒ better coverage of peaks      |
| `long_jump_p`  | —      | Per-bit flip probability in long-jump strategy | $[0.05, 0.5]$      | `0.2`      | More exploratory but noisier                |
| `seed`         | —      | RNG seed                                       | any int            | `42`       | —                                           |

## 4. Key results

1. **Local peaks proliferate with K.** At $K = 0$ there is a single global peak (Mount Fuji). At $K = N-1$ the number of local peaks is exponential in $N$ (maximally rugged / random landscape).
2. **Local search fails on rugged landscapes.** Pure hill climbing plateaus far below the global max once $K \gtrsim N/4$.
3. **Restart + long jumps beat pure hill climbing** on rugged landscapes with a fixed budget. Exploration is a genuine free lunch on rugged terrain.
4. **Smooth landscapes reward greed.** For low $K$, hill climbing is optimal and long jumps waste evaluations.

### Dancing landscapes (co-evolution / NKC)

The classic NK model is *static*: the landscape is fixed once seeded. In reality, other players' choices change your landscape — competing firms retune features, prey species evolve, regulators change rules. Kauffman's extension is the **NKC** or *dancing-landscape* model: each of $C$ co-evolving entities has its own NK landscape whose fitness values depend on the current bit-strings of the others. Peaks then *move* under you as neighbours act, and strategies that look great one step can be obsolete the next. This is the formal version of the intuition Page uses for firm strategy (Southwest Airlines' bundle of practices) and species co-evolution — and it's why cost cutting alone rarely delivers a lasting competitive edge on an interdependent terrain.

## 5. What to try

- **Recipe A — Smooth vs rugged.** Fix `N = 12`, `budget = 500`. Compare `K = 0` vs `K = 8`. _Expected: at K = 0, all strategies find the same global max; at K = 8, hill climbing lags restart + long-jump by 10–20 %._
- **Recipe B — Ruggedness sweep.** Fix `N = 10`, `budget = 300`. Try `K ∈ {0, 2, 4, 6, 9}`. _Expected: hill climbing performance degrades monotonically with K._
- **Recipe C — Explore vs exploit.** Fix `N = 14, K = 5`. Vary `long_jump_p` from 0.05 → 0.5. _Expected: an interior sweet spot; too little jumping = stuck, too much = random search._
- **Recipe D — Budget matters.** Fix `N = 12, K = 4`. Compare `budget = 100` vs `budget = 2000`. _Expected: with a small budget, greedy wins; with a large budget, exploration pulls ahead._

## 6. Limits and pitfalls

- **The fitness function is random.** Each seed generates a new landscape; single-seed conclusions don't generalise. Always average over multiple seeds.
- **Binary variables only.** Real decisions are usually continuous or categorical with many options; the qualitative lessons about ruggedness carry over but the numbers don't.
- **Uniform random neighbours.** Real interactions have structure (e.g. adjacency in a supply chain). Structured NK variants change quantitative results significantly.
- **No teams / no learning.** Page's Chapter 28 also discusses team search and combining strategies — this simulator implements the single-searcher baseline.

## 7. Connections

- **Ch 27 — Multi-armed bandits.** Both are exploration/exploitation problems. Bandits are 1-D (which arm), NK is high-D (which bit-string).
- **Ch 26 — Learning.** Reinforcement learning on an NK landscape is a natural extension — replace random restarts with policy gradients.
- **Ch 21 — Games.** In coevolutionary settings each firm's landscape shifts as competitors move, giving Kauffman's "dancing landscape" (NKC) model — see §4.
- **Ch 6 — Power laws.** Distribution of local-peak fitnesses often has heavy tails; the best solutions are extreme outliers.
- **Page, *The Difference* (2007).** Extends the NK argument to teams: on rugged landscapes, diverse groups find better solutions than homogeneous experts because they get stuck on *different* local peaks and share moves out.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 28.
- Wright, S. (1932). "The roles of mutation, inbreeding, crossbreeding, and selection in evolution." *Proc. 6th Int. Congress of Genetics*. — the original adaptive-landscape metaphor.
- Kauffman, S. & Levin, S. (1987). "Towards a general theory of adaptive walks on rugged landscapes." *Journal of Theoretical Biology*, 128(1), 11–45.
- Kauffman, S. A. (1993). *The Origins of Order*. Oxford University Press.
- Levinthal, D. A. (1997). "Adaptation on rugged landscapes." *Management Science*, 43(7), 934–950.
- Page, S. E. (2007). *The Difference*. Princeton — team diversity on rugged landscapes.

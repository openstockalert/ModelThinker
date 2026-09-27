# Ch 10 — Network models

**Tagline:** _Four canonical ways to wire a network, three signature consequences — path length, clustering, friendship paradox, and robustness — all driven by structure, not by the individuals inside._

**REDCAPE:** Explain · Predict · Communicate · Explore

---

## 1. Intuition

A network is a set of things (nodes) plus a set of relationships (edges). What Chapter 10 argues is that many outcomes we care about — how fast a rumour spreads, how resilient the power grid is, whether the internet routes around damage — depend on **the shape of the wiring**, not on the people or devices attached to it. Two networks with identical actors but different topologies produce very different histories.

The chapter's core toolkit is a small zoo of network-formation models, each of which produces graphs with a characteristic "flavour":

- **Erdős–Rényi** (ER) — the null hypothesis of network science. Every pair of nodes coin-flips whether they're connected. Degree distribution is Poisson-ish. No structure to speak of.
- **Watts–Strogatz** (WS) — the *small-world* model. Start with a clustered ring lattice; rewire a handful of edges at random. Result: short average paths (like ER) *and* high clustering (like the lattice). This is what real friendship networks look like.
- **Barabási–Albert** (BA) — the *scale-free* model. Grow the network one node at a time; new nodes attach preferentially to already-popular nodes. Result: a heavy-tailed (power-law) degree distribution — a few enormous hubs and a long tail of tiny nodes. This is what the internet, citation networks, and Twitter follower graphs look like.
- **Random geometric** (RGG) — place nodes in space, connect any pair within a distance $r$. Naturally cluster-y, no hubs. This is what Wi-Fi meshes and neighbourhood contact networks look like.

Once you can build these, three signature results fall out for free: the friendship paradox, distinctive degree distributions, and dramatic differences in robustness under attack.

## 2. The model

### Structural measures

For any graph $G = (V, E)$ with $n = |V|$ nodes and $m = |E|$ edges:

$$
\text{mean degree} = \frac{2 m}{n}, \qquad \text{density} = \frac{2m}{n(n - 1)}
$$

Two more, computed over the largest connected component to be well-defined:

$$
\bar L = \frac{1}{n_{\text{LCC}} (n_{\text{LCC}} - 1)} \sum_{u \ne v} d(u, v), \qquad
C = \frac{1}{n} \sum_{v \in V} c_v
$$

where $d(u, v)$ is graph distance, $\bar L$ is the average shortest path length, and $c_v$ is the local clustering coefficient of node $v$ (fraction of $v$'s neighbours that are connected to each other).

### Friendship paradox

For each node $v$, let $d_v$ be its degree and $\bar d^{\text{nbr}}_v = \frac{1}{d_v} \sum_{u \in N(v)} d_u$ be the mean degree of its neighbours. Feld's (1991) result:

$$
\langle \bar d^{\text{nbr}} \rangle_v \ \ge\ \langle d \rangle_v
$$

with equality iff $G$ is regular. The reason is combinatorial: a high-degree node appears in many people's neighbour lists, so when you sample "friends," you oversample hubs.

### Robustness

Remove nodes one at a time and track the size of the **largest connected component** as a function of the removed fraction. Two attack strategies:

- **Random**: remove uniformly at random.
- **Targeted**: at each step, remove the current highest-degree node.

The critical removal fraction $f_c$ is defined as the smallest fraction at which the LCC drops below 50 % of the original network size.

## 3. Parameters

Per builder (all take a `seed` for reproducibility):

| Builder                | Parameters                       | Effect of increasing |
|------------------------|----------------------------------|----------------------|
| `build_erdos_renyi`    | $n$, $p$                         | More $p$ → denser, more connected, phase transition at $p = 1/n$ |
| `build_watts_strogatz` | $n$, $k$, $p$                    | More $k$ → more clustering; more $p$ → shorter paths |
| `build_barabasi_albert`| $n$, $m$                         | More $m$ → denser, larger hubs, flatter tail |
| `build_geographic`     | $n$, $r$ (radius)                | More $r$ → denser, more likely connected |

The `robustness_curve` function additionally takes `strategy ∈ {"random", "targeted"}` and `n_steps` (number of removal batches).

## 4. Key results

1. **The friendship paradox holds universally.** For any non-regular network, $\langle d^{\text{nbr}} \rangle \ge \langle d \rangle$. In scale-free networks the ratio can be 5× or more, and 70–90% of nodes are individually "beaten" by their friends.
2. **Watts-Strogatz is small-world for a *huge* range of $p$.** Even $p = 0.01$ collapses the average path length while clustering stays near the lattice value. This is why real social networks combine "everyone knows their neighbours" with "six degrees of separation."
3. **Barabási-Albert produces a power law.** The tail exponent is $\gamma \approx 3$ for standard preferential attachment. A tiny number of hubs dominate connectivity.
4. **Scale-free networks are robust *and* fragile.** Random removal barely dents connectivity: you can lose 80 % of nodes and still have a giant component, because random nodes are usually low-degree. But a hub-targeted attack destroys the LCC after removing just ~10 % — the hubs are also the joints. ER and RGG networks have almost no gap between random and targeted attack.
5. **Erdős-Rényi has a percolation threshold at $p = 1/(n-1)$.** Below it, only small clusters. Above it, a giant component emerges — the "birth of the giant" and one of the foundational results of network science.

## 5. What to try

- **Recipe A — see the small-world transition.** In the Zoo tab, pick Watts-Strogatz with $n = 200$, $k = 6$. Slide the rewiring $p$ from 0.0 to 0.01 to 0.1 to 1.0. Watch the average shortest path collapse from ~17 → ~7 → ~5 → ~3 while clustering stays high for a long time. The gap between "path length drops" and "clustering drops" is the small-world regime.
- **Recipe B — feel the friendship paradox.** In the Friendship-paradox tab, pick Barabási-Albert with $n = 300$, $m = 2$. You'll see something like ⟨$d$⟩ ≈ 4, ⟨$d^{\text{nbr}}$⟩ ≈ 20. **Five times the average.** Then switch to Watts-Strogatz: the paradox weakens because WS is nearly regular.
- **Recipe C — robustness of the internet.** In the Robustness tab, pick BA with $m = 2$. Random failure curve stays high until you've removed ~80 % of nodes. Targeted attack curve collapses after ~10 %. That gap is why the internet works despite hardware failures — and also why routing infrastructure is a natural target.
- **Recipe D — the ER phase transition.** In the Zoo tab, pick Erdős-Rényi with $n = 200$. Slide $p$ across $1/n = 0.005$. Below it, LCC is small; above it, it grows fast. That's the birth of the giant component.

## 6. Limits and pitfalls

- **Real networks aren't pure specimens.** No real friendship network is a clean BA graph. Real networks blend spatial constraints, homophily, community structure, and attachment history. The four models here are *stylised* generators — useful for building intuition, less useful as literal descriptive models.
- **Preferential attachment isn't the only route to power laws.** Ch 6 catalogues three: preferential attachment, self-organised criticality, and random return times. The BA generator gives one specific tail exponent ($\gamma = 3$); observed power laws show a range.
- **The friendship paradox is a statement about *averages*, not everyone.** In extreme scale-free networks, the hubs themselves are exceptions — they have more friends than most of their friends. The 70–90% "beaten" figure is not 100%.
- **Robustness under targeted attack assumes the attacker sees the topology.** In practice adversaries have incomplete information. The literature has extensions ("worm" strategies, cascading failures) that give more realistic pictures — this module ships the classical "remove the highest-degree node next" version.
- **All the small-world / robustness results assume undirected simple graphs.** Directed graphs (Twitter, the web) need in-degree vs out-degree treatment; multi-edge / multiplex graphs need extra machinery.

## 7. Connections

- **Ch 6 — Power laws.** The BA network is exactly the preferential-attachment story from Ch 6, viewed as a network rather than as a degree distribution. Same generator, different focus.
- **Ch 11 — Contagion / SIR.** Spreading dynamics on a network depend crucially on the *shape* of that network. Scale-free structure makes both real diseases and memes spread faster (through hubs) than any well-mixed compartmental model would predict.
- **Ch 12 — Entropy.** The degree distribution *is* a distribution — you can compute its Shannon entropy as a summary of network diversity. Scale-free networks have surprisingly low entropy because of the heavy tail.
- **Ch 15 — Schelling.** Segregation dynamics on non-grid networks (WS lattices with rewirings) segregate differently — the shortcuts matter.
- **Ch 22 — Cooperation.** Network reciprocity: cooperation persists better in clustered networks (WS) than in random ones (ER). Same players, different network → different equilibrium.

## 8. References

- Page, S. E. (2018). *The Model Thinker*, Ch. 10.
- Erdős, P., & Rényi, A. (1959). *On random graphs I.* Publicationes Mathematicae. — original ER paper.
- Watts, D. J., & Strogatz, S. H. (1998). *Collective dynamics of "small-world" networks.* Nature 393, 440–442.
- Barabási, A.-L., & Albert, R. (1999). *Emergence of scaling in random networks.* Science 286, 509–512.
- Feld, S. L. (1991). *Why your friends have more friends than you do.* American Journal of Sociology 96, 1464–1477.
- Albert, R., Jeong, H., & Barabási, A.-L. (2000). *Error and attack tolerance of complex networks.* Nature 406, 378–382. — original robustness paper.
- Milgram, S. (1967). *The small-world problem.* Psychology Today. — the 6-degrees experiment.
- Christakis, N. A., & Fowler, J. H. (2010). *Social network sensors for early detection of contagious outbreaks.* PLoS ONE 5(9): e12948. — the friends-of-friends flu detection.

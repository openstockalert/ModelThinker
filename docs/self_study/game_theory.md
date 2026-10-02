Here's the deep dive. All numbers are from computations I just ran.

## Why three flavours

The three sections of the chapter aren't three topics — they're the same idea under three different **timing structures**, and each one has its own solution concept and its own characteristic surprise:

| | Who chooses what | Solved by | Characteristic surprise |
|---|---|---|---|
| **Normal form** | Everyone picks an action at once, from a short list | Nash equilibrium, often mixed | Your own optimal mix is set by *the other player's* payoffs |
| **Sequential** | Players move in turn, seeing what came before | Backward induction | Threats you'd want to carry out aren't credible; commitment is worth money |
| **Continuous** | Everyone picks a *level* — price, effort, troops | Calculus / best-response functions | Competition burns almost the entire prize |

---

# Part 1. Normal-form games

## The machinery

A payoff matrix, one entry per combination of choices. Three tools in order of strength:

- **Dominance:** a strategy that's worse no matter what the other does. Delete it. Then look again — *iterated* dominance sometimes solves the whole game.
- **Best response:** what's optimal given a belief about the other.
- **Nash equilibrium:** everyone is best-responding to everyone. Nobody regrets their choice *given* the others'. Nash's 1950 theorem: every finite game has at least one, if you allow **mixed** (randomized) strategies.

The standard 2×2 zoo, which covers an enormous amount of real life:

| Game | Structure | Where you meet it |
|---|---|---|
| Prisoner's dilemma | Defection dominates, both worse off | Price wars, arms races, doping (Ch. 22) |
| Pure coordination | Multiple equilibria, equally good | Driving side, file formats, meeting spot |
| Battle of the sexes | Multiple equilibria, each favours one side | Standards wars, scheduling, merger integration |
| Chicken / hawk-dove | Two asymmetric equilibria, worst outcome if both push | Brinkmanship, strikes, lane merges |
| Matching pennies | No pure equilibrium, must randomize | Penalties, audits, bluffing, cyber defence |

## The genuinely surprising structural fact

In a mixed equilibrium, you randomize so that *the opponent* has no reason to favour either of their options. Which means: **your equilibrium mix is pinned down by your opponent's payoffs, not your own.**

I took a battle-of-the-sexes game and multiplied the **row player's** payoff in one cell by ten:

| | Row plays A | Column plays A |
|---|---|---|
| Original | 67% | 33% |
| Row's payoff for (A,A) ×10 | **67%** | **5%** |

Row's own behaviour didn't budge. The column player's did, dramatically. Caring ten times as much about an outcome changes *the other side's* behaviour, not yours.

This has a sharp practical reading: in strategic settings, **the returns to changing your own payoffs show up in your opponent's conduct.** Buying better capability doesn't mainly change how often you use it; it changes how often they defend against it.

## Penalty kicks: improving a shot can mean taking it less often

Zero-sum, two choices each, and real data exists. Here are three versions of a kicker's scoring probabilities:

| Version | Shoots left | Keeper dives left | Scoring rate |
|---|---|---|---|
| Baseline | 47.8% | 56.5% | 0.561 |
| His left shot gets better **when the keeper guesses wrong** (.90 → .98) | **44.7%** | 59.3% | 0.576 |
| His left shot gets better **when the keeper guesses right** (.30 → .50) | **57.9%** | 68.4% | 0.626 |

In the middle row he got better at shooting left and now shoots left **less often** — because the keeper dives left more, and he rebalances to keep the keeper honest. Scoring improves either way, but the direction of his *behaviour* change depends on which cell improved. Any intuition of the form "I got better at X, so I'll do more X" is unreliable once someone is responding to you.

Worth knowing: Ignacio Palacios-Huerta studied thousands of real professional penalties and found kickers and keepers mix at close to the equilibrium rates, with no serial correlation — one of the cleanest field confirmations of mixed-strategy theory anywhere. Elite competitors under pressure do solve this.

## Where Nash stops being a prediction

Three honest limits:

1. **Multiplicity.** Coordination games have several equilibria and the theory doesn't pick one. Schelling's **focal points** fill the gap with shared context — meet "at the clock," drive on the side everyone else does. The model tells you coordination matters, not which convention wins. For that you need Ch. 14's path dependence.
2. **Equilibrium ≠ good.** The prisoner's dilemma's unique equilibrium is the bad outcome. Nash describes stability, not desirability.
3. **Equilibrium ≠ what people do.** It assumes everyone knows the payoffs, knows everyone is rational, and knows that everyone knows. Fine for currency traders, shaky for a novel one-shot situation.

**Market entry** (Page's example) sits nicely between pure theory and practice: a market supports three firms, several consider entering, and the equilibrium involves randomization or asymmetric entry. Lab experiments show aggregate entry lands remarkably close to capacity, even though no individual can explain why — the same flavour of result as El Farol in Ch. 19.

---

# Part 2. Sequential games

## Backward induction

Draw the tree, start at the end, work backwards: at each node assume the player there will do whatever's best for them, replace that node with its outcome, repeat. The result is a **subgame-perfect equilibrium**, which rules out plans that rely on doing something irrational later.

The main contribution is the idea of a **credible threat.** An incumbent says "enter my market and I'll start a price war." Work the tree backwards: once entry has happened, a price war hurts the incumbent too, so it won't fight. The threat is empty and the entrant should enter.

The fix isn't a louder threat — it's **changing the tree so the bad response becomes your best one**:

- Build excess capacity so cutting price is actually profitable once entry occurs
- Sign a most-favoured-customer clause that makes undercutting costly to break
- Decentralize the decision to someone with no discretion
- Cortés burning his ships; Odysseus bound to the mast; the doomsday machine in *Dr. Strangelove*

**Commitment is the deliberate destruction of your own options, and it's valuable precisely because it's irreversible.** That inverts the ordinary intuition that flexibility is good.

## What moving first is worth

Same market, same costs (demand P = 100 − Q, cost 20), only the timing changes:

| | Output | Profit |
|---|---|---|
| **Simultaneous** (Cournot) | 26.7 each | 711 each — industry 1,422 |
| **Sequential** (Stackelberg) | Leader 40, follower 20 | Leader **800**, follower **400** — industry 1,200 |

The leader gains 12.5%, the follower loses 44%, and the industry as a whole loses 16%. Two lessons:

- The first-mover advantage is **entirely a commitment effect**. If the leader could quietly revise output after seeing the follower, it would — and the advantage vanishes. The gain comes from the quantity being *visible and irreversible*.
- Moving first helps you and **shrinks the pie**. Being able to commit isn't socially valuable here; it just reallocates.

And moving first isn't always better. Second movers win when there's information to learn (fast-follower pharma, copying a proven product category) or when positioning after seeing your rival's choice is decisive (Ch. 20's spatial model).

## The centipede game: where backward induction gets uncomfortable

A pot that doubles each round. Whoever takes it gets 80%, the other 20%. Six rounds, then it splits evenly:

| Round | Pot | Taker gets | Other gets |
|---|---|---|---|
| 1 | 4 | 3.2 | 0.8 |
| 2 | 8 | 6.4 | 1.6 |
| 3 | 16 | 12.8 | 3.2 |
| 4 | 32 | 25.6 | 6.4 |
| 5 | 64 | 51.2 | 12.8 |
| 6 | 128 | 102.4 | 25.6 |
| pass | 256 | 128 each | |

Backward induction: at the last node the player takes, so at the second-to-last the other takes, and it unravels all the way. **Player 1 takes immediately, for 3.2 and 0.8 — destroying 98% of the available value.**

Real people don't do this; they pass for several rounds. Likewise, ultimatum-game responders reject unfair offers rather than take free money. Two different readings, both useful:

- **Behavioural:** payoffs aren't just cash. Fairness and spite are real (Ch. 4).
- **Strategic:** the unravelling needs *certainty* about the other's rationality. A sliver of doubt — maybe they're a cooperative type — makes passing rational for a while, and makes *imitating* a cooperative type rational too. That's the reputation logic behind Ch. 22's cooperation results.

The practical conclusion matches Ch. 13's: backward induction is a superb **reasoning** tool (it exposes which threats are hollow and where commitment pays) and a poor **predictor** once the chain of inference gets more than two or three steps long. Experimental work on levels of reasoning finds most people do one or two.

---

# Part 3. Continuous-action games

Now the choice is a dial, not a button, which means calculus, unique interior equilibria, and clean comparative statics.

## Competition at the margin

- **Cournot** (choose quantity): a few firms, positive profits, output above monopoly level.
- **Bertrand** (choose price): two firms with identical costs, and price collapses to marginal cost with **zero** profit. Two competitors is enough for the full competitive outcome — which is why the price-versus-quantity modelling choice is not a technicality. It's the formal version of "race to the bottom."

## Contests: the prize gets burned

The standard contest model: your chance of winning is your effort over total effort. Prize = 100.

| Contestants | Effort each | Total effort | Share of prize dissipated |
|---|---|---|---|
| 2 | 25.0 | 50 | 50% |
| 3 | 22.2 | 67 | 67% |
| 5 | 16.0 | 80 | 80% |
| 10 | 9.0 | 90 | 90% |
| 20 | 4.8 | 95 | **95%** |
| 50 | 2.0 | 98 | **98%** |

(I verified the n = 5 case by iterating best responses: 16.00 each, matching the formula.)

Each individual spends *less* as the field grows, but total spending approaches the entire value of the prize. In the **all-pay auction** version — highest bid wins, everyone pays their bid — the expected total spending equals the whole prize exactly.

This is the formal content of "rent dissipation," and it's everywhere:

- Lobbying for a government contract
- Patent races where only the first to file wins
- Litigation spending
- Internal promotion tournaments
- College admissions arms races and test prep
- Military spending between rivals

**The social loss isn't a side effect, it's the equilibrium.** And it points straight at Ch. 24: if you're the one *designing* the contest, you can reduce waste by limiting the field, capping effort, awarding multiple graded prizes instead of winner-take-all, or adding noise so that extra effort buys less advantage.

---

# Part 4. Colonel Blotto

## The game

Two commanders each split a fixed force across several fronts. Whoever sends more to a front wins it. Win more fronts and you win. Borel posed it in 1921; the name comes from RAND work in the 1950s.

Three features make it special: **fixed total resources**, **simultaneous allocation**, and **no credit for margin** — winning a front 100 to 0 counts the same as 34 to 33, so overkill is pure waste.

## No single plan is safe

With 100 troops over 3 fronts, I built 205 candidate allocations and solved the game exactly on that set:

| Fixed allocation | Beaten by this share of candidate allocations | Score vs. the equilibrium mix |
|---|---|---|
| Even split (34, 33, 33) | 32% | −0.003 |
| Two fronts (50, 50, 0) | 41% | 0.000 |
| All-in (100, 0, 0) | **93%** | **−0.94** |

And a genuine rock-paper-scissors cycle:

> **(34, 33, 33)** beats **(60, 20, 20)** beats **(50, 50, 0)** beats **(34, 33, 33)**

Check the middle one: 60 > 50 wins, 20 < 50 loses, 20 > 0 wins. Two fronts to one.

**Preferences over strategies are intransitive, so there is no "best" allocation** — only a best *way of being unpredictable*. The equilibrium I computed spread over 51 different allocations, with none used more than 5% of the time. (Roberson proved the continuous version: your allocation to each front should be uniformly distributed between zero and twice the fair share.)

The operational lesson is blunt: **in Blotto-like competition, predictability is the whole vulnerability.** A good plan that you always use is worse than a mediocre plan you randomize.

## The asymmetric case, and a correction worth making

Strong side 100 troops, weak side 70, both playing optimally:

| Fronts | Weak side wins the **majority** | Weak side's **share of fronts won** |
|---|---|---|
| 2 | **33.3%** | 33.3% |
| 3 | 12.0% | 34.1% |
| 5 | 8.2% | 35.2% |
| 7 | 9.6% | 36.0% |
| 9 | 8.0% | 36.2% |
| 11 | **5.8%** | **37.1%** |

You often hear "more fronts help the underdog." My numbers say that depends entirely on **what counts as winning**, and the two objectives pull in opposite directions:

- **If payoff is proportional** (seats, markets, medals, revenue), more fronts help the weak side — its share climbs from 33% toward its budget share of 41%. More fronts mean less waste from overkill and more chance to pick its spots.
- **If you need an outright majority**, more fronts *hurt* the weak side badly: 33% at two fronts down to 6% at eleven. Many fronts let the law of large numbers assert itself, and averages favour whoever has more.

So: **underdogs who need to win outright want few, lumpy, high-variance contests. Favourites want many.** That's why a weaker team prefers a single knockout game to a seven-game series, why an outmatched competitor opens a new dimension of competition rather than fighting on the established ones, and why incumbents prefer long, broad, averaging-out contests.

## Where Blotto shows up

- **Elections:** allocating campaign money and candidate time across states or districts — winner-take-all per state is literally Blotto
- **Advertising** across markets or product lines
- **Cyber defence:** a defender must cover every attack surface, an attacker needs one
- **Counterterrorism and infrastructure protection:** randomized patrol scheduling is deployed in real systems for exactly this reason
- **Hiring and admissions:** candidates allocate finite effort across criteria
- **R&D portfolios, litigation claims, sports lineups and matchups**

And one piece of tactical advice that falls straight out of the structure: **if you're the weaker side, choose your fronts and abandon the rest — then randomize which ones.** Spreading thin loses everywhere. The 100-troop all-in plan lost to 93% of allocations because it wasted 100 troops winning one front enormously; concentration only works paired with unpredictability.

---

# Part 5. What to take and what to distrust

**What game theory is genuinely good for** (in REDCAPE terms): *Reason* — it exposes which threats are hollow, where commitment pays, and when randomizing is mandatory. *Design* — it's the foundation of Ch. 24. *Explain* — it accounts for arms races, price wars and wasteful contests as equilibria rather than mistakes.

**Where to be careful:**

- **Payoffs are the hard part.** The matrix is 90% of the modelling, and it's usually guessed. Small changes in payoffs flip equilibria, so sensitivity-check rather than presenting one solution.
- **Common knowledge is a strong assumption.** It drives the centipede result, which fails in practice.
- **Multiplicity has no agreed solution.** The theory won't tell you which equilibrium.
- **Learning doesn't reliably reach Nash.** Ch. 26's result that learners can converge to a spiteful, inefficient outcome is a direct warning.
- **What does "mixing" mean?** Either deliberate randomization (penalties, audits, patrols) or a population frequency (what share of firms behave aggressively). Those are different claims about the world and shouldn't be conflated.

**A checklist for using the chapter on a real situation:**

1. Who moves when, and who can see what before choosing? (Changing this is usually the biggest available lever.)
2. Which of my threats and promises survive backward induction — and what would make the others credible?
3. Is the pie fixed? If yes, expect mixing and secrecy. If not, look for the cooperative equilibrium.
4. Am I in a contest where effort is dissipated? Can I avoid entering, or redesign it?
5. Is this Blotto? If so, am I predictable, and am I wasting strength on fronts I'm already winning?
6. Can I change the game instead of playing it better? That question is Ch. 24, and it's usually where the real returns are.

**If you implement it:** 2×2 Nash via support enumeration is a short exercise; zero-sum games of any size are a linear program (the Blotto results above came from `linprog` on a sampled strategy set); backward induction is a recursion over a tree. One caveat on my Blotto numbers — sampling a finite set of allocations gives an *approximation*; the true equilibrium is a continuous distribution, and sparse sampling systematically understates how well a player can do. Worth knowing before you quote them.


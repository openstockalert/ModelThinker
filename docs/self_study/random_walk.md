I ran simulations while writing this, so the numbers below are from actual runs (200,000 walks in 1D, 20,000 each in 2D/3D/4D).

## The setup

Stand on a number line at 0. Flip a coin: heads step right, tails step left. Repeat forever. That's the 1-D random walk. Two things about it are strange, and they're strange in *opposite directions*.

## Fact 1: You will certainly come back to zero

The walk has no drift — you're equally likely to go either way — so it has no reason to escape. But "no reason to escape" isn't a proof. Here's the cleaner way to see it.

After *t* steps, the walk is typically about **√t** away from home. That's the key number. So the walk does drift away, but slowly: after 10,000 steps you're typically only ~100 units out.

Now ask: **how much time does the walk spend sitting on zero?** At any given even time, the chance of being exactly at 0 is roughly 1/√t. Add that up over all times:

1/√1 + 1/√2 + 1/√3 + … → **infinite**

The expected number of visits to zero is infinite. But if there were any chance *p > 0* of never coming back, the walk would only ever make about 1/(1−p) visits — a finite number. An infinite expected number of visits is only possible if the escape probability is exactly zero. So return is certain — and since the same logic applies after each return, the walk returns **infinitely many times**. It also visits every other integer infinitely often.

## Fact 2: But the average time to come back is infinite

Here's the part that feels contradictory. From my simulation of 200,000 walks:

| | |
|---|---|
| Returned within 20,000 steps | 99.5% |
| Returned on step 2 | 50.0% |
| Median return time | **2 steps** |
| 90th percentile | 58 steps |
| 99th percentile | 2,586 steps |
| Longest observed | 19,964 steps |

Half of all walks return immediately — right-then-left, or left-then-right. That's about as fast as possible. Yet the *average* is infinite.

The reason is the tail. The probability that you *haven't* returned by time *t* falls off like **1/√t**:

- Still out after 100 steps: 8.0% (theory: 7.98%)
- Still out after 10,000 steps: 0.77% (theory: 0.80%)

That decay is slow enough to be lethal to the average. An average is the sum of (outcome × probability). Rare outcomes of size *t* carry probability about 1/t^1.5 each, and t × t^(−1.5) = 1/√t — and adding up 1/√t forever diverges. **The tail is so fat that the rare marathon excursions outweigh everything else, no matter how many quick returns you pile up.**

Two other ways to feel it:

**The self-similarity argument.** Suppose the walk hasn't returned after *t* steps. Then it's typically √t away from zero. How long does it take a random walk to cross a distance of √t? About *t* steps. So conditional on having waited *t*, your expected remaining wait is *another t*. The clock keeps resetting to "however long you've already waited." There is no natural time scale at all.

**The counting argument.** In *t* steps, the walk visits zero about √t times. So visits per unit time ≈ 1/√t, which goes to zero. The average gap between visits therefore grows without bound. A finite expected return time would mean the walk visits zero at a steady positive rate forever — and it doesn't.

**The honest summary:** "certain to happen" and "expected to happen soon" are unrelated properties. The event is guaranteed; the waiting time has no meaningful average. Quoting the mean here is a category error, like quoting the average of a distribution that has none. The median (2 steps) is the number that describes a typical walk.

This has a very practical edge. A gambler on a fair bet is *certain* to return to break-even — that is a true theorem. But he has finite money and a finite life, and the time to get back has infinite expectation. With any wealth limit, the classic result is **gambler's ruin**: against an infinitely rich casino, you go broke with probability 1. "It'll come back eventually" is mathematically true and financially useless.

## The dimensions: Pólya's theorem

Now do the same thing on a grid in *d* dimensions: each step, pick an axis at random and move ±1.

Use the same counting logic. After *t* steps the walk is ~√t from home in any dimension, but the *space* within that radius contains about (√t)^d = t^(d/2) sites. The walk has *t* time units to spread over t^(d/2) places, so the time spent at any one site scales like:

**t / t^(d/2) = t^(1 − d/2)**

- **d = 1:** grows like √t → infinite visits → **recurrent**
- **d = 2:** the exponent is 0, so it grows like **log t** — barely infinite → **recurrent**
- **d = 3:** shrinks like 1/√t, and the sum converges → finite visits → **transient**

This is **Pólya's theorem** (1921). Kakutani's summary: *"A drunk man will find his way home, but a drunk bird may get lost forever."*

My simulations:

| Dimension | Returned to start | True limit |
|---|---|---|
| 1-D | 99.5% (within 20k steps) | 1.0 |
| 2-D | 76.8% (within 50k steps) | 1.0, but very slowly |
| 3-D | 33.4% (within 20k steps) | ≈ 0.3405 |
| 4-D | 19.1% (within 20k steps) | ≈ 0.193 |

Two things to notice.

**2-D is recurrent but only technically.** Return is certain, yet the probability of *not* having returned by time *t* decays like 1/log t — the slowest decay in mathematics. My 50,000-step run only got to 77%. To reach 99% you'd need a number of steps with a huge number of digits. So in 2-D, "certain return" is a statement about eternity, not about any run you could ever observe.

**3-D genuinely escapes.** A 3-D walker has about a 34% chance of ever coming home and a 66% chance of drifting away forever. On average it visits the origin only about 1.5 times total. Add a fourth dimension and it's 19%. Space simply has too much room.

## Why this matters outside the toy

- **Markets (the book's main use).** If prices already reflect known information, price changes are unpredictable — a random walk. Then a fund's five-year hot streak is what random walks *produce*, not evidence of skill. Random walks generate long runs and impressive-looking trends with no cause behind them.
- **Streaks in sports and business.** Win streaks, sales streaks, "momentum" — much of it matches what a coin-flip process generates. A related oddity (the **arcsine law**): in a fair contest, the *most likely* split of time-in-the-lead is not 50/50, it's one side leading almost the whole way. Lead changes are rarer than intuition says, so "dominance" is the default look of a tie.
- **Firm and species lifetimes.** Model a firm's size as a random walk that dies at zero. The return/hitting times follow a power law — which is exactly how real firm lifetimes and species durations are distributed. This is the bridge back to Chapter 6's long tails.
- **Chemistry and biology.** 3-D transience is why a molecule diffusing in water rarely revisits the same spot, while something diffusing on a 2-D membrane sweeps its neighborhood thoroughly. Confining a search to a surface makes finding a target far more reliable.

**One caveat on the model.** All of this needs three assumptions: no drift, independent steps, and finite step size. Add a tiny drift and the walk becomes transient in *any* dimension. Allow occasional huge jumps (a Lévy flight) and the geometry changes again. The book's lesson holds — a lot of what looks like trend, skill, or momentum is what a directionless process looks like from inside.


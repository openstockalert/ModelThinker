Here's the deep dive. I ran simulations for all the numbers below.

## The core idea: the sign of the feedback decides everything

Both halves of the chapter have the same structure — *I look at what others are doing, then decide* — but flipping the sign of the feedback flips every conclusion:

| | Positive feedback (riots) | Negative feedback (El Farol) |
|---|---|---|
| Rule | Join if **many** others act | Act if **few** others act |
| Dynamics | Runs away from the middle | Returns to the middle |
| Outcomes | All-or-nothing, bimodal | Hovers near the threshold |
| Where the variance shows up | **Across cases** — two similar crowds, opposite outcomes | **Over time** — the same crowd, different every week |
| Predictable? | Outcome unpredictable, but you can name the cause afterward | Average is predictable, any given week is not |

---

# 19.1 Granovetter's threshold model

## The mechanics

Each person *i* has a threshold *Tᵢ*: "I'll join once at least *Tᵢ* other people have." Thresholds differ — a hothead's is 0, a cautious person's is 40, a saint's is 100.

The dynamics are pure bookkeeping. Sort everyone by threshold. Start with the zero-threshold people acting. Count them. Anyone whose threshold is now met joins. Recount. Repeat until nothing changes.

Formally: if *F(x)* is the number of people with threshold ≤ *x*, the process is *x* → *F(x)*, and it stops at the first **fixed point** where *F(x) = x*. Graphically, draw the cumulative threshold curve and the 45° line: the cascade climbs until the curve first drops below the line, and stops there. **Everything hinges on where the cumulative curve crosses the diagonal** — not on the average.

## The canonical pair (verified in simulation)

**Crowd A:** 100 people with thresholds 0, 1, 2, 3, … 99.
One radical starts. Now one person has acted, so the person with threshold 1 joins. Now two have acted, so threshold-2 joins. Every rung of the ladder is present. **Result: all 100 riot.**

**Crowd B:** identical, except the person with threshold 1 now has threshold 2. So the thresholds are 0, 2, 2, 3, 4, … 99.
The radical acts. Nobody has threshold 1, so nobody joins. The two people with threshold 2 are waiting for a second actor who never appears. **Result: 1 person "riots," alone.**

The average threshold moved from 49.50 to 49.51. Every summary statistic you would normally report is unchanged. The outcome went from total riot to nothing.

**The plain-English reason:** a cascade is a **ladder**, and it needs every rung. One missing rung and the climb stops dead — no matter how many rungs exist above it. This is why averages are useless here. The question is never "how militant is this crowd on average?" It's "is there an unbroken chain of people each willing to be the next one in?"

## Variance matters more than the mean

I held the average threshold fixed at 25 (out of 100 people) and varied only the spread, running 4,000 crowds at each setting:

| Spread (SD) | Average number who join | Full riot (>90) | Fizzle (<10) |
|---|---|---|---|
| 2 | 0.0 | 0% | 100% |
| 5 | 0.0 | 0% | 100% |
| 10 | 1.6 | 0.7% | 99.2% |
| 15 | **85.7** | **85%** | 14% |
| 20 | 99.8 | 99.8% | 0.2% |
| 25 | 99.8 | 100% | 0% |
| 40 | 96.0 | 97% | 0% |
| 60 | 82.6 | 10% | 0% |
| 100 | 65.4 | 0% | 0% |

Two different failure modes bracket the cascade, for opposite reasons:

- **Too little variance** (SD 2–10): everyone is waiting for roughly 25 others, and nobody is willing to be first. Homogeneous crowds are *safe* crowds. No ladder has a bottom rung.
- **Too much variance** (SD 60+): plenty of instigators, so something always starts — but the crowd also contains many extremely stubborn people, so the ladder has gaps near the top. The riot starts and stalls halfway. Note that SD 60 has the *highest* rate of "partial" outcomes (90% of runs land between 20 and 90 joiners).

The window where full cascades happen is a **middle band of diversity.** Page's general point, that diversity changes outcomes qualitatively, shows up here as: you need enough spread to get started and not so much that you stall.

## Outcomes are bimodal, not average

At SD 15 — right in the transition — here's the distribution of 4,000 outcomes:

| Number who joined | Share of runs |
|---|---|
| 0–9 | **13.6%** |
| 10–24 | 1.1% |
| 25–74 | **0.0%** |
| 75–89 | 0.0% |
| 90–100 | **85.3%** |

Almost nothing lands in the middle. The average outcome (85.7 people) is a number that essentially **never happens**. You get a riot or you get nothing, and two crowds drawn from the identical distribution can land on opposite sides.

This is the deepest practical lesson in the chapter: **in systems with positive feedback, the average outcome is not a typical outcome.** Planning around expected values is malpractice.

## Instigators are worth more than moderates

Starting from a crowd with mean 25, SD 10 (which never riots), I forced exactly **one** person's threshold to 0:

| | Average joiners | Full riot |
|---|---|---|
| No instigator | 0.0 | 0% |
| One instigator | 4.7 | 2.5% |

One person out of 100, changed from "needs 25 others" to "needs nobody," moved full riots from impossible to occasional. This is why authoritarian states arrest a handful of named organizers rather than trying to change anyone's mind, and why movements invest so much in the few people willing to go first at personal cost. The person who acts alone provides the first rung for free.

## Why riots are unexplainable in advance but obvious afterward

Thresholds are private. You cannot survey them honestly — asking "would you join a riot if 30 others did?" gets you a lie, especially where the answer is dangerous. **Timur Kuran's** term for this is *preference falsification*: people hide their real willingness, so the cumulative curve is invisible right up until the cascade reveals it.

This gives a satisfying account of a real puzzle: why nearly every revolution surprises everyone, including its participants and the regime's own intelligence services. East Germany in 1989 and Tunisia in 2010 looked stable because the thresholds were unobservable, not because they were high. Afterward, the "cause" is always available — a vendor's self-immolation, a stolen election, a video — and always insufficient, because similar sparks land in similar countries every month without igniting anything. **The spark gets the credit; the threshold distribution did the work.**

The honest model-thinker's conclusion: this model has strong *explanatory* and *reasoning* value and almost no *predictive* value. It tells you what kind of thing you're looking at, and it tells you that prediction is hopeless.

## Thresholds as fractions, and the network version

A refinement that matters a lot: real thresholds are usually about *fractions of the people you can see*, not counts of the whole population. "I'll join if a quarter of **my** friends have." Now the network structure matters, and you get a result that surprises most people.

I ran 1,000 people on random networks, everyone needing 18% of their own neighbours to act, starting from a **single** seed:

| Average number of friends | Mean cascade size | Global cascade rate |
|---|---|---|
| 1 | 17 | 2% |
| 2 | 500 | 68% |
| 3 | 727 | 92% |
| 4 | 600 | 92% |
| 6 | 16 | 0% |
| 8 | 2 | 0% |
| 20 | 1 | 0% |

There is a **cascade window** (Duncan Watts' result), and it has a ceiling as well as a floor:

- **Too sparse:** the fire can't jump between clusters; it burns out locally.
- **Too dense:** ironically, *harder*. With 20 friends you need 4 of them acting before you move, so no early actor can ever trigger anyone. Each connection dilutes the influence of the others.

So a well-connected population can be *more* stable against cascades than a loosely connected one. This also means the *identity of the seed* matters: seeding a hub is different from seeding a periphery node. It connects this chapter directly to Chapter 10 (networks) and Chapter 15 (local interactions).

## Two applications worth the detail

**Standing ovations** (Miller and Page's own model, and the reason this chapter is fun). The mechanics are threshold plus *visibility*: you have a private impression of the show, plus a rule like "I'll stand if enough people I can see are standing." Since you can mostly see the people **in front of you**, position matters enormously. Front-row standers trigger cascades; back-row standers trigger nothing. A few "celebrities" whom everyone watches can decide the outcome. The room's geometry changes the result even with identical audiences. Same logic applies to conference-room silence, citation patterns, and which papers get called important.

**Bank runs.** The threshold is on beliefs: "I'll withdraw if I think enough others will." A solvent bank has two self-consistent outcomes — everyone stays calm and the bank is fine, or everyone runs and the bank fails by the act of running. Nothing about the bank's balance sheet distinguishes them. The clever policy response doesn't try to raise thresholds through reassurance (which can backfire, since public reassurance is itself a signal). Deposit insurance **changes the payoffs so the threshold is never reached**: if your money is safe either way, you have no reason to join. That's why insurance works mostly without ever paying out. This is a genuine mechanism-design fix (Chapter 24) to a threshold problem, and it's the best illustration in the book of how combining two models gives you the lever.

A modern footnote past the book's 2018 publication: Silicon Valley Bank in 2023 showed what happens when the network becomes a group chat and withdrawal takes thirty seconds. Thresholds didn't change, but the *speed* of the cascade did, compressing what used to take days into hours.

---

# 19.2 Negative feedback: the El Farol bar problem

## The setup

100 people, one bar, capacity 60. Going is fun if fewer than 60 show up and miserable otherwise. Everyone decides independently each week, using only past attendance.

The crucial feature: **there is no rule everyone can use.** Any shared forecast destroys itself. If everyone concludes "it'll be quiet," 100 people go and it's packed. If everyone concludes "it'll be packed," nobody goes and it's empty. This is not a coordination failure you can fix by thinking harder — the problem is *logically* closed to a common solution. Brian Arthur's point in designing it was that this is a domain where rational expectations cannot even be defined, so you *must* model people as using diverse rules of thumb (Chapter 4's rule-based actors).

## What the simulation shows

I gave each of 100 agents a small personal set of predictors ("last week's number," "average of the last four," "mirror it around 50," "assume 60," "extrapolate the trend"), and each week each agent used whichever of their own predictors had been most accurate lately:

| Setup | Mean attendance | Std. dev. | Pattern |
|---|---|---|---|
| Everyone uses the same predictor | 50.0 | **50.0** | 100, 0, 100, 0, 100, 0 … |
| Everyone has diverse predictors | 53.9 | 18.9 | 71, 48, 56, 42, 56, 71, 68, 5, 29, 56 … |

The homogeneous case is a catastrophe — a perfect two-cycle where the bar is either jammed or deserted, and welfare is terrible. The diverse case self-organizes: attendance **hovers just under capacity** with no one intending it and no one able to forecast next week. Nobody is optimizing, no equilibrium in beliefs ever settles, yet the aggregate lands near the efficient level.

Two lessons worth separating:

1. **Negative feedback stabilizes the average and randomizes the individual case.** The opposite of the riot model, where the average is meaningless and the cases are extreme.
2. **Diversity of beliefs is what does the stabilizing.** Correlated beliefs produce oscillation. This is the same mechanism behind the Diversity Prediction Theorem in Chapter 3 and the flash-crash worry about everyone running the same trading model.

## Where you meet this

- **Traffic.** Everyone reroutes off the jammed highway, so the side streets jam. Navigation apps are interesting here precisely because they *reduce* diversity of belief — they give everyone the same forecast, which is the El Farol failure mode. This is also where Braess's paradox lives: adding a road can make everyone slower.
- **Gyms in January, restaurants, supermarket lanes, beaches on a hot day, popular hiking trails.** All self-limiting and all unpredictable week to week.
- **Drought and water conservation.** Here the feedback can flip sign: "I'll conserve because others are" (positive, normative) versus "I don't need to conserve because others are" (negative, free-riding). Which sign dominates is an empirical question and decides whether appeals work at all.
- **Delayed negative feedback** deserves its own warning. If the information you react to is stale — hog and cattle cycles, semiconductor fabs, real-estate construction, nursing-school enrolments — negative feedback stops stabilizing and starts *oscillating*, sometimes violently. Everyone builds capacity at the same time based on last year's shortage, and produces next year's glut. That's Chapter 18's systems-dynamics point arriving in threshold clothing.

## Fashion: both signs at once

The most interesting real cases have both feedbacks operating on different groups or timescales. A style spreads by positive feedback (I want what others have) and then dies by negative feedback (I don't want what *everyone* has — the snob effect). The result is neither a cascade nor a stable level but perpetual churn: adoption, saturation, abandonment, repeat. Two feedbacks of opposite sign and different delay is the general recipe for a cycle.

---

# 19.3 Tipping points

Page is unusually careful here, because "tipping point" is the most abused term in popular social science.

**A tipping point is a property of a model, not of the world.** It means: a small change in a variable produces a large, qualitative change in the outcome. To claim one exists you have to say which model and which variable, or you're just saying "something big happened."

**Direct tip.** A change in the *state* of the system pushes it over a threshold. One more person joining the riot triggers the cascade. R₀ crossing 1 in the SIR model — below 1 the outbreak dies, above 1 it explodes (Chapter 11). A bank's reserve position crossing the level where a run becomes self-fulfilling.

**Contextual tip.** The environment or structure changes, so the *same* action now has different consequences. Nothing about anyone's behaviour changed; the rules of the game did. Examples:
- Adding links to a network until it crosses the percolation point, at which point an idea that used to die locally can now cross the whole graph. My cascade-window table above is a contextual tip in both directions.
- A drug becoming cheap enough, or a prescription norm loosening, so that the same doctor's behaviour now feeds an epidemic (Chapter 29's opioid case).
- Social media making withdrawal instant, which tipped bank runs from days to hours.

**Measuring tips.** Page suggests using a diversity or entropy measure of the *outcome distribution* rather than eyeballing the curve. Before the tip, the outcome is nearly certain (low entropy); at the tip, it's maximally uncertain (my SD-15 case: 85/14 split between total riot and nothing, and no middle); after, it's certain again in the other direction. A genuine tipping point shows up as a **spike in outcome uncertainty**, which is a testable signature.

**Two traps the distinction fixes:**

1. **Confusing tips with path dependence.** Path dependence (Chapter 14) is small events *accumulating* to lock in an outcome. A tip is a single moment that flips it. QWERTY was path dependence. R₀ crossing 1 is a tip. People routinely call the first the second.
2. **Chasing the spark instead of the structure.** If the system is near a tip, *something* will tip it, and which something is an accident. Policy that removes the spark accomplishes nothing while the structure holds. Policy that moves the system away from the threshold — deposit insurance, vaccination past the herd-immunity level, breaking up the ladder of thresholds — works regardless of sparks.

---

# Using this model in practice

**What to actually look for**, since you can't measure thresholds directly:
- Is the feedback positive or negative? That single question predicts whether you should worry about bimodal outcomes or about oscillation.
- Are there instigators — people or actors with threshold near zero? How many?
- Is the threshold distribution *continuous*, or does it have gaps? Gaps are safety; continuity is danger.
- Is the threshold about counts or about fractions of neighbours? If fractions, the network is part of the model, and density cuts both ways.
- Is the feedback delayed? Delay turns stabilizers into oscillators.

**Levers, in rough order of effectiveness:** change the payoffs so the threshold is never reached (deposit insurance); raise thresholds at the specific rung where the ladder is thin; remove or deter instigators; reduce visibility so people can't observe each other (the standing-ovation lever); and — for negative-feedback systems — *preserve* diversity of beliefs rather than giving everyone the same forecast.

**If you're implementing it:** the count-based cascade is about ten lines (sort thresholds, iterate the fixed point). The three experiments that teach the most are the ones above: the variance sweep at fixed mean, the bimodality histogram, and the network cascade window. All three run in seconds.

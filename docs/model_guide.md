# The Model Thinker: A Chapter-by-Chapter Guide to the Models

*Companion notes to Scott E. Page, **The Model Thinker** (Basic Books, 2018)*

**How to read this guide.** Each model has five parts:

- **Idea:** what the model is
- **Mechanics:** its assumptions and formulas
- **Key results:** what it shows
- **Applications:** real-world examples
- **Build it:** a sketch of how to implement it

Examples tagged **[Book]** are ones Page uses or discusses in the text, to the best of my recollection. Untagged examples are standard applications of the model. I wrote this without the book open, so check tags and details against your copy before quoting them.

---

## Part I: The Framework (Chapters 1–4)

### Ch. 1–2. The Many-Model Thinker and Why Model?

**Idea.** A model is a formal simplification: it has assumptions, variables and logic that can be checked. Page argues that any single model is wrong in some way, and that a *set* of diverse models gives you **wisdom**.

**Mechanics.**
- **Wisdom hierarchy:** Data → Information → Knowledge → Wisdom. Models turn information into knowledge. Choosing and combining models is wisdom.
- **Three types of model:**
  - *Embodiment*: a simplified copy of reality, such as a map or a model of the solar system
  - *Analogy*: "X behaves like Y," such as treating a disease outbreak like a forest fire
  - *Alternative reality*: a thought experiment, such as a world with no transaction costs
- **REDCAPE:** the seven uses of models are Reason, Explain, Design, Communicate, Act, Predict and Explore.

**Applications.** [Book] Page frames the 2008 financial crisis as a failure of single-model thinking: risk models assumed independent mortgage defaults. Many-model thinking would have included network and contagion models showing correlated failures.

---

### Ch. 3. The Science of Many Models

#### 3.1 Condorcet Jury Theorem
**Idea.** A group of independent voters, each better than a coin flip, is more likely to be right than any one of them.
**Mechanics.** Each of *n* voters is correct with probability *p > ½*, independently. The probability that the majority is correct rises toward 1 as *n* grows.
**Key result.** Several independent, reasonably accurate models, combined by majority vote, beat any single one.
**Catch.** Independence is essential. Correlated models (same data, same assumptions) add little.
**Applications.** Juries, ensemble classifiers in machine learning, panels of experts.
**Build it.** Simulate *n* Bernoulli(*p*) voters, then plot the probability that the majority is correct against *n* for several values of *p*.

#### 3.2 Diversity Prediction Theorem
**Idea.** A crowd's error depends on both individual accuracy and diversity.
**Mechanics.**
`Crowd error = Average individual error − Prediction diversity`
Here Crowd error = (c − θ)², Avg error = (1/n)Σ(sᵢ − θ)², and Diversity = (1/n)Σ(sᵢ − c)². *c* is the crowd's mean prediction and θ is the truth.
**Key result.** This is an identity, not an approximation. Diversity counts as much as ability. The crowd is never worse than its average member.
**Applications.**
- [Book] The **Netflix Prize**: the winning team, *BellKor's Pragmatic Chaos*, combined hundreds of different models.
- Wisdom-of-crowds estimates such as guessing the weight of an ox.
- Economic forecasting surveys.
**Build it.** Generate model predictions, then check the identity numerically.

#### 3.3 Categorization Models (and the Many-Model Error Decomposition)
**Idea.** A model often works by sorting the world into categories ("boxes") and predicting one value per box. Different models use different boxes.
**Mechanics.** Total error splits into *categorization error* (variation inside a box that the model ignores) and *valuation error* (a wrong estimate for a box). Combining models with *different* categorizations reduces both.
**Applications.** Classifying loan applicants, grouping customers into segments, predicting school performance by district.

#### 3.4 Model Granularity
**Idea.** Models can describe an individual or a whole population. The level of detail you choose determines what the model can explain.
**Applications.** Individual health risk compared with population life-expectancy tables.

---

### Ch. 4. Modeling Human Actors

Page says people are hard to model for four reasons: they are *diverse*, *social*, *purposeful* and *adaptive*. He offers three ways to model them.

#### 4.1 Rational-Actor Model
**Idea.** People have preferences and choose the option that maximizes their payoff (utility), subject to constraints.
**Mechanics.** Maximize U(x) subject to a budget. In games, each actor best-responds to the others.
**Why use it.** It gives unique, testable predictions. It is a benchmark. People learn toward it in repeated, high-stakes settings.
**Applications.** [Book] Deciding how to divide income between housing and other goods. Firms setting prices.

#### 4.2 Behavioral Models
**Idea.** Build documented biases into the model.
**Main biases the book covers:**
- **Prospect theory / loss aversion** (Kahneman and Tversky): losses hurt about twice as much as equal gains feel good. People take risks to avoid losses and play safe with gains.
- **Hyperbolic discounting:** people overweight *now* compared with later. This explains procrastination, weak saving and failed diets.
- **Status-quo bias:** default options dominate choice. The classic case is opt-out retirement savings and organ donation.
- **Base-rate bias:** people ignore prior probabilities.
**Applications.** Retirement plan design (the "Save More Tomorrow" program), gym memberships, pricing framed as "discounts."

#### 4.3 Rule-Based Models
**Idea.** Agents follow simple rules, which may be fixed or adaptive, rather than optimizing.
**Mechanics.** A *fixed rule* might be "buy if price < value." An *adaptive rule* switches to strategies that performed better.
**Applications.**
- [Book] **Zero-intelligence traders** (Gode and Sunder): even random but budget-constrained traders make double auctions reach efficient prices. Market institutions do much of the "rational" work.
- **El Farol bar problem:** people predict attendance with various rules of thumb.

**Key point.** The *cognitive closure* argument: results that hold under all three types of model (rational, behavioral and rule-based) are robust.

---

## Part II: Distributions and Functional Forms (Chapters 5–9)

### Ch. 5. Normal Distributions: The Bell Curve

#### 5.1 Normal Distribution and the Central Limit Theorem
**Idea.** When you add up many small, independent random effects, the total is approximately normal, whatever the individual effects look like.
**Mechanics.** For a sum of *n* independent variables with mean μ and SD σ, the sum is ≈ N(nμ, √n·σ). About 68% of values fall within ±1σ, 95% within ±2σ, and 99.7% within ±3σ.
**Key result.** You can predict the *spread* of totals without knowing the individual details.
**Applications.**
- [Book] **Human height**, which comes from many genes plus environment.
- [Book] **Six Sigma quality control**: set process variation so defects lie 6σ from the mean, giving about 3.4 defects per million.
- Test scores and measurement error.

#### 5.2 Square-Root Rule (Standard Error)
**Idea.** The SD of an *average* shrinks with sample size as σ/√n.
**Key result.** Small groups show more extreme averages, both high and low, purely by chance.
**Applications.** [Book] The **small-schools puzzle**: small schools filled both the top *and* bottom of test-score rankings. This helped misdirect a major foundation's push for small schools. Rare-disease rates in small counties look extreme for the same reason.

#### 5.3 Lognormal Distribution
**Idea.** When effects *multiply* rather than add, the log of the outcome is normal. The result is skewed with a long right tail.
**Applications.** [Book] **Incomes and salaries**, because raises are percentages. Firm sizes and city populations (in part).
**Build it.** Multiply 1 by (1 + ε) repeatedly with small random ε, then compare the result with summing ε.

---

### Ch. 6. Power-Law Distributions: Long Tails

**Idea.** P(x) ∝ x^(−a). Most events are small, but huge ones are far more likely than a normal distribution would suggest. There is no "typical" size.
**Signature.** A straight line on a log-log plot. **Zipf's law** is a special case: rank × size ≈ constant.
**Where they appear.** [Book] City sizes, earthquake magnitudes, wars and casualties, book and music sales, website links, word frequencies, wealth, and firm sizes.

The book gives three models that *generate* power laws:

#### 6.1 Preferential Attachment
**Mechanics.** New entities (people, links, buyers) join an existing one with probability proportional to its current size. "The rich get richer."
**Applications.**
- City growth: migrants go where people already are.
- Citations and web links.
- [Book] **MusicLab** (Salganik, Dodds and Watts): when listeners could see download counts, which songs became hits was far more unequal and unpredictable. Social influence produces superstars.

#### 6.2 Self-Organized Criticality (Sandpile)
**Mechanics.** Grains drop onto a grid. When a pile gets too steep, it topples onto its neighbors, which can topple in turn. The system drives itself to a *critical* state where avalanche sizes follow a power law.
**Applications.** [Book] Earthquakes, forest fires, traffic jams, financial crashes. Systems that build up tension slowly can release it in any size of event.

#### 6.3 Random Return Times
**Mechanics.** A random walk's return time to zero follows a power law.
**Applications.** [Book] Firm lifetimes and how long species survive before extinction.

**Implications Page draws.**
1. **Inequality:** long tails produce winner-take-all outcomes.
2. **Catastrophes:** you must plan for huge events, since "100-year floods" occur more often than normal models suggest.
3. **Volatility:** averages are unstable, and a single outlier can dominate the mean.

**Build it.** Simulate Barabási-style attachment and a 2-D sandpile, then plot the log-log histograms.

---

### Ch. 7. Linear Models

**Idea.** y = a + b₁x₁ + b₂x₂ + … The outcome changes proportionally with each variable.
**Mechanics.** Ordinary least squares regression, the coefficient's sign, size and significance, and **R²** (the share of variance explained).
**Key results.**
- Linear models are simple, easy to read and often surprisingly good predictors.
- *Correlation is not causation.* Omitted variables and reverse causality mislead.
- Page distinguishes **"big coefficient" thinking** (put more into whatever has the largest coefficient) from **"new reality" thinking** (redesign the system). [Book] Expanding an effective program compared with inventing a new institution. Big-coefficient thinking is incremental, and new-reality thinking can be transformative.
**Applications.** Predicting house prices, wages from education and experience, and crop yields from rainfall. Linear rules often beat expert judgment (studies of clinical versus statistical prediction).

---

### Ch. 8. Concavity and Convexity

#### 8.1 Convex Functions and Exponential Growth
**Idea.** A convex function *accelerates*: each extra unit adds more than the last.
**Mechanics.** x(t) = x₀(1 + r)ᵗ. **Rule of 72:** the doubling time is about 72 / (growth % per period).
**Applications.** Compound interest, population growth, early epidemics, and [Book] Moore's law in chip performance.

#### 8.2 Concave Functions and Diminishing Returns
**Idea.** Each extra unit adds *less*. Concave utility implies **risk aversion** and gives diversity a value, via Jensen's inequality: the average of f(x) is less than f(average x).
**Applications.** Fertilizer yield, value of money, and learning curves.

#### 8.3 Solow Growth Model
**Mechanics.** Output Y = A·√(K·L). Workers save a fraction *s* of output, which becomes investment, and capital depreciates at rate *d*. The capital stock settles at a **steady state** where investment equals depreciation, so growth *stops* unless technology *A* grows.
**Key result.** Capital accumulation alone cannot sustain growth. Long-run growth comes from innovation.
**Applications.**
- [Book] **The Soviet Union's** rapid growth, then stagnation, from heavy capital investment with diminishing returns.
- [Book] **China's** growth: the model predicts it will slow as the capital stock matures, unless innovation takes over.
- The book extends this to a Solow-plus-innovation (Romer-style) model, where innovation has a *multiplier* effect because it raises the return on capital.

**Build it.** Iterate K(t+1) = K + sY − dK and add growth in A. Show convergence to a steady state from different starting points.

---

### Ch. 9. Models of Value and Power

#### 9.1 Cooperative Games
**Idea.** Players form coalitions. A *value function* v(S) gives what each coalition S can achieve.
**Question.** How should a coalition's total be divided fairly?

#### 9.2 Shapley Value
**Mechanics.** Each player's **average marginal contribution** across all possible orders of joining. It is the unique allocation satisfying efficiency, symmetry, the dummy-player axiom and additivity.
**Applications.**
- Dividing profits among partners.
- Airport runway cost-sharing, the classic case: small planes pay only for the short runway segment.
- Crediting team members' contributions.
- In machine learning today, **SHAP values** attribute a model's prediction to its input features. This is a direct descendant.

#### 9.3 Shapley–Shubik Power Index (Voting)
**Mechanics.** In weighted voting, a player's power is the share of orderings in which that player is the *pivotal* voter who turns a losing coalition into a winning one.
**Key result.** Power ≠ vote share. A party with 3 of 100 seats can be as powerful as one with 48 if it is the kingmaker.
**Applications.** [Book] Coalition governments, shareholder blocs, the EU Council and US Electoral College analyses, the UN Security Council veto.

**Build it.** Enumerate permutations for small *n*, or use Monte Carlo sampling for large *n*.

---

## Part III: Networks and Spread (Chapters 10–11)

### Ch. 10. Network Models

**Idea.** Represent entities as *nodes* and relationships as *edges*. Outcomes depend on the structure of the network, not just on the individuals in it.
**Key measures.** Degree, path length (the degrees of separation), clustering coefficient (how many of my friends know each other) and betweenness (how often a node lies on shortest paths).

**Network-formation models.**
- **Random network (Erdős–Rényi):** each pair is linked with probability *p*. Short paths, low clustering.
- **Small-world network (Watts–Strogatz):** start with a clustered ring lattice and rewire a few edges at random. You get high clustering *and* short paths.
- **Preferential attachment (Barabási–Albert):** degree follows a power law, with a few hubs.
- **Geographic / spatial network:** nodes connect to nearby nodes.

**Key results.**
- **Friendship paradox:** on average, your friends have more friends than you do, because popular people show up in more friend lists.
  - [Book] Application: to catch an outbreak early, monitor *friends of* random people, since they are more central. This was used to detect a flu outbreak at Harvard earlier than monitoring the random people themselves.
- **Six degrees of separation** (Milgram's letter experiment): short paths exist even in huge networks.
- **Strength of weak ties** (Granovetter): new information, such as job leads, arrives through acquaintances who bridge between clusters.
- **Robustness:** hub-based networks survive random failures but are fragile to targeted attacks on hubs. This applies to the power grid, the internet and airline hubs.

**Applications.** [Book] Social networks, terrorist and crime networks, the network of interbank loans in the 2008 crisis, and airline routes.
**Build it.** Use `networkx` to build each type of network, then compare path length, clustering and degree distribution.

---

### Ch. 11. Broadcast, Diffusion, and Contagion

#### 11.1 Broadcast Model
**Mechanics.** A central source reaches a fixed share *P* of the remaining uninformed people each period. Adoption follows an **r-shaped** (concave) curve: fast at first, then saturating.
**Applications.** TV advertising, news of major events, government announcements.

#### 11.2 Diffusion Model
**Mechanics.** The idea spreads by person-to-person contact, with a new adopter rate ∝ (adopters × non-adopters). This gives an **S-shaped** (logistic) curve.
**Applications.** Word-of-mouth spread of products, rumors and fashions.

#### 11.3 Bass Model
**Mechanics.** Combines broadcast (the innovation coefficient *p*, from external influence) with diffusion (the imitation coefficient *q*, from social contact). New adopters = (p + q·F)(1 − F), where F is the fraction who have already adopted.
**Applications.** [Book] Forecasting sales of consumer durables such as televisions, refrigerators and iPhones, and adoption of hybrid corn. You can fit *p* and *q* to early sales to forecast the peak.

#### 11.4 SIR Model (Susceptible–Infected–Recovered)
**Mechanics.** Susceptible people become infected at contact rate β and infected people recover at rate ν. **R₀ = β / ν** is the number of new cases per case in a fully susceptible population.
**Key results.**
- An outbreak grows if R₀ > 1 and dies out if R₀ < 1. This is a **tipping point**.
- **Herd immunity** comes from vaccinating a share V ≥ 1 − 1/R₀. For measles, with R₀ ≈ 15, that is about 93%.
**Applications.** [Book] Measles, influenza and vaccination policy. By analogy, the spread of memes, fads and online content. Superspreaders matter because they raise the effective R₀.
**Build it.** Solve the ODEs numerically, then vary β and ν to find the threshold.

---

## Part IV: Uncertainty and Dynamics (Chapters 12–19)

### Ch. 12. Entropy: Modeling Uncertainty

#### 12.1 Information Entropy (Shannon)
**Idea.** Entropy measures how uncertain or unpredictable an outcome is.
**Mechanics.** H = −Σ pᵢ log₂ pᵢ. A fair coin has 1 bit of entropy. A certain outcome has 0. With *n* equally likely outcomes, H = log₂ n, the maximum possible.
**Key results.**
- **Maximum-entropy distributions:** given what you know, assume the least-structured distribution. A known range gives a uniform distribution, a known mean gives an exponential, and a known mean and variance give a normal.
- Entropy measures **diversity**, for example of species in an ecosystem or products in a market.

#### 12.2 Four Classes of Outcomes
**Mechanics.** Following Wolfram's classification of cellular automata, systems produce one of four kinds of outcome:
1. **Equilibrium:** settles to a fixed state (low entropy)
2. **Periodic:** cycles
3. **Random:** high entropy, no pattern
4. **Complex:** between order and randomness; structured but hard to predict

**Applications.** [Book] Using entropy to compare how predictable different systems are, and as a measure of surprise (for instance in how political speeches or texts vary). Complex outcomes, such as markets, ecosystems and cities, are where models are hardest to build and most needed.
**Build it.** Run the 1-D elementary cellular automata (rules 0–255) and compute the entropy of each rule's output patterns.

---

### Ch. 13. Random Walks

#### 13.1 Bernoulli Urn and Simple Random Walk
**Mechanics.** Each period the value moves +1 or −1 with equal probability.
**Key results.**
- A 1-D random walk *returns to zero* with probability 1, but the expected time to return is infinite.
- Return times follow a power law, which links back to Ch. 6.
- The distance from the start grows as √t.
- Long streaks and apparent "trends" occur by chance.

#### 13.2 Normal Random Walk and the Efficient Market Hypothesis
**Mechanics.** Each step is drawn from a normal distribution.
**Key result.** If prices already reflect all available information, price changes should be unpredictable: they follow a random walk (Samuelson).
**Applications.**
- [Book] **Stock prices and mutual-fund performance**: most "hot" managers are explained by chance, and few beat index funds over time.
- [Book] **Sports streaks** and team win-loss records: many streaks match what random walks predict.
- Firm longevity.

**Build it.** Simulate 10,000 walks. Plot the distribution of return times and the maximum distance reached.

---

### Ch. 14. Path Dependence

**Idea.** What happens *later* depends on what happened *earlier*. Page distinguishes *outcome* path dependence (a single result depends on history) from *equilibrium* path dependence (the long-run distribution depends on history).

#### 14.1 Urn Models
- **Bernoulli urn:** draw with replacement and keep the urn unchanged. The past doesn't matter, so there is no path dependence.
- **Pólya urn:** after drawing a ball, add *another of the same color*. Every final proportion is equally likely, and early draws lock in the long-run share. This is path dependence driven by positive feedback.
- **Balancing urn:** after drawing a ball, add one of the *opposite* color. The share converges to 50/50. Negative feedback removes path dependence.

#### 14.2 Path Dependence vs. Tipping Points
Path dependence means small events add up and gradually lock in an outcome. A tipping point means a single moment sharply changes the likely outcome. Page measures this difference using changes in entropy.

**Applications.** [Book]
- **Technology standards:** QWERTY keyboards, VHS vs. Betamax, railroad gauge, driving on the left or right
- **Institutions and laws:** early legal precedents shape later ones
- **Cities and industries:** Silicon Valley, Detroit
- **Social influence** in cultural markets (MusicLab)

**Build it.** Run 1,000 Pólya-urn simulations and histogram the final share (it should be uniform). Compare with the Bernoulli and balancing urns.

---

### Ch. 15. Local Interaction Models

#### 15.1 Local Majority Model
**Mechanics.** Cells on a grid adopt whatever state most of their neighbors hold.
**Result.** The grid freezes into stable clusters.
**Applications.** Dialects, local customs, political leanings.

#### 15.2 Game of Life (Conway)
**Mechanics.** A cell survives with 2–3 live neighbors, is born with exactly 3, and dies otherwise.
**Key result.** Very simple local rules produce all four classes of outcome, including gliders and self-replicating structures. This shows *emergence*: complexity from simple parts.

#### 15.3 Schelling Segregation Model
**Mechanics.** Two types of agents live on a grid. An agent moves if fewer than a threshold share *T* of its neighbors are its own type.
**Key result.** Even mild preferences, such as T = 33% ("I'm fine being in the minority"), produce **strong segregation**. Macro patterns need not reflect micro intentions.
**Applications.** [Book] Racial and income segregation in US cities such as Chicago and Detroit, and self-sorting in lunchrooms, schools and political communities.

#### 15.4 Pure Coordination Game on a Network / Culture Models
**Mechanics.** Agents gain by matching their neighbors' actions. Adding *consistency* (agents also want their own traits to fit together) produces distinct "cultures."
**Applications.** [Book]
- Driving on the right or left
- The metric vs. imperial systems
- Greeting customs such as bowing, handshakes and kisses
- Organizational culture, including why mergers clash (Page's examples include company cultures)

Local coordination can get stuck on *inefficient* conventions.

**Build it.** The Schelling model is the standard starter project. Show segregation as a function of *T*.

---

### Ch. 16. Lyapunov Functions and Equilibria

**Idea.** If you can find a function F that (1) has a minimum (or maximum) and (2) **strictly decreases** by at least a fixed amount whenever the system changes, then the system *must* reach an equilibrium, within a bounded number of steps.
**Key results.**
- This proves a system settles down *without* solving for the equilibrium itself.
- It gives an upper bound on the time to equilibrium.
- It also explains why some systems *never* settle. For those, no Lyapunov function exists, such as a market with constant innovation.

**Applications.** [Book]
- **Pure exchange markets:** every voluntary trade increases total happiness, which is bounded, so trading eventually stops.
- **Route choice and congestion:** drivers switch to faster routes, and total potential falls, so traffic patterns stabilize. These are Rosenthal potential games.
- **Seating at events** and **where people shop.**
- Coalition and team formation.
- Open problems where no Lyapunov function is known, such as the Collatz (hailstone) sequence.

**Build it.** Simulate agents choosing among routes, track the potential function, and show that it decreases monotonically.

---

### Ch. 17. Markov Models

**Idea.** A system moves among a finite set of **states** with fixed **transition probabilities**.
**Mechanics.** A transition matrix P, with the state distribution updated as xₜ₊₁ = xₜP.
**Markov Convergence Theorem.** Suppose there are (1) finitely many states, (2) fixed transition probabilities, (3) a path from any state to any other, and (4) no simple cycle. Then the system converges to a **unique statistical equilibrium**, whatever its starting point.
**Key results.**
- **History doesn't matter** in the long run.
- **One-time interventions**, which change the current state, only have *temporary* effects.
- Lasting change requires changing the **transition probabilities** themselves.

**Applications.** [Book]
- **Alert vs. bored students** in a classroom, the classic toy example.
- **Democratization:** countries moving among Free, Partly Free and Not Free (Freedom House data). The model predicts the long-run shares.
- **Google PageRank:** a random surfer's stationary distribution over web pages.
- Drug addiction and recidivism: why short treatment programs fail if they don't change underlying transition rates.
- Market share among competing brands.

**Build it.** Build a matrix, iterate it, and compute the stationary distribution as an eigenvector. Show that different starting points converge to the same distribution.

---

### Ch. 18. Systems Dynamics Models

**Idea.** Model a system as **stocks** (levels), **flows** (rates) and **feedback loops**. Positive loops amplify and negative loops stabilize.
**Mechanics.** Causal-loop and stock-flow diagrams, with differential or difference equations.

#### 18.1 Predator–Prey (Lotka–Volterra)
**Mechanics.** dR/dt = aR − bRF and dF/dt = cRF − dF, where R is rabbits and F is foxes.
**Result.** The populations oscillate, with predator peaks lagging behind prey peaks.
**Applications.** [Book] Lynx and hare pelt records from the Hudson's Bay Company. By analogy, boom-bust cycles in business.

#### 18.2 World3 / Limits to Growth
**Mechanics.** A large systems-dynamics model with population, resources, pollution, food and industry.
**Applications.** [Book] The Club of Rome's *Limits to Growth* (1972). Page uses it to show the value of thinking in feedbacks, and the danger of treating a single run as a prediction.

**Other applications.** Supply chains (the bullwhip effect), housing markets, climate stocks and flows (CO₂), fisheries.
**Build it.** Integrate Lotka–Volterra with `scipy.odeint` and draw the phase plot.

---

### Ch. 19. Threshold Models with Feedbacks

**Idea.** Each person acts when enough others do, or stops when too many do. Actions feed back to change other people's behavior.

#### 19.1 Riot / Collective Behavior Model (Granovetter)
**Mechanics.** Each person has a threshold: "I'll join if at least *k* others have." The outcome depends on the **whole distribution** of thresholds.
**Key result.** Two crowds with nearly identical average thresholds can produce a full riot or nothing at all. Take thresholds 0, 1, 2, …, 99: everyone joins. Change one person's threshold from 1 to 2 and only one person joins.
**Applications.** [Book] Riots, protests and revolutions (such as the Arab Spring), standing ovations, adoption of new fashions, and **bank runs**.

#### 19.2 Negative-Feedback Thresholds
**Mechanics.** People act only if *few* others do, as in the El Farol bar or "I'll go to the gym if it's not crowded."
**Result.** Attendance hovers near the threshold instead of cascading.
**Applications.** Traffic, restaurant crowding, and water conservation during droughts.

#### 19.3 Tipping Points
Page separates **direct tips** (a change in one variable pushes the system past a threshold) from **contextual tips** (the environment changes so the same action has new effects).

**Build it.** Generate threshold distributions, compute the cascade size, and show how sensitive the result is to small changes in the distribution.

---

## Part V: Choice, Strategy and Institutions (Chapters 20–25)

### Ch. 20. Spatial and Hedonic Choice

#### 20.1 Spatial Choice Model
**Idea.** Each person has an **ideal point** in a space of attributes. They prefer options *closer* to it, so more is not always better.
**Mechanics.** Utility = −distance(option, ideal point).
**Key results.**
- **Median voter theorem** (Downs/Hotelling): in one dimension with two candidates, both move toward the median voter.
- In two or more dimensions, stable equilibria may not exist (chaos theorems).

**Applications.** [Book]
- **Political ideology**, including DW-NOMINATE scores placing US Congress members on a left-right scale
- **Product positioning**, such as sweetness of soda or firmness of a mattress
- **Store location** (Hotelling's ice-cream vendors on a beach)

#### 20.2 Hedonic Choice Model
**Idea.** Every attribute is "more is better" (quality, speed, safety). People differ only in how much weight they give each attribute.
**Mechanics.** Utility = Σ wᵢ·attributeᵢ.
**Applications.** Cars (horsepower, safety), housing (square footage, location), and **hedonic price regressions** used to estimate what each attribute adds to price.

**Mixed model.** Real choices combine both: spatial preferences for style, and hedonic preferences for quality. Page uses combinations to explain why people make different choices.

---

### Ch. 21. Game Theory Models Times Three

#### 21.1 Normal-Form Games
**Mechanics.** Players choose strategies at the same time. A payoff matrix gives the results. **Nash equilibrium** is a situation where no player benefits from changing strategy alone.
**Examples.**
- **Zero-sum games** (matching pennies) have mixed-strategy equilibria.
- **Coordination games** have multiple equilibria.
- [Book] **Market entry game:** firms decide whether to enter a market that can support only a few of them.

#### 21.2 Sequential (Extensive-Form) Games
**Mechanics.** Players move in turns. Solve by **backward induction** to get the subgame-perfect equilibrium.
**Examples.**
- [Book] **Entry deterrence:** an incumbent threatens a price war, but the threat may not be *credible*.
- **Ultimatum game:** theory predicts the proposer offers the minimum and the responder accepts. In practice people reject unfair offers, which ties back to behavioral models.
- **Centipede game.**

#### 21.3 Continuous-Action Games
**Mechanics.** Players choose a *level* of something, such as effort, price or quantity.
**Examples.**
- [Book] **Effort games and contests:** workers or firms competing for a prize over-invest in effort, as in patent races, lobbying and arms races.
- **Cournot quantity competition.**

#### 21.4 Colonel Blotto
**Mechanics.** Two players divide troops across several fronts. Each front goes to whoever sends more.
**Key result.** There is no pure-strategy equilibrium, and randomizing is essential. More fronts favor the weaker player.
**Applications.** Elections (allocating campaign spending across states), sports (lineups), and business competition across product lines.

**Build it.** Write a Nash solver for 2×2 games, backward induction on trees, and a Blotto tournament with random allocations.

---

### Ch. 22. Models of Cooperation

**Setup.** The **Prisoner's Dilemma**: defecting is individually better, but mutual cooperation is better for both.

**Five routes to cooperation.**
1. **Repeated play (direct reciprocity):** Grim Trigger or **Tit-for-Tat** can sustain cooperation if the future matters enough. Cooperation holds when the continuation probability exceeds a threshold. [Book] **Axelrod's tournaments**, which Tit-for-Tat won by being nice, retaliatory, forgiving and clear.
2. **Reputation (indirect reciprocity):** cooperate with those known to cooperate. Examples include eBay ratings and credit scores.
3. **Network reciprocity:** in clusters, cooperators interact mostly with cooperators and do well.
4. **Group selection:** cooperative groups outcompete selfish groups.
5. **Kin selection:** Hamilton's rule, r·b > c.

**Applications.** [Book] Firms colluding on price, WWI "live and let live" truces between trenches, international trade agreements, vampire bats sharing blood, and cooperation within firms.
**Build it.** Run an Axelrod-style round-robin tournament plus evolutionary dynamics (strategies reproduce in proportion to their payoffs).

---

### Ch. 23. Collective Action Problems

**Idea.** Individual incentives lead to outcomes that are bad for the group. These are the *n*-player versions of the Prisoner's Dilemma.

#### 23.1 Public Goods
**Mechanics.** Contributions are pooled, multiplied and shared equally. Each person gains by free-riding.
**Applications.** [Book] National defense, clean air, basic research, Wikipedia, public broadcasting, and lab public-goods games, where contributions decline over rounds.

#### 23.2 Congestion Models
**Mechanics.** Each extra user lowers everyone else's payoff.
**Applications.** [Book] Traffic, crowded beaches, and bandwidth. Solutions include congestion pricing, as in London and Stockholm.

#### 23.3 Renewable Resource Extraction
**Mechanics.** A resource regrows (logistically), and each user harvests. Overharvesting collapses the stock.
**Applications.** [Book] **Fisheries**, such as the collapse of Atlantic (Grand Banks) cod, as well as groundwater aquifers, forests and grazing commons. Easter Island is sometimes cited here.

#### Solutions
Page draws on **Elinor Ostrom**'s design principles for managing commons:
- clear boundaries
- local rules
- monitoring
- graduated sanctions
- conflict resolution

Other solutions include taxes, quotas, property rights (such as tradable fishing quotas), and reciprocity.

**Build it.** A public-goods game with learning agents, and a fishery model with different harvest rules.

---

### Ch. 24. Mechanism Design

**Idea.** Work backward: *design the rules* (the game) so that self-interested behavior produces good outcomes. This is a problem of **incentive compatibility** under hidden information or hidden action.

#### 24.1 Majority Rule, Voting and Kingmaker Mechanisms
Different voting rules can produce different winners from the *same* preferences, which links to **Arrow's impossibility theorem**.

#### 24.2 Hidden Action (Moral Hazard)
Pay contracts that reward observable outcomes to motivate unobservable effort. Examples include sales commissions, CEO stock options and insurance deductibles.

#### 24.3 Hidden Information: Auctions
- Ascending (English), second-price sealed-bid (Vickrey), and first-price sealed-bid auctions.
- In a Vickrey auction, **bidding your true value is a dominant strategy.**
- **Revenue equivalence theorem:** under standard assumptions, all of these auctions yield the same expected revenue.
- [Book] **FCC spectrum auctions**, as well as eBay, Google ad auctions and art auctions.

#### 24.4 Public-Project Decision Mechanisms
The **pivot (Clarke–Groves) mechanism**: each person states a value and pays a tax only if they change the outcome. This makes truth-telling optimal, though the budget may not balance.
**Applications.** Deciding whether to build a bridge or park when people might exaggerate how much they value it.

**Build it.** Simulate auctions with bidders' values drawn at random, and compare revenue and efficiency across formats.

---

### Ch. 25. Signaling Models

**Idea.** One party has private information, such as ability, quality or intentions. It sends a costly **signal** that others can use to infer that information.
**Mechanics.** In a **separating equilibrium**, sending the signal costs high types less than low types, so only high types send it. In a **pooling equilibrium**, everyone sends the same signal and nothing is revealed.

#### 25.1 Discrete Signals
**Examples.** [Book] Education as a signal (Spence): a degree signals ability even if the coursework is unrelated to the job. The peacock's tail (Zahavi's handicap principle). Warranties. Expensive advertising ("burning money").

#### 25.2 Continuous Signals
**Mechanics.** The *size* of the signal matters, as with bigger donations or larger weddings.
**Examples.** [Book] Lavish weddings, conspicuous consumption (luxury goods), corporate headquarters, Super Bowl ads, and military displays. Signals also serve functions beyond conveying information, such as reinforcing norms.

**Build it.** Compute the equilibrium signal thresholds for given costs.

---

## Part VI: Learning and Search (Chapters 26–28)

### Ch. 26. Models of Learning

#### 26.1 Individual (Reinforcement) Learning
**Mechanics.** Each alternative has a weight. Choose each with probability proportional to its weight. After receiving a reward, raise that alternative's weight by an amount based on the reward (minus an aspiration level).
**Result.** In fixed environments, learners converge to the best alternative.
**Applications.** Choosing a commute route, a favorite restaurant, or a study strategy. Animal learning.

#### 26.2 Social Learning: Replicator Dynamics
**Mechanics.** A strategy's share of the population grows in proportion to its payoff relative to the average payoff, combining *popularity × performance*.
**Result.** Better strategies spread through the population.
**Applications.** Spread of farming techniques, management practices, technologies, and viral content.

#### 26.3 Learning in Games
**Key result.** When payoffs depend on what *others* do, learning need not find the best outcome, and individual and social learning can reach *different* equilibria.
**Example.** [Book] The **generous/spiteful game**: learners can converge to a spiteful, inefficient equilibrium.
**Lesson.** Don't assume learning produces optimal outcomes when people interact strategically.

**Build it.** A reinforcement learner on a 2-armed choice, plus replicator dynamics on a 2×2 game.

---

### Ch. 27. Multi-Armed Bandit Problems

**Idea.** Repeatedly choose among options with unknown payoffs. This is the core **explore vs. exploit** tradeoff.

#### 27.1 Bernoulli Bandits
**Mechanics.** Each arm pays 1 with an unknown probability.
**Heuristics.**
- **ε-greedy:** exploit the current best, but explore at random ε of the time.
- **Upper confidence bound (UCB):** favor arms whose value is still uncertain.
- **Thompson sampling.**

#### 27.2 Bayesian Bandits and the Gittins Index
**Mechanics.** With priors on each arm and discounting, the optimal policy gives each arm an index (the **Gittins index**) computed independently, and always pulls the arm with the highest index.
**Key results.**
- Explore more when the horizon is long.
- Don't abandon an uncertain option after one bad outcome.

**Applications.** [Book]
- **Clinical trials** (adaptive trial designs)
- **A/B testing** of websites and ads
- Choosing restaurants or vacation spots
- R&D portfolios
- Hiring
- Deciding which new drug or technology to back

**Build it.** Compare ε-greedy, UCB and Thompson sampling by plotting regret over time.

---

### Ch. 28. Rugged-Landscape Models

#### 28.1 Fitness Landscapes
**Idea.** Each possible solution has a "height" (its fitness or value). A search, whether evolution, design or strategy, climbs upward.
- **Mount Fuji landscape:** a single peak, so hill-climbing finds the optimum.
- **Rugged landscape:** many local peaks, so searchers get stuck.

#### 28.2 NK Model (Kauffman)
**Mechanics.** A solution has *N* binary components. Each component's contribution depends on itself and *K* other components.
- K = 0 gives a smooth landscape with one peak.
- K = N−1 gives a maximally rugged, random landscape.
**Key results.**
- **Interdependence creates ruggedness.**
- More interactions mean more local optima, lower peaks found by local search, and more value from diverse search heuristics and teams.

#### 28.3 Dancing Landscapes
**Idea.** When other players' choices change *your* landscape (co-evolution), the peaks shift, as with firms competing or species co-evolving.

**Applications.** [Book]
- **Evolution** of species (Sewall Wright's adaptive landscapes)
- **Product design**, where components interact (a car's engine, weight and brakes)
- **Firm strategy** (organizational fit among practices; the Southwest Airlines example often used in management literature)
- **Policy reform**, where changing one piece of an interdependent system can make things worse
- Why diverse teams find better solutions to complex problems (Page's *The Difference*)

**Build it.** Generate NK landscapes, run hill-climbers with different starting points and heuristics, and plot the best fitness found against K.

---

## Part VII: Putting It Together (Chapter 29)

### Ch. 29. Opioids, Inequality, and Humility

Page applies many models at once to two problems.

**The opioid epidemic.**
- **Bandit models:** doctors, drug companies and patients exploring pain treatments with an incomplete picture of addiction risk.
- **Markov models:** transitions among use, addiction, treatment and recovery; interventions need to change transition probabilities.
- **Systems dynamics:** supply chains, pill mills, and the shift to heroin and fentanyl after prescription crackdowns (an unintended feedback).
- **Contagion and network models:** spread through social networks and communities.

**Income and wealth inequality.**
- **Preferential attachment / power laws:** winner-take-all markets and superstar effects.
- **Solow and human capital models:** returns to education and skill-biased technical change.
- **Network models:** access to opportunity through connections.
- **Path dependence and Markov models:** mobility across generations.
- **Rugged landscapes / signaling:** credentials and sorting.

**Lesson.** No single model explains either problem. Each points to different causes and different fixes. Page urges **humility**: use many models, keep them diverse, and remember that each one captures only part of reality.

---

## Quick Reference: Suggested Implementation Order

| # | Model | Difficulty | Core technique |
|---|---|---|---|
| 1 | Condorcet / Diversity prediction theorem | Easy | Monte Carlo, algebra check |
| 2 | Normal / lognormal / square-root rule | Easy | Sampling |
| 3 | Pólya / Bernoulli / balancing urns | Easy | Simulation |
| 4 | Random walks | Easy | Simulation |
| 5 | Markov chains | Easy | Matrix power, eigenvectors |
| 6 | Bass / SIR diffusion | Easy–Med | ODEs |
| 7 | Lotka–Volterra | Easy–Med | ODEs |
| 8 | Solow growth | Easy–Med | Difference equations |
| 9 | Granovetter thresholds | Easy | Sorting / cascade |
| 10 | Schelling segregation | Medium | Agent-based grid |
| 11 | Game of Life / cellular automata / entropy | Medium | Grid updates |
| 12 | Preferential attachment / sandpile | Medium | Networks, grids |
| 13 | Network models (ER, WS, BA), friendship paradox | Medium | `networkx` |
| 14 | Shapley value / power index | Medium | Permutations |
| 15 | Game theory: Nash, backward induction, Blotto | Medium | Solvers |
| 16 | Repeated PD / Axelrod tournament | Medium | Agent simulation |
| 17 | Public goods / fishery | Medium | Agent + ODE |
| 18 | Auctions and mechanisms | Medium | Simulation |
| 19 | Reinforcement learning / replicator dynamics | Medium | Iterative updates |
| 20 | Multi-armed bandits | Medium | ε-greedy, UCB, Thompson |
| 21 | NK landscapes | Medium–Hard | Combinatorial search |
| 22 | Lyapunov / congestion potential games | Medium | Agent simulation |
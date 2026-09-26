Ch. 12. Entropy: Modeling Uncertainty
12.1 Information Entropy (Shannon)

Idea. Entropy measures how uncertain or unpredictable an outcome is. Mechanics. H = −Σ pᵢ log₂ pᵢ. A fair coin has 1 bit of entropy. A certain outcome has 0. With n equally likely outcomes, H = log₂ n, the maximum possible. Key results.

Maximum-entropy distributions: given what you know, assume the least-structured distribution. A known range gives a uniform distribution, a known mean gives an exponential, and a known mean and variance give a normal.
Entropy measures diversity, for example of species in an ecosystem or products in a market.
12.2 Four Classes of Outcomes

Mechanics. Following Wolfram's classification of cellular automata, systems produce one of four kinds of outcome:

Equilibrium: settles to a fixed state (low entropy)
Periodic: cycles
Random: high entropy, no pattern
Complex: between order and randomness; structured but hard to predict

Applications. [Book] Using entropy to compare how predictable different systems are, and as a measure of surprise (for instance in how political speeches or texts vary). Complex outcomes, such as markets, ecosystems and cities, are where models are hardest to build and most needed. Build it. Run the 1-D elementary cellular automata (rules 0–255) and compute the entropy of each rule's output patterns.
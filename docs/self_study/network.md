Ch. 10. Network Models

Idea. Represent entities as nodes and relationships as edges. Outcomes depend on the structure of the network, not just on the individuals in it. Key measures. Degree, path length (the degrees of separation), clustering coefficient (how many of my friends know each other) and betweenness (how often a node lies on shortest paths).

Network-formation models.

Random network (Erdős–Rényi): each pair is linked with probability p. Short paths, low clustering.
Small-world network (Watts–Strogatz): start with a clustered ring lattice and rewire a few edges at random. You get high clustering and short paths.
Preferential attachment (Barabási–Albert): degree follows a power law, with a few hubs.
Geographic / spatial network: nodes connect to nearby nodes.

Key results.

Friendship paradox: on average, your friends have more friends than you do, because popular people show up in more friend lists.
[Book] Application: to catch an outbreak early, monitor friends of random people, since they are more central. This was used to detect a flu outbreak at Harvard earlier than monitoring the random people themselves.
Six degrees of separation (Milgram's letter experiment): short paths exist even in huge networks.
Strength of weak ties (Granovetter): new information, such as job leads, arrives through acquaintances who bridge between clusters.
Robustness: hub-based networks survive random failures but are fragile to targeted attacks on hubs. This applies to the power grid, the internet and airline hubs.

Applications. [Book] Social networks, terrorist and crime networks, the network of interbank loans in the 2008 crisis, and airline routes. Build it. Use networkx to build each type of network, then compare path length, clustering and degree distribution.
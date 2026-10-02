// Game theory story · two interactive pieces:
//   1. Live payoff matrix — editable, with Nash analysis
//   2. Repeated Prisoner's Dilemma — vs 5 opponent minds

// ============================================================================
// Preset games
// ============================================================================

// Each preset: payoffs[r][c] = [rowPayoff, colPayoff]
// plus names for the Row & Column strategies.
const GAMES = {
  pd: {
    name: 'Prisoner\'s Dilemma',
    rowNames: ['Cooperate', 'Defect'],
    colNames: ['Cooperate', 'Defect'],
    payoffs: [
      [[3, 3], [0, 5]],
      [[5, 0], [1, 1]],
    ],
  },
  stag: {
    name: 'Stag Hunt',
    rowNames: ['Stag',    'Hare'],
    colNames: ['Stag',    'Hare'],
    payoffs: [
      [[4, 4], [0, 3]],
      [[3, 0], [3, 3]],
    ],
  },
  battle: {
    name: 'Battle of the Sexes',
    rowNames: ['Opera',   'Football'],
    colNames: ['Opera',   'Football'],
    payoffs: [
      [[3, 2], [0, 0]],
      [[0, 0], [2, 3]],
    ],
  },
  chicken: {
    name: 'Chicken',
    rowNames: ['Swerve',  'Straight'],
    colNames: ['Swerve',  'Straight'],
    payoffs: [
      [[3, 3], [1, 4]],
      [[4, 1], [0, 0]],
    ],
  },
  pennies: {
    name: 'Matching Pennies',
    rowNames: ['Heads',   'Tails'],
    colNames: ['Heads',   'Tails'],
    payoffs: [
      [[ 1, -1], [-1,  1]],
      [[-1,  1], [ 1, -1]],
    ],
  },
};

// ============================================================================
// Part 1 · Payoff matrix — analysis engine
// ============================================================================

function analyze(payoffs) {
  const rows = 2, cols = 2;

  // ---- Best responses (with ties) --------------------------------
  // rowBest[c] = set of rows that maximise Row's payoff when Column plays c
  const rowBest = [];
  for (let c = 0; c < cols; c++) {
    const vals = [payoffs[0][c][0], payoffs[1][c][0]];
    const max = Math.max(...vals);
    rowBest.push(vals.map((v, i) => v === max ? i : -1).filter(i => i >= 0));
  }
  // colBest[r] = set of columns that maximise Column's payoff when Row plays r
  const colBest = [];
  for (let r = 0; r < rows; r++) {
    const vals = [payoffs[r][0][1], payoffs[r][1][1]];
    const max = Math.max(...vals);
    colBest.push(vals.map((v, i) => v === max ? i : -1).filter(i => i >= 0));
  }

  // ---- Pure Nash equilibria --------------------------------------
  const nash = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rowBest[c].includes(r) && colBest[r].includes(c)) nash.push([r, c]);
    }
  }

  // ---- Dominant strategies ---------------------------------------
  // Row A strictly dominates Row B iff Row's payoff for A > B in every column
  const rowDominant = (() => {
    const aStrict = [0, 1].every(c => payoffs[0][c][0] >  payoffs[1][c][0]);
    const aWeak   = [0, 1].every(c => payoffs[0][c][0] >= payoffs[1][c][0]) && !aStrict;
    const bStrict = [0, 1].every(c => payoffs[1][c][0] >  payoffs[0][c][0]);
    const bWeak   = [0, 1].every(c => payoffs[1][c][0] >= payoffs[0][c][0]) && !bStrict;
    if (aStrict) return { strat: 0, kind: 'strict' };
    if (bStrict) return { strat: 1, kind: 'strict' };
    if (aWeak)   return { strat: 0, kind: 'weak' };
    if (bWeak)   return { strat: 1, kind: 'weak' };
    return null;
  })();
  const colDominant = (() => {
    const aStrict = [0, 1].every(r => payoffs[r][0][1] >  payoffs[r][1][1]);
    const aWeak   = [0, 1].every(r => payoffs[r][0][1] >= payoffs[r][1][1]) && !aStrict;
    const bStrict = [0, 1].every(r => payoffs[r][1][1] >  payoffs[r][0][1]);
    const bWeak   = [0, 1].every(r => payoffs[r][1][1] >= payoffs[r][0][1]) && !bStrict;
    if (aStrict) return { strat: 0, kind: 'strict' };
    if (bStrict) return { strat: 1, kind: 'strict' };
    if (aWeak)   return { strat: 0, kind: 'weak' };
    if (bWeak)   return { strat: 1, kind: 'weak' };
    return null;
  })();

  // ---- Mixed strategy equilibrium (2×2 only) ---------------------
  //   p = Row's probability of playing strategy A
  //   q = Column's probability of playing strategy A
  //
  //   Column mixes q* so Row is indifferent:
  //   q·R(A,A) + (1-q)·R(A,B) = q·R(B,A) + (1-q)·R(B,B)
  //   q = (R(B,B) - R(A,B)) / (R(A,A) - R(B,A) + R(B,B) - R(A,B))
  //
  //   Row mixes p* so Column is indifferent (symmetric).
  const R00 = payoffs[0][0][0], R01 = payoffs[0][1][0];
  const R10 = payoffs[1][0][0], R11 = payoffs[1][1][0];
  const C00 = payoffs[0][0][1], C01 = payoffs[0][1][1];
  const C10 = payoffs[1][0][1], C11 = payoffs[1][1][1];
  const qDenom = R00 - R10 - R01 + R11;
  const pDenom = C00 - C01 - C10 + C11;
  let mixed = null;
  if (Math.abs(qDenom) > 1e-9 && Math.abs(pDenom) > 1e-9) {
    const q = (R11 - R01) / qDenom;
    const p = (C11 - C10) / pDenom;
    if (q > 0 && q < 1 && p > 0 && p < 1) mixed = { p, q };
  }

  // ---- Pareto check for each Nash --------------------------------
  // A cell is Pareto-dominated iff some other cell strictly beats it for at
  // least one player AND is at least as good for the other.
  function dominates(ar, ac, br, bc) {
    const [ar1, ac1] = [payoffs[ar][ac][0], payoffs[ar][ac][1]];
    const [br1, bc1] = [payoffs[br][bc][0], payoffs[br][bc][1]];
    return (br1 >= ar1 && bc1 >= ac1) && (br1 > ar1 || bc1 > ac1);
  }
  const nashParetoCheck = nash.map(([r, c]) => {
    for (let r2 = 0; r2 < rows; r2++) {
      for (let c2 = 0; c2 < cols; c2++) {
        if (r2 === r && c2 === c) continue;
        if (dominates(r, c, r2, c2)) return { dominated: true, by: [r2, c2] };
      }
    }
    return { dominated: false };
  });

  return { rowBest, colBest, nash, rowDominant, colDominant, mixed, nashParetoCheck };
}

function initMatrixSim() {
  const inputs = Array.from(document.querySelectorAll('input.payoff'));
  const gameBtns = document.querySelectorAll('button[data-game]');
  const rowAName = document.getElementById('row-A-name');
  const rowBName = document.getElementById('row-B-name');
  const colAName = document.getElementById('col-A-name');
  const colBName = document.getElementById('col-B-name');
  const analysisItems = document.getElementById('analysis-items');
  const verdictEl = document.getElementById('verdict');

  let currentGame = 'pd';
  let payoffs = JSON.parse(JSON.stringify(GAMES.pd.payoffs));

  function loadGame(key) {
    currentGame = key;
    gameBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-game') === key));
    const g = GAMES[key];
    payoffs = JSON.parse(JSON.stringify(g.payoffs));
    rowAName.textContent = g.rowNames[0];
    rowBName.textContent = g.rowNames[1];
    colAName.textContent = g.colNames[0];
    colBName.textContent = g.colNames[1];
    // Push payoffs into input fields
    for (const inp of inputs) {
      const r = +inp.dataset.r, c = +inp.dataset.c;
      const p = inp.dataset.p === 'r' ? 0 : 1;
      inp.value = payoffs[r][c][p];
    }
    render();
  }

  function readPayoffs() {
    const p = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
    for (const inp of inputs) {
      const r = +inp.dataset.r, c = +inp.dataset.c;
      const pi = inp.dataset.p === 'r' ? 0 : 1;
      const v = Number(inp.value);
      p[r][c][pi] = Number.isFinite(v) ? v : 0;
    }
    payoffs = p;
  }

  function render() {
    const analysis = analyze(payoffs);
    const { rowBest, colBest, nash, rowDominant, colDominant, mixed, nashParetoCheck } = analysis;
    const g = GAMES[currentGame];

    // ---- Highlight cells based on best responses ----
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cell = document.getElementById(`cell-${r}-${c}`);
        if (!cell) continue;
        cell.classList.toggle('row-best', rowBest[c].includes(r));
        cell.classList.toggle('col-best', colBest[r].includes(c));
        const isNash = nash.some(([nr, nc]) => nr === r && nc === c);
        cell.classList.toggle('nash', isNash);
      }
    }

    // ---- Analysis panel items ----
    const items = [];

    // Dominant strategies
    if (rowDominant || colDominant) {
      const parts = [];
      if (rowDominant) {
        parts.push(`<strong style="color:var(--amber);">Alice's ${g.rowNames[rowDominant.strat]}</strong>${rowDominant.kind === 'weak' ? ' (weakly)' : ''}`);
      }
      if (colDominant) {
        parts.push(`<strong style="color:var(--cyan);">Bob's ${g.colNames[colDominant.strat]}</strong>${colDominant.kind === 'weak' ? ' (weakly)' : ''}`);
      }
      items.push({
        icon: '🧭',
        label: 'Dominant strategy',
        detail: parts.join(' and ') + ' dominates — best regardless of the opponent.',
      });
    } else {
      items.push({
        icon: '🔀',
        label: 'No dominant strategy',
        detail: 'Each side\'s best move depends on what the other does.',
      });
    }

    // Pure Nash equilibria
    if (nash.length === 0) {
      items.push({
        icon: '🎲',
        label: 'Pure Nash equilibria: 0',
        detail: 'No cell is stable — anyone would want to deviate. The only equilibrium is a mixed (randomised) one.',
      });
    } else {
      const list = nash.map(([r, c]) =>
        `(<strong style="color:var(--amber);">${g.rowNames[r]}</strong>, <strong style="color:var(--cyan);">${g.colNames[c]}</strong>)`
      ).join(' and ');
      items.push({
        icon: nash.length === 1 ? '🎯' : '⚡',
        label: `Pure Nash equilibria: ${nash.length}`,
        detail: list,
      });
    }

    // Mixed strategy equilibrium
    if (mixed) {
      const pPct = Math.round(mixed.p * 100);
      const qPct = Math.round(mixed.q * 100);
      items.push({
        icon: '🎲',
        label: 'Mixed-strategy equilibrium',
        detail:
          `<strong style="color:var(--amber);">Alice</strong> plays <strong>${g.rowNames[0]}</strong> ${pPct}% of the time; ` +
          `<strong style="color:var(--cyan);">Bob</strong> plays <strong>${g.colNames[0]}</strong> ${qPct}%. ` +
          `Alice's mix is pinned by <em>Bob's</em> payoffs (and vice-versa).`,
      });
    }

    // Pareto check — only report if there's exactly one Nash and it's dominated
    if (nash.length === 1 && nashParetoCheck[0].dominated) {
      const [br, bc] = nashParetoCheck[0].by;
      items.push({
        icon: '💔',
        label: 'The equilibrium is a trap',
        detail:
          `The Nash is Pareto-dominated by (<strong>${g.rowNames[br]}</strong>, <strong>${g.colNames[bc]}</strong>). ` +
          'Both players would prefer that outcome — but neither can get there without the other.',
      });
    }

    // Build DOM
    analysisItems.innerHTML = items.map(it => `
      <div class="analysis-item">
        <div class="ai-icon">${it.icon}</div>
        <div>
          <div class="ai-label">${it.label}</div>
          <div class="ai-detail">${it.detail}</div>
        </div>
      </div>
    `).join('');

    // ---- Verdict (big summary line) ----
    verdictEl.className = 'verdict';
    let verdict = '';
    if (nash.length === 1 && nashParetoCheck[0].dominated) {
      verdictEl.classList.add('trap');
      verdict = `🪤 <strong>Classic Prisoner\'s Dilemma pattern.</strong> One stable equilibrium, and it\'s the <em>worse</em> outcome for both. This is why cooperation needs enforcement, repetition, or reputation.`;
    } else if (nash.length === 0) {
      verdictEl.classList.add('mixed');
      verdict = `🪞 <strong>No stable pure strategy — somebody is always tempted to switch.</strong> The only equilibrium is a randomised one, and here\'s the kicker: <em>your</em> ideal mix is set by <em>your opponent\'s</em> payoffs, not yours.`;
    } else if (nash.length >= 2) {
      verdictEl.classList.add('multi');
      verdict = `🎭 <strong>${nash.length} equilibria — the theory alone can\'t pick one.</strong> You need a focal point, a convention, a signal, or just history (Ch 14) to coordinate on which.`;
    } else {
      verdict = `✅ <strong>Clean outcome.</strong> Both players agree on the same cell with no incentive to deviate — and no cheaper alternative they\'d both prefer.`;
    }
    verdictEl.innerHTML = verdict;
  }

  // Preset buttons
  gameBtns.forEach(btn => {
    btn.addEventListener('click', () => loadGame(btn.getAttribute('data-game')));
  });

  // Live edits
  inputs.forEach(inp => {
    inp.addEventListener('input', () => {
      readPayoffs();
      render();
    });
  });

  loadGame('pd');
}

// ============================================================================
// Part 2 · Repeated Prisoner's Dilemma
// ============================================================================

const OPPONENTS = {
  tft: {
    name: 'Tit-for-Tat',
    desc: '🪞 Starts friendly, then copies your last move. Nice, forgiving, retaliatory. Beat it only by cooperating every round — then you both win big.',
    choose: (history) => history.length === 0 ? 'C' : history[history.length - 1].you,
  },
  allD: {
    name: 'Always Defect',
    desc: '👹 The cold rational best-response in a one-shot game. Takes advantage every single round. The only sane play against this opponent is to defect right back.',
    choose: () => 'D',
  },
  allC: {
    name: 'Always Cooperate',
    desc: '😇 Trusting to a fault. Easy to exploit — but mutual cooperation gives you the highest achievable combined score (6/round). What will you do?',
    choose: () => 'C',
  },
  grudger: {
    name: 'Grudger',
    desc: '💢 Cooperates until you defect once. Then defects forever. No apologies, no second chances, no shortcuts to redemption.',
    choose: (history) => history.some(r => r.you === 'D') ? 'D' : 'C',
  },
  random: {
    name: 'Random',
    desc: '🎲 Flips a coin each round. Impossible to anticipate, impossible to learn. Your best long-run play against pure noise is… actually defection.',
    choose: () => Math.random() < 0.5 ? 'C' : 'D',
  },
};

const PD_PAYOFFS = {
  CC: [3, 3],
  CD: [0, 5],
  DC: [5, 0],
  DD: [1, 1],
};
const PD_ROUNDS = 20;

function initRepeatedPDSim() {
  const oppBtns = document.querySelectorAll('button[data-opp]');
  const oppDesc = document.getElementById('opp-description');
  const scoreYou = document.getElementById('score-you');
  const scoreOpp = document.getElementById('score-opp');
  const scoreOppName = document.getElementById('score-opp-name');
  const movesYou = document.getElementById('moves-you');
  const movesOpp = document.getElementById('moves-opp');
  const roundInd = document.getElementById('round-indicator');
  const btnCoop  = document.getElementById('btn-coop');
  const btnDefect = document.getElementById('btn-defect');
  const btnReset  = document.getElementById('btn-reset');
  const summaryEl = document.getElementById('summary');

  let currentOpp = 'tft';
  let history = [];     // [{ you: 'C'|'D', opp: 'C'|'D' }]
  let yourScore = 0;
  let oppScore = 0;

  function reset() {
    history = [];
    yourScore = 0;
    oppScore = 0;
    summaryEl.style.display = 'none';
    btnCoop.disabled = false;
    btnDefect.disabled = false;
    render();
  }

  function pickOpponent(key) {
    currentOpp = key;
    oppBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-opp') === key));
    const opp = OPPONENTS[key];
    oppDesc.textContent = opp.desc;
    scoreOppName.textContent = opp.name;
    reset();
  }

  function playRound(myMove) {
    const oppMove = OPPONENTS[currentOpp].choose(history);
    const key = myMove + oppMove;
    const [myPt, oppPt] = PD_PAYOFFS[key];
    history.push({ you: myMove, opp: oppMove });
    yourScore += myPt;
    oppScore  += oppPt;
    if (history.length >= PD_ROUNDS) {
      btnCoop.disabled = true;
      btnDefect.disabled = true;
    }
    render();
    if (history.length === PD_ROUNDS) showSummary();
  }

  function render() {
    scoreYou.textContent = yourScore;
    scoreOpp.textContent = oppScore;

    const youHTML = [];
    const oppHTML = [];
    for (let i = 0; i < PD_ROUNDS; i++) {
      if (i < history.length) {
        const h = history[i];
        const lastClass = (i === history.length - 1 && history.length < PD_ROUNDS) ? ' last' : '';
        youHTML.push(`<div class="move ${h.you}${lastClass}">${h.you}</div>`);
        oppHTML.push(`<div class="move ${h.opp}${lastClass}">${h.opp}</div>`);
      } else {
        youHTML.push(`<div class="move pending">${i + 1}</div>`);
        oppHTML.push(`<div class="move pending">·</div>`);
      }
    }
    movesYou.innerHTML = youHTML.join('');
    movesOpp.innerHTML = oppHTML.join('');

    if (history.length < PD_ROUNDS) {
      roundInd.textContent = `Round ${history.length + 1} of ${PD_ROUNDS} — your move`;
    } else {
      roundInd.textContent = `Match finished — ${PD_ROUNDS} rounds complete`;
    }
  }

  function showSummary() {
    const diff = yourScore - oppScore;
    let msg;
    if (diff > 0) {
      msg = `🏆 You beat ${OPPONENTS[currentOpp].name} by ${diff} points.`;
    } else if (diff < 0) {
      msg = `💔 ${OPPONENTS[currentOpp].name} beat you by ${-diff} points.`;
    } else {
      msg = `🤝 You and ${OPPONENTS[currentOpp].name} tied at ${yourScore}.`;
    }
    // Max possible solo = 20 × 5 = 100 (betray every round vs a doormat).
    // Max mutual     = 20 × 3 = 60   (cooperate every round, achievable only with cooperative opponent).
    const yourCoop = history.filter(h => h.you === 'C').length;
    const oppCoop = history.filter(h => h.opp === 'C').length;
    summaryEl.innerHTML = `
      <strong>${msg}</strong><br>
      Final score · You ${yourScore} / ${PD_ROUNDS * 5} max · Opponent ${oppScore} · Combined ${yourScore + oppScore} / ${PD_ROUNDS * 6} max.<br>
      You cooperated ${yourCoop}/${PD_ROUNDS} times. ${OPPONENTS[currentOpp].name} cooperated ${oppCoop}/${PD_ROUNDS} times.
    `;
    summaryEl.style.display = 'block';
  }

  oppBtns.forEach(btn => {
    btn.addEventListener('click', () => pickOpponent(btn.getAttribute('data-opp')));
  });
  btnCoop.addEventListener('click', () => playRound('C'));
  btnDefect.addEventListener('click', () => playRound('D'));
  btnReset.addEventListener('click', () => reset());

  pickOpponent('tft');
}

// ============================================================================
// Bootstrap
// ============================================================================

initMatrixSim();
initRepeatedPDSim();

// Auctions & voting · mechanism design story
// Four interactive pieces:
//   1. Four voting rules on 122 ballots (plurality, IRV, Borda, Condorcet)
//   2. Agenda-setting with the Condorcet cycle (3 voters, 3 candidates)
//   3. Vickrey vs first-price auction — live profit curves (Monte Carlo)
//   4. Winner's curse — common-value auction with growing field

// ============================================================================
// Shared constants
// ============================================================================

const CAND_COLORS = {
  A: '#4C6EF5',
  B: '#F76707',
  C: '#37B24D',
  D: '#BE4BDB',
};

function candChip(letter, big = false) {
  const cls = big ? `cand ${letter.toLowerCase()} big` : `cand ${letter.toLowerCase()}`;
  return `<span class="${cls}">${letter}</span>`;
}

// Language detection (English by default; `<html lang="zh-Hans">` for Chinese page)
const LANG = (document.documentElement.lang || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
const T = {
  en: {
    pluralityRule: '🥇 Plurality winner',
    pluralityWin: (c, n) => `${candChip(c, true)} wins with ${n} first-place votes`,
    pluralityExplain: 'Each voter\'s top choice gets one vote. Whoever gets the most, wins.',
    pluralityBreak: (c, n) => `${candChip(c)} — <strong>${n}</strong> first-place votes`,
    pluralityNote: 'C wins — but 81 of 122 voters ranked C <em>last</em>. That\'s the plurality pathology in one line.',

    runoffRule: '🔁 Top-two runoff winner',
    runoffWin: (c) => `${candChip(c, true)} wins the final head-to-head`,
    runoffIntro: 'First round: count first-place votes, keep the top two.',
    runoffR1: (list, a, b) => `<strong>Round 1:</strong> ${list} → top 2 are ${candChip(a)} and ${candChip(b)}`,
    runoffR2: (a, b, aw, bw, w) => `<strong>Round 2:</strong> ${candChip(a)} vs ${candChip(b)} straight majority → <strong>${aw}–${bw}</strong>, ${candChip(w)} wins`,
    runoffNote: 'C had the most first-place votes but 81 of 122 voters ranked C <em>last</em>. In the two-way race, everyone-not-for-C swings to B. That\'s the argument for runoffs over plurality — and against plurality in any field of three or more serious candidates.',

    bordaRule: '📊 Borda winner',
    bordaWin: (c) => `${candChip(c, true)} wins on average rank`,
    bordaExplain: '4 candidates → 1st place = 3 pts, 2nd = 2, 3rd = 1, 4th = 0. Sum across all 122 voters.',
    bordaBreak: (c, n) => `${candChip(c)} — <strong>${n}</strong> Borda points`,
    bordaNote: 'D wins without being <em>anyone\'s</em> favourite — but D is almost everyone\'s acceptable second choice, which is exactly what Borda rewards.',

    condorcetRule: '🥊 Condorcet winner',
    condorcetWin: (c) => `${candChip(c, true)} beats every rival one-on-one`,
    condorcetExplain: 'Check every pairwise match. The Condorcet winner wins all of them.',
    condorcetMatch: (a, b, aw, bw, w) => `${candChip(a)} vs ${candChip(b)}: ${aw}–${bw}, ${candChip(w)} wins`,
    condorcetNote: 'A wins all three head-to-heads — yet A has only 26 first-place votes and comes dead last in plurality. "Fewest first choices, but no second choice would rebel against them." Rarely how we actually pick leaders.',

    agendaR1: 'Round 1',
    agendaR2: 'Round 2 · final',
    agendaWinner: '🏆 Overall winner',
    agendaVs: 'vs',
    agendaWin: 'wins',
    agendaWinnerSuffix: '— chosen entirely by the agenda, not by any voter changing their mind.',

    curseCaption: (n, s, cur, total) => `${n} bidders · noise σ=${s} · auction ${cur} of ${total}`,
    curseCaptionDone: (n, s, total) => `${n} bidders · noise σ=${s} · average over ${total} auctions`,
    curseRoundTag: (cur, total) => `${cur} / ${total}`,
    curseWinnerTag: '🏆 WINNER',
    curseTrueValueTag: 'true value = 100',
    curseRunning: (n) => `running avg of ${n}`,
    curseThisAuction: 'this auction',
    curseFinalAvg: (n) => `avg over ${n} auctions`,
    curseRunBtn: '🎲 Replay 50 auctions',
    curseResetBtn: '⏭ Show one draw',
    curseBidderXLabel: null,
    vickreyTruthLabel: 'your true value = 70',
    vickreyBidLabel: (b) => `bid ${b}`,
    vickreyYAxis: 'expected profit',
    vickreyLegendSecond: '— second-price (Vickrey)',
    vickreyLegendFirst: '— first-price (sealed bid)',
  },
  zh: {
    pluralityRule: '🥇 简单多数赢家',
    pluralityWin: (c, n) => `${candChip(c, true)} 以 ${n} 张第一名票胜出`,
    pluralityExplain: '每位选民的首选得一票,票最多者赢。',
    pluralityBreak: (c, n) => `${candChip(c)} —— <strong>${n}</strong> 张第一名票`,
    pluralityNote: 'C 赢了 —— 但 122 位选民中有 81 位把 C 排在<em>最后</em>。简单多数制的病理,一行就说清。',

    runoffRule: '🔁 两轮决选赢家',
    runoffWin: (c) => `${candChip(c, true)} 在决战中胜出`,
    runoffIntro: '第一轮:数第一名票,保留前两位。',
    runoffR1: (list, a, b) => `<strong>第一轮:</strong>${list} → 前两名是 ${candChip(a)} 和 ${candChip(b)}`,
    runoffR2: (a, b, aw, bw, w) => `<strong>第二轮:</strong>${candChip(a)} 对 ${candChip(b)} 直接多数决 → <strong>${aw}–${bw}</strong>,${candChip(w)} 胜出`,
    runoffNote: 'C 的第一名票最多,但 122 位选民中有 81 位把 C 排在<em>最后</em>。在二选一中,所有不选 C 的人全都倒向 B。这就是“决选优于简单多数”的论点 —— 也是“三位及以上候选人时不应再用简单多数”的论据。',

    bordaRule: '📊 Borda 赢家',
    bordaWin: (c) => `${candChip(c, true)} 以平均排名胜出`,
    bordaExplain: '4 位候选人:第 1 名 3 分,第 2 名 2 分,第 3 名 1 分,第 4 名 0 分。对 122 位选民全部累加。',
    bordaBreak: (c, n) => `${candChip(c)} —— <strong>${n}</strong> Borda 分`,
    bordaNote: 'D 赢了,却<em>没有任何人</em>把它排第一 —— 但几乎所有人都能接受把 D 排第二,这正是 Borda 奖励的东西。',

    condorcetRule: '🥊 Condorcet 赢家',
    condorcetWin: (c) => `${candChip(c, true)} 在任何一对一比拼中都不败`,
    condorcetExplain: '检查每一对的两两比拼。Condorcet 赢家必须全部赢下。',
    condorcetMatch: (a, b, aw, bw, w) => `${candChip(a)} 对 ${candChip(b)}:${aw}–${bw},${candChip(w)} 胜`,
    condorcetNote: 'A 在三场一对一中全胜 —— 但 A 只有 26 张第一名票,在简单多数制下垫底。“第一名票最少,但没人愿意联手推翻他。”这几乎从来不是我们现实中挑选领导者的方式。',

    agendaR1: '第一轮',
    agendaR2: '第二轮 · 决战',
    agendaWinner: '🏆 最终赢家',
    agendaVs: '对',
    agendaWin: '胜',
    agendaWinnerSuffix: '—— 完全由议程决定,没有任何一位选民改变心意。',

    curseCaption: (n, s, cur, total) => `${n} 位竞拍者 · 噪声 σ=${s} · 第 ${cur} / ${total} 场拍卖`,
    curseCaptionDone: (n, s, total) => `${n} 位竞拍者 · 噪声 σ=${s} · ${total} 场拍卖的平均`,
    curseRoundTag: (cur, total) => `${cur} / ${total}`,
    curseWinnerTag: '🏆 赢家',
    curseTrueValueTag: '真实价值 = 100',
    curseRunning: (n) => `${n} 场的滚动均值`,
    curseThisAuction: '本场拍卖',
    curseFinalAvg: (n) => `${n} 场的平均`,
    curseRunBtn: '🎲 重跑 50 场拍卖',
    curseResetBtn: '⏭ 看一次抽样',
    curseBidderXLabel: null,
    vickreyTruthLabel: '你的真实估值 = 70',
    vickreyBidLabel: (b) => `出价 ${b}`,
    vickreyYAxis: '期望利润',
    vickreyLegendSecond: '—— 二价拍卖(Vickrey)',
    vickreyLegendFirst: '—— 一价拍卖(密封投标)',
  },
}[LANG];

// ============================================================================
// Part 1 · Four voting rules
// ============================================================================

// The 122-voter profile — chosen so that four rules each pick a different winner.
// Each entry is [count, [first, second, third, fourth]].
const BALLOTS = [
  [38, ['C', 'A', 'D', 'B']],
  [28, ['B', 'D', 'A', 'C']],
  [27, ['D', 'B', 'A', 'C']],
  [26, ['A', 'D', 'B', 'C']],
  [ 3, ['C', 'D', 'A', 'B']],
];
const CANDS = ['A', 'B', 'C', 'D'];

// ---- Plurality -------------------------------------------------------------
function countPlurality() {
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  for (const [n, rank] of BALLOTS) tally[rank[0]] += n;
  const sorted = CANDS.slice().sort((a, b) => tally[b] - tally[a]);
  return { winner: sorted[0], tally, sorted };
}

// ---- Top-two runoff --------------------------------------------------------
// Round 1: count first-place votes. Round 2: everyone votes between the top two.
function countRunoff() {
  // Round 1 — plurality
  const first = { A: 0, B: 0, C: 0, D: 0 };
  for (const [n, rank] of BALLOTS) first[rank[0]] += n;
  const top2 = CANDS.slice().sort((a, b) => first[b] - first[a]).slice(0, 2);

  // Round 2 — pairwise between the top two
  const [x, y] = top2;
  let xWins = 0, yWins = 0;
  for (const [n, rank] of BALLOTS) {
    if (rank.indexOf(x) < rank.indexOf(y)) xWins += n;
    else yWins += n;
  }
  const winner = xWins > yWins ? x : y;
  return { winner, first, top2, finalMatch: { x, y, xWins, yWins } };
}

// ---- Borda count -----------------------------------------------------------
// Rank k (0-indexed from top) earns (n_cands - 1 - k) points.
function countBorda() {
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  for (const [n, rank] of BALLOTS) {
    rank.forEach((cand, k) => {
      tally[cand] += n * (CANDS.length - 1 - k);
    });
  }
  const sorted = CANDS.slice().sort((a, b) => tally[b] - tally[a]);
  return { winner: sorted[0], tally, sorted };
}

// ---- Condorcet -------------------------------------------------------------
// A beats B pairwise if more voters rank A above B than B above A.
// Condorcet winner beats everyone else head-to-head.
function pairwise(x, y) {
  let xWins = 0, yWins = 0;
  for (const [n, rank] of BALLOTS) {
    const xi = rank.indexOf(x), yi = rank.indexOf(y);
    if (xi < yi) xWins += n;
    else         yWins += n;
  }
  return { xWins, yWins };
}
function countCondorcet() {
  const matches = []; // [{a, b, aWins, bWins, winner}]
  const winsBy = { A: 0, B: 0, C: 0, D: 0 };
  for (let i = 0; i < CANDS.length; i++) {
    for (let j = i + 1; j < CANDS.length; j++) {
      const a = CANDS[i], b = CANDS[j];
      const { xWins, yWins } = pairwise(a, b);
      const win = xWins > yWins ? a : b;
      matches.push({ a, b, aWins: xWins, bWins: yWins, winner: win });
      winsBy[win]++;
    }
  }
  // Condorcet winner = beats everyone else = n-1 wins.
  let winner = null;
  for (const c of CANDS) if (winsBy[c] === CANDS.length - 1) winner = c;
  return { winner, matches, winsBy };
}

// ---- Render the winner card ------------------------------------------------
function renderVotingWinner(rule) {
  const card = document.getElementById('winner-card');

  if (rule === 'plurality') {
    const { winner, tally, sorted } = countPlurality();
    const breakdown = sorted.map(c => `<li>${T.pluralityBreak(c, tally[c])}</li>`).join('');
    card.innerHTML = `
      <div class="wc-rule">${T.pluralityRule}</div>
      <div class="wc-winner">${T.pluralityWin(winner, tally[winner])}</div>
      <div class="wc-why">
        ${T.pluralityExplain}
        <ul>${breakdown}</ul>
        <p style="margin:8px 0 0;">${T.pluralityNote}</p>
      </div>
    `;
    return;
  }

  if (rule === 'runoff') {
    const { winner, first, top2, finalMatch } = countRunoff();
    const r1 = CANDS.slice().sort((a, b) => first[b] - first[a])
      .map(c => `${candChip(c)} <strong>${first[c]}</strong>`).join(' &nbsp; ');
    const { x, y, xWins, yWins } = finalMatch;
    card.innerHTML = `
      <div class="wc-rule">${T.runoffRule}</div>
      <div class="wc-winner">${T.runoffWin(winner)}</div>
      <div class="wc-why">
        ${T.runoffIntro}
        <ul>
          <li>${T.runoffR1(r1, top2[0], top2[1])}</li>
          <li>${T.runoffR2(x, y, xWins, yWins, winner)}</li>
        </ul>
        <p style="margin:8px 0 0;">${T.runoffNote}</p>
      </div>
    `;
    return;
  }

  if (rule === 'borda') {
    const { winner, tally, sorted } = countBorda();
    const breakdown = sorted.map(c => `<li>${T.bordaBreak(c, tally[c])}</li>`).join('');
    card.innerHTML = `
      <div class="wc-rule">${T.bordaRule}</div>
      <div class="wc-winner">${T.bordaWin(winner)}</div>
      <div class="wc-why">
        ${T.bordaExplain}
        <ul>${breakdown}</ul>
        <p style="margin:8px 0 0;">${T.bordaNote}</p>
      </div>
    `;
    return;
  }

  if (rule === 'condorcet') {
    const { winner, matches } = countCondorcet();
    const matchHtml = matches.map(m =>
      `<li>${T.condorcetMatch(m.a, m.b, m.aWins, m.bWins, m.winner)}</li>`
    ).join('');
    card.innerHTML = `
      <div class="wc-rule">${T.condorcetRule}</div>
      <div class="wc-winner">${T.condorcetWin(winner)}</div>
      <div class="wc-why">
        ${T.condorcetExplain}
        <ul>${matchHtml}</ul>
        <p style="margin:8px 0 0;">${T.condorcetNote}</p>
      </div>
    `;
    return;
  }
}

// Wire up rule buttons
function wireVotingRules() {
  const buttons = document.querySelectorAll('.rule-row [data-rule]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderVotingWinner(btn.dataset.rule);
    });
  });
  renderVotingWinner('plurality');
}

// ============================================================================
// Part 2 · The Condorcet cycle — agenda-setting
// ============================================================================

// Three voters, three candidates, cyclic preferences:
//   V1: A > B > C
//   V2: B > C > A
//   V3: C > A > B
// A beats B (2-1), B beats C (2-1), C beats A (2-1).  Classic 3-cycle.
const CYCLE_VOTERS = [
  ['A', 'B', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
];

function cyclePairwise(x, y) {
  let xWins = 0, yWins = 0;
  for (const rank of CYCLE_VOTERS) {
    if (rank.indexOf(x) < rank.indexOf(y)) xWins++;
    else yWins++;
  }
  return { xWins, yWins, winner: xWins > yWins ? x : y };
}

const AGENDAS = {
  'ab-c': { first: ['A', 'B'], label: 'A vs B' },
  'bc-a': { first: ['B', 'C'], label: 'B vs C' },
  'ac-b': { first: ['A', 'C'], label: 'A vs C' },
};

function renderAgenda(key) {
  const agenda = AGENDAS[key];
  const [x, y] = agenda.first;
  const round1 = cyclePairwise(x, y);
  const other = CANDS.slice(0, 3).find(c => c !== x && c !== y);
  const round2 = cyclePairwise(round1.winner, other);

  const steps = document.getElementById('agenda-steps');
  steps.innerHTML = `
    <div class="agenda-step on">
      <div class="step-label">${T.agendaR1}</div>
      <div class="step-body">
        ${candChip(x)} <span class="vs">${T.agendaVs}</span> ${candChip(y)}
        <span class="arrow">→</span>
        <strong>${round1.xWins}–${round1.yWins}</strong>
        <span class="arrow">→</span> ${candChip(round1.winner)} ${T.agendaWin}
      </div>
    </div>
    <div class="agenda-step on">
      <div class="step-label">${T.agendaR2}</div>
      <div class="step-body">
        ${candChip(round1.winner)} <span class="vs">${T.agendaVs}</span> ${candChip(other)}
        <span class="arrow">→</span>
        <strong>${round2.xWins}–${round2.yWins}</strong>
        <span class="arrow">→</span> ${candChip(round2.winner)} ${T.agendaWin}
      </div>
    </div>
    <div class="agenda-step winner">
      <div class="step-label">${T.agendaWinner}</div>
      <div class="step-body" style="font-size:18px;">
        ${candChip(round2.winner, true)}
        &nbsp;${T.agendaWinnerSuffix}
      </div>
    </div>
  `;
}

function wireAgenda() {
  const buttons = document.querySelectorAll('#agenda-row [data-agenda]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAgenda(btn.dataset.agenda);
    });
  });
  renderAgenda('ab-c');
}

// ============================================================================
// Part 3 · Vickrey vs first-price — live profit curves
// ============================================================================

const YOUR_VALUE = 70;
const N_RIVALS = 3;
const MC_SAMPLES = 2000;

// Pre-draw rival values once per "scenario" — same random tape used for every bid
// so the curves are smooth as you drag.
let rivalDraws = null;
function freshRivals() {
  rivalDraws = Array.from({ length: MC_SAMPLES }, () =>
    Array.from({ length: N_RIVALS }, () => Math.random() * 100)
  );
}
freshRivals();

// For a given bid, compute expected profit under both auction formats.
// Private-value: your profit if you win = YOUR_VALUE - price_paid.
function auctionProfit(myBid) {
  let secondSum = 0, firstSum = 0;
  for (const rivals of rivalDraws) {
    const maxRival = Math.max(...rivals);
    // You win iff your bid > max rival bid.
    //   In first-price: rivals bid their rival-value * (n-1)/n ≈ 75% for n=4.
    //     Simpler: rivals bid their value (naive). To keep the chart intuitive
    //     and the shading story clean, assume rivals bid their *value* in both
    //     formats. That's the standard pedagogical setup.
    if (myBid > maxRival) {
      secondSum += (YOUR_VALUE - maxRival);     // pay 2nd-highest
      firstSum  += (YOUR_VALUE - myBid);        // pay your bid
    }
    // tie-break: ignore ties (zero-measure)
  }
  return { second: secondSum / MC_SAMPLES, first: firstSum / MC_SAMPLES };
}

// Precompute the whole profit curve across bids 0..100 (every 2 units).
function computeCurves() {
  const bids = [];
  const secondProfit = [];
  const firstProfit = [];
  for (let b = 0; b <= 100; b += 2) {
    const p = auctionProfit(b);
    bids.push(b);
    secondProfit.push(p.second);
    firstProfit.push(p.first);
  }
  return { bids, secondProfit, firstProfit };
}

let curves = computeCurves();

function drawVickrey(bid) {
  const canvas = document.getElementById('vickrey-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = 300;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const padL = 44, padR = 20, padT = 24, padB = 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  // Compute y-scale (profit range)
  const all = [...curves.secondProfit, ...curves.firstProfit];
  let yMin = Math.min(-5, Math.min(...all));
  let yMax = Math.max(2, Math.max(...all)) * 1.1;
  const xToPx = x => padL + (x / 100) * plotW;
  const yToPx = y => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  // Zero line
  ctx.strokeStyle = '#DEE2E8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, yToPx(0)); ctx.lineTo(padL + plotW, yToPx(0));
  ctx.stroke();

  // Shade the "winning the auction" region: your bid must exceed the typical rival max
  // (just a cosmetic hint — the actual math is in the curves themselves)
  // -- skip, the curves speak for themselves.

  // Vertical line at your true value (= 70) — the "truth" line
  ctx.strokeStyle = '#B197FC';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xToPx(YOUR_VALUE), padT); ctx.lineTo(xToPx(YOUR_VALUE), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#7048E8';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(T.vickreyTruthLabel, xToPx(YOUR_VALUE), padT - 6);

  // Draw second-price profit curve (blue)
  function drawCurve(data, color, lw) {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < curves.bids.length; i++) {
      const px = xToPx(curves.bids[i]);
      const py = yToPx(data[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  drawCurve(curves.secondProfit, '#4C6EF5', 3);
  drawCurve(curves.firstProfit,  '#F76707', 3);

  // Current bid marker — vertical line
  ctx.strokeStyle = '#1A1D29';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(xToPx(bid), padT); ctx.lineTo(xToPx(bid), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1A1D29';
  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(T.vickreyBidLabel(bid), xToPx(bid), padT + plotH + 18);

  // Dots at current (bid, profit) on each curve
  const idx = Math.round(bid / 2);
  const sVal = curves.secondProfit[idx];
  const fVal = curves.firstProfit[idx];
  function dot(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
  }
  dot(xToPx(bid), yToPx(sVal), '#4C6EF5');
  dot(xToPx(bid), yToPx(fVal), '#F76707');

  // Axes labels
  ctx.fillStyle = '#6C7382';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(T.vickreyYAxis, padL - 4, padT - 8);
  ctx.textAlign = 'center';
  for (const x of [0, 25, 50, 75, 100]) {
    ctx.fillText(x, xToPx(x), padT + plotH + 32);
  }
  ctx.textAlign = 'right';
  for (const y of [yMin, 0, yMax].map(Math.round)) {
    ctx.fillText(y.toFixed(0), padL - 6, yToPx(y) + 4);
  }

  // Legend
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4C6EF5'; ctx.fillText(T.vickreyLegendSecond, padL + 8, padT + 14);
  ctx.fillStyle = '#F76707'; ctx.fillText(T.vickreyLegendFirst, padL + 8, padT + 30);
}

function updateVickrey(bid) {
  // Update slider display
  const slider = document.getElementById('vickrey-slider');
  const label = slider.closest('.slider-block').querySelector('.slider-label .value');
  label.textContent = bid;

  // Highlight the nudge button matching the current bid (if any)
  document.querySelectorAll('.nudge-btn[data-bid]').forEach(btn => {
    btn.classList.toggle('hero', +btn.dataset.bid === bid);
  });

  // Update profit cards
  const p = auctionProfit(bid);
  document.getElementById('v-second').textContent = p.second.toFixed(2);
  document.getElementById('v-first').textContent  = p.first.toFixed(2);

  drawVickrey(bid);
}

function wireVickrey() {
  const slider = document.getElementById('vickrey-slider');
  slider.addEventListener('input', e => updateVickrey(+e.target.value));

  document.querySelectorAll('.nudge-btn[data-bid]').forEach(btn => {
    btn.addEventListener('click', () => {
      slider.value = btn.dataset.bid;
      updateVickrey(+btn.dataset.bid);
    });
  });

  window.addEventListener('resize', () => updateVickrey(+slider.value));
  updateVickrey(+slider.value);
}

// ============================================================================
// Part 4 · Winner's curse
// ============================================================================

const CURSE_TRUE_VALUE = 100;

// Standard normal via Box-Muller
function randn() {
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Simulate one common-value auction.
// Returns the bidders' estimates and the winner's estimate.
function simulateCurse(n, sigma) {
  const estimates = Array.from({ length: n }, () => CURSE_TRUE_VALUE + sigma * randn());
  const winnerIdx = estimates.indexOf(Math.max(...estimates));
  return { estimates, winnerIdx };
}

// --------------------------------------------------------------------------
// Animation state. Each animation runs `TOTAL_DRAWS` auctions one at a time,
// showing the current auction's bidders on the canvas and updating a *running*
// mean in the metric cards. The number on the card always equals the running
// mean of exactly the auctions you've seen so far — no hidden Monte Carlo.
// --------------------------------------------------------------------------

const TOTAL_DRAWS = 50;
const TICK_MS = 90;             // ~4.5 s for the whole animation

let curseAnim = null;           // see initCurseAnim()
let curseAnimTimer = null;
let curseSliderDebounce = null;

function initCurseAnim(singleShot = false) {
  const n = +document.getElementById('curse-n').value;
  const sigma = +document.getElementById('curse-sigma').value;
  curseAnim = {
    n, sigma,
    singleShot,
    target: singleShot ? 1 : TOTAL_DRAWS,
    completed: 0,
    sumWinBid: 0,
    sumProfit: 0,
    current: null,              // {estimates, winnerIdx}
  };
}

function stopCurseAnim() {
  if (curseAnimTimer) { clearInterval(curseAnimTimer); curseAnimTimer = null; }
}

function startCurseAnim(singleShot = false) {
  stopCurseAnim();
  initCurseAnim(singleShot);
  tickCurse();                  // run first frame immediately
  if (!singleShot) {
    curseAnimTimer = setInterval(tickCurse, TICK_MS);
  }
}

function tickCurse() {
  const s = curseAnim;
  if (s.completed >= s.target) { stopCurseAnim(); drawCurse(); return; }

  const { estimates, winnerIdx } = simulateCurse(s.n, s.sigma);
  const winBid = estimates[winnerIdx];
  s.sumWinBid += winBid;
  s.sumProfit += (CURSE_TRUE_VALUE - winBid);
  s.completed++;
  s.current = { estimates, winnerIdx, winBid };
  drawCurse();

  if (s.completed >= s.target) stopCurseAnim();
}

function drawCurse() {
  if (!curseAnim || !curseAnim.current) return;
  const { n, sigma, target, completed, current, sumWinBid, sumProfit } = curseAnim;
  const { estimates, winnerIdx, winBid } = current;

  const canvas = document.getElementById('curse-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = 340;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const padL = 48, padR = 20, padT = 28, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  // y-scale: pinned around the true value with ±3σ headroom
  const yMin = Math.max(0, CURSE_TRUE_VALUE - 3 * sigma - 10);
  const yMax = CURSE_TRUE_VALUE + 3 * sigma + 10;
  const yToPx = v => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Horizontal "true value" band
  ctx.fillStyle = '#D3F9D8';
  const bandTop = yToPx(CURSE_TRUE_VALUE + 2);
  const bandBot = yToPx(CURSE_TRUE_VALUE - 2);
  ctx.fillRect(padL, bandTop, plotW, bandBot - bandTop);

  // True value line
  ctx.strokeStyle = '#2F9E44';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, yToPx(CURSE_TRUE_VALUE));
  ctx.lineTo(padL + plotW, yToPx(CURSE_TRUE_VALUE));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#2F9E44';
  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(T.curseTrueValueTag, padL + 6, yToPx(CURSE_TRUE_VALUE) - 6);

  // Running-mean line (orange dashed) — where the winner's bid is averaging
  if (completed > 0) {
    const avgWinBid = sumWinBid / completed;
    const y = yToPx(avgWinBid);
    ctx.strokeStyle = 'rgba(247, 103, 7, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(247, 103, 7, 0.9)';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`avg ${avgWinBid.toFixed(1)}`, padL + plotW - 4, y - 4);
  }

  // Bidder columns
  const colW = plotW / (n + 1);
  for (let i = 0; i < n; i++) {
    const cx = padL + colW * (i + 1);
    const est = estimates[i];
    const py = yToPx(est);
    const isWinner = i === winnerIdx;

    ctx.strokeStyle = isWinner ? '#F76707' : '#AAB1BC';
    ctx.lineWidth = isWinner ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cx, yToPx(CURSE_TRUE_VALUE));
    ctx.lineTo(cx, py);
    ctx.stroke();

    ctx.fillStyle = isWinner ? '#F76707' : '#6C7382';
    ctx.beginPath();
    ctx.arc(cx, py, isWinner ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.stroke();

    if (isWinner) {
      ctx.fillStyle = '#F76707';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(T.curseWinnerTag, cx, py - 16);
      ctx.fillText(est.toFixed(1), cx, py - 4);
    }
  }

  // Round counter badge, top-right
  if (target > 1) {
    const badgeTxt = T.curseRoundTag(completed, target);
    ctx.font = '700 12px Inter, sans-serif';
    const tw = ctx.measureText(badgeTxt).width + 16;
    const bx = padL + plotW - tw, by = padT + 4;
    ctx.fillStyle = '#1A1D29';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, tw, 22, 6);
    else ctx.rect(bx, by, tw, 22);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(badgeTxt, bx + tw / 2, by + 15);
  }

  // Y axis labels
  ctx.fillStyle = '#6C7382';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (const y of [yMin, (yMin + yMax) / 2, yMax].map(v => Math.round(v / 10) * 10)) {
    ctx.fillText(y, padL - 6, yToPx(y) + 4);
  }

  // Caption
  ctx.fillStyle = '#6C7382';
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  const done = completed >= target && target > 1;
  const caption = done
    ? T.curseCaptionDone(n, sigma, target)
    : T.curseCaption(n, sigma, completed, target);
  ctx.fillText(caption, padL + plotW / 2, padT + plotH + 22);

  // Metrics — running average over everything we've drawn so far
  const avgWinBid = sumWinBid / Math.max(1, completed);
  const avgProfit = sumProfit / Math.max(1, completed);
  document.getElementById('curse-winbid').textContent = avgWinBid.toFixed(1);
  const profitEl = document.getElementById('curse-profit');
  profitEl.textContent = (avgProfit >= 0 ? '+' : '') + avgProfit.toFixed(1);
  profitEl.style.color = avgProfit >= 0 ? '#2F9E44' : '#E03131';

  // Metric sub-labels — tell the user which number they're looking at
  const subs = document.querySelectorAll('.curse-head .vc-sub');
  if (subs.length >= 3) {
    subs[1].textContent = target > 1
      ? T.curseRunning(completed)
      : T.curseThisAuction;
    subs[2].textContent = target > 1
      ? (done ? T.curseFinalAvg(target) : T.curseRunning(completed))
      : T.curseThisAuction;
  }
}

function wireCurse() {
  const nSlider = document.getElementById('curse-n');
  const sSlider = document.getElementById('curse-sigma');
  const nLabel = nSlider.closest('.slider-block').querySelector('.value');
  const sLabel = sSlider.closest('.slider-block').querySelector('.value');

  const runAnimDebounced = () => {
    nLabel.textContent = nSlider.value;
    sLabel.textContent = sSlider.value;
    clearTimeout(curseSliderDebounce);
    curseSliderDebounce = setTimeout(() => startCurseAnim(false), 180);
  };

  nSlider.addEventListener('input', runAnimDebounced);
  sSlider.addEventListener('input', runAnimDebounced);

  document.getElementById('curse-run').addEventListener('click',
    () => startCurseAnim(false));
  document.getElementById('curse-reset').addEventListener('click',
    () => startCurseAnim(true));

  // Localise the two buttons
  document.getElementById('curse-run').innerHTML = T.curseRunBtn;
  document.getElementById('curse-reset').innerHTML = T.curseResetBtn;

  window.addEventListener('resize', () => drawCurse());

  // Initial animation on page load
  nLabel.textContent = nSlider.value;
  sLabel.textContent = sSlider.value;
  startCurseAnim(false);
}

// ============================================================================
// Boot
// ============================================================================

wireVotingRules();
wireAgenda();
wireVickrey();
wireCurse();

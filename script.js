/**
 * BCH Ecosystem Hall of Fame — script.js v2.0
 * =============================================
 * Live data: Haskoin Store + CoinPaprika (no CORS, no API keys)
 * New in v2: Reputation system, badge progress, profile modal,
 *            largest-donation stat, privacy-first, backend hooks.
 *
 * 🔌 BACKEND hooks marked throughout — search "BACKEND" to find them.
 */

'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  donationAddress: 'bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040',
  haskoinBase:     'https://api.haskoin.com/bch',
  coinpaprikaBase: 'https://api.coinpaprika.com/v1',
  qrApiBase:       'https://api.qrserver.com/v1/create-qr-code/',
  pollInterval:    60000,
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Shown when Haskoin has no real tx yet. Remove once donations arrive.

const MOCK_SUPPORTERS = [
  { address:'bitcoincash:qpzk9d8x5jfnmvt2rlh4wcq3ays6eu7fxg8c0mn3p', totalDonated:5.82, donations:28, joinDate:'2025-11-03', monthlyDonated:1.20, largestDonation:0.80 },
  { address:'bitcoincash:qr9w2elka7v3fhymn5xqjd8tpu4cs6dk0gm1bz7xe', totalDonated:3.45, donations:15, joinDate:'2025-12-18', monthlyDonated:0.80, largestDonation:0.50 },
  { address:'bitcoincash:qze5tmnr8jkd2pcvl6xhf9q0uyw3as4gk7bntc1eh', totalDonated:2.10, donations:11, joinDate:'2026-01-07', monthlyDonated:0.60, largestDonation:0.40 },
  { address:'bitcoincash:qq8fvkjmdhw5rt3nxpcze6yl0ag2s7u4bk9cv1hmp', totalDonated:1.77, donations: 9, joinDate:'2026-02-14', monthlyDonated:0.50, largestDonation:0.35 },
  { address:'bitcoincash:qnxjt7kqp0dhce4rmw8s5uf3lzyvb6ag2m9k4ep1c', totalDonated:1.33, donations: 7, joinDate:'2026-02-28', monthlyDonated:0.45, largestDonation:0.30 },
  { address:'bitcoincash:qpmal3nv8txkejh0qc5d7yre6wf9u2bsgk4fv0pzn', totalDonated:0.95, donations: 6, joinDate:'2026-03-10', monthlyDonated:0.40, largestDonation:0.22 },
  { address:'bitcoincash:qhwev4zkrd9tmqn5jly8x62ufb3psc0agm7e1kvdh', totalDonated:0.58, donations: 4, joinDate:'2026-03-22', monthlyDonated:0.30, largestDonation:0.18 },
  { address:'bitcoincash:qmdu6cl2e7ps9n4rfh5bk3j0wtxqyav8g1n9zkpvc', totalDonated:0.42, donations: 3, joinDate:'2026-04-01', monthlyDonated:0.25, largestDonation:0.15 },
  { address:'bitcoincash:qr2wlknv5ce8mjd7uhf4bpyt3xqs09agk6znm1reh', totalDonated:0.30, donations: 2, joinDate:'2026-04-15', monthlyDonated:0.20, largestDonation:0.18 },
  { address:'bitcoincash:qzk4p8nfhsj0lxmctyd3vewru7b5qa9g2e6c1mn0p', totalDonated:0.15, donations: 1, joinDate:'2026-05-30', monthlyDonated:0.15, largestDonation:0.15 },
];

// ─── STATE ────────────────────────────────────────────────────────────────────

let state = {
  supporters: [],          // processed + sorted supporter objects
  bchPriceUSD: null,
  liveDataLoaded: false,
};

// ─── BADGE SYSTEM v2 ──────────────────────────────────────────────────────────
// Updated order matches brief: Pioneer → Early Backer → Bronze → Silver → Gold → Platinum → Legend

const BADGES = [
  { id:'legend',   label:'BCH Legend',   minDonations:50, color:'#FF6B35', gradient:'linear-gradient(135deg,#FF6B35,#FF9500)', glow:'rgba(255,107,53,0.45)', icon:'👑', description:'50+ donations. An undeniable force shaping BCH history.' },
  { id:'platinum', label:'Platinum',     minDonations:25, color:'#E8E8F0', gradient:'linear-gradient(135deg,#B0B8CC,#E8E8F0)', glow:'rgba(232,232,240,0.4)', icon:'🏆', description:'25+ donations. Elite commitment to the BCH ecosystem.' },
  { id:'gold',     label:'Gold',         minDonations:10, color:'#FFD700', gradient:'linear-gradient(135deg,#F5A623,#FFD700)', glow:'rgba(255,215,0,0.4)',   icon:'🥇', description:'10+ donations. Sustained and generous support.' },
  { id:'silver',   label:'Silver',       minDonations: 5, color:'#C8C8D8', gradient:'linear-gradient(135deg,#909090,#C8C8D8)', glow:'rgba(200,200,216,0.35)',icon:'🥈', description:'5+ donations. Proven dedication to open-source BCH tools.' },
  { id:'bronze',   label:'Bronze',       minDonations: 1, color:'#CD7F32', gradient:'linear-gradient(135deg,#8B4513,#CD7F32)', glow:'rgba(205,127,50,0.35)', icon:'🥉', description:'First donation on-chain. Welcome to the Hall of Fame.' },
  { id:'early',    label:'Early Backer', minDonations: 0, color:'#00C853', gradient:'linear-gradient(135deg,#007E33,#00C853)', glow:'rgba(0,200,83,0.35)',   icon:'🚀', description:'Registered supporter — first transaction pending.' },
  { id:'pioneer',  label:'Pioneer',      minDonations:-1, color:'#4FC3F7', gradient:'linear-gradient(135deg,#0288D1,#4FC3F7)', glow:'rgba(79,195,247,0.3)',  icon:'🌱', description:'Among the first to discover this Hall of Fame.' },
];

/**
 * calculateBadge — determines badge by donation count.
 * @param {number} donations
 * @returns {Object} badge definition
 */
function calculateBadge(donations) {
  for (const b of BADGES) {
    if (donations >= b.minDonations) return b;
  }
  return BADGES[BADGES.length - 1];
}

/**
 * calculateRank — 1-based rank in sorted array.
 */
function calculateRank(supporters, supporter) {
  return supporters.findIndex(s => s.address === supporter.address) + 1;
}

/**
 * getNextBadge — returns the next badge tier and progress %.
 * @param {number} donations
 * @returns {{ next: Object|null, progress: number, remaining: number }}
 */
function getNextBadge(donations) {
  const tiers = [...BADGES].reverse(); // ascending order
  for (let i = 0; i < tiers.length; i++) {
    if (donations < tiers[i].minDonations) {
      const prev = i > 0 ? tiers[i-1].minDonations : 0;
      const target = tiers[i].minDonations;
      const progress = Math.round(((donations - prev) / (target - prev)) * 100);
      return { next: tiers[i], progress: Math.max(0, Math.min(100, progress)), remaining: target - donations };
    }
  }
  return { next: null, progress: 100, remaining: 0 }; // at max tier
}

/**
 * updateBadgeProgress — re-renders the badge progress bars in the badge section.
 * Called after supporters are loaded.
 */
function updateBadgeProgress() {
  // Badge cards are static tiers; progress is shown per-supporter in their modal/card.
  // This function updates any global progress indicators.
  const topSupporter = state.supporters[0];
  if (!topSupporter) return;
  const { next, progress } = getNextBadge(topSupporter.donations);
  const el = document.getElementById('top-badge-progress');
  if (el && next) {
    el.style.width = progress + '%';
  }
}

// ─── REPUTATION LEVEL SYSTEM ──────────────────────────────────────────────────
// Second layer above badges — based on totalDonated + donation count combined score.

const REPUTATION_LEVELS = [
  { id:'legend',   label:'Legend',   minScore:500, color:'#FF6B35', bg:'rgba(255,107,53,0.15)' },
  { id:'champion', label:'Champion', minScore:200, color:'#FFD700', bg:'rgba(255,215,0,0.12)'  },
  { id:'backer',   label:'Backer',   minScore: 80, color:'#C8C8D8', bg:'rgba(200,200,216,0.12)'},
  { id:'builder',  label:'Builder',  minScore: 20, color:'#00C853', bg:'rgba(0,200,83,0.12)'   },
  { id:'supporter',label:'Supporter',minScore:  0, color:'#4FC3F7', bg:'rgba(79,195,247,0.1)'  },
];

/**
 * calculateReputation — score = (totalDonated × 10) + (donations × 5).
 * @param {Object} supporter
 * @returns {Object} reputation level definition
 */
function calculateReputation(supporter) {
  const score = (supporter.totalDonated * 10) + (supporter.donations * 5);
  for (const lvl of REPUTATION_LEVELS) {
    if (score >= lvl.minScore) return lvl;
  }
  return REPUTATION_LEVELS[REPUTATION_LEVELS.length - 1];
}

// ─── LIVE DATA: BCH PRICE (CoinPaprika) ──────────────────────────────────────

async function fetchBCHPrice() {
  try {
    const res = await fetch(`${CONFIG.coinpaprikaBase}/tickers/bch-bitcoin-cash`);
    if (!res.ok) throw new Error('CoinPaprika unavailable');
    const data = await res.json();
    state.bchPriceUSD = data?.quotes?.USD?.price || null;
    updatePriceDisplay();
  } catch(err) {
    console.warn('[HoF] Price fetch failed:', err.message);
  }
}

function updatePriceDisplay() {
  const el = document.getElementById('bch-price');
  if (el && state.bchPriceUSD) {
    el.textContent = `1 BCH ≈ $${state.bchPriceUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    el.style.display = 'inline';
  }
}

// ─── LIVE DATA: HASKOIN ───────────────────────────────────────────────────────

/**
 * fetchLiveTransactions — Haskoin Store, CORS-open, no key required.
 * 🔌 BACKEND: Replace this with your own indexer/webhook when you have one.
 */
async function fetchLiveTransactions() {
  try {
    showStatus('Syncing with BCH blockchain…');
    const res = await fetch(
      `${CONFIG.haskoinBase}/address/${CONFIG.donationAddress}/transactions/full?limit=50&offset=0`
    );
    if (!res.ok) throw new Error(`Haskoin ${res.status}`);
    const txList = await res.json();

    if (!txList || !txList.length) {
      loadMockData();
      return;
    }

    const donorMap = buildDonorMap(txList);
    state.supporters = Object.values(donorMap)
      .sort((a,b) => b.totalDonated - a.totalDonated)
      .map(hydrate);

    state.liveDataLoaded = true;
    showStatus('Live blockchain data ✓', true);
  } catch(err) {
    console.warn('[HoF] Haskoin failed:', err.message, '— using demo data');
    loadMockData();
  }
  renderAll();
}

/**
 * buildDonorMap — parses Haskoin full tx objects into donor records.
 * Supporter data shape:
 * {
 *   address: string,         — BCH address (privacy: only shortened is shown)
 *   totalDonated: number,    — total BCH received from this address
 *   donations: number,       — total tx count from this address
 *   firstSeen: string,       — ISO date of first donation
 *   monthlyDonated: number,  — BCH donated in current calendar month
 *   largestDonation: number, — single largest tx amount
 *   txHistory: Array         — [ { date, amount } ] for profile modal
 * }
 */
function buildDonorMap(txList) {
  const map = {};
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  txList.forEach(tx => {
    if (tx.block === null) return; // skip unconfirmed
    const txDate = tx.time ? new Date(tx.time * 1000) : new Date();
    const isThisMonth = txDate >= monthStart;

    let amountReceived = 0;
    tx.outputs.forEach(out => {
      if (out.address === CONFIG.donationAddress) amountReceived += out.value;
    });
    const bchAmount = amountReceived / 1e8;
    if (bchAmount <= 0) return;

    tx.inputs.forEach(input => {
      const sender = input.address;
      if (!sender || sender === CONFIG.donationAddress) return;

      if (!map[sender]) {
        map[sender] = {
          address: sender,
          totalDonated: 0,
          donations: 0,
          firstSeen: txDate.toISOString().slice(0,10),
          monthlyDonated: 0,
          largestDonation: 0,
          txHistory: [],
        };
      }
      map[sender].totalDonated += bchAmount;
      map[sender].donations += 1;
      if (isThisMonth) map[sender].monthlyDonated += bchAmount;
      if (bchAmount > map[sender].largestDonation) map[sender].largestDonation = bchAmount;
      if (txDate < new Date(map[sender].firstSeen)) map[sender].firstSeen = txDate.toISOString().slice(0,10);
      map[sender].txHistory.push({ date: txDate.toISOString().slice(0,10), amount: bchAmount });
    });
  });

  // Sort each tx history chronologically
  Object.values(map).forEach(s => s.txHistory.sort((a,b) => new Date(a.date) - new Date(b.date)));
  return map;
}

// ─── MOCK DATA LOADER ─────────────────────────────────────────────────────────

function loadMockData() {
  state.supporters = MOCK_SUPPORTERS
    .sort((a,b) => b.totalDonated - a.totalDonated)
    .map(s => ({
      ...s,
      firstSeen: s.joinDate,
      txHistory: Array.from({length: s.donations}, (_,i) => ({
        date: new Date(new Date(s.joinDate).getTime() + i * 7 * 86400000).toISOString().slice(0,10),
        amount: +(s.totalDonated / s.donations).toFixed(6),
      })),
    }))
    .map(hydrate);
  showStatus('Showing demo data — be the first real donor!');
}

/**
 * hydrate — enriches a raw supporter object with computed fields.
 * All display fields derived here — nothing stored in DOM.
 */
function hydrate(s) {
  return {
    ...s,
    badgeDef:    calculateBadge(s.donations),
    reputation:  calculateReputation(s),
    shortAddr:   shortenAddress(s.address),
  };
}

// ─── RENDER: LEADERBOARD ─────────────────────────────────────────────────────

/**
 * renderSupporters — builds leaderboard cards.
 * Privacy: only shortened address shown, never full address in UI text.
 */
function renderSupporters(supporters) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;
  if (!supporters.length) {
    container.innerHTML = `<p class="empty-state">No supporters yet — be the first! 🙌</p>`;
    return;
  }

  container.innerHTML = supporters.map((s, idx) => {
    const rank = idx + 1;
    const badge = s.badgeDef;
    const rep   = s.reputation;
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const rankClass = rank <= 3 ? `rank-top rank-${rank}` : '';
    const usd = state.bchPriceUSD ? ` <span class="usd-val">≈$${Math.round(s.totalDonated * state.bchPriceUSD).toLocaleString()}</span>` : '';
    const { next, progress, remaining } = getNextBadge(s.donations);
    const progressHtml = next
      ? `<div class="badge-progress-wrap" title="Next: ${next.label} (${remaining} more donation${remaining!==1?'s':''})">
           <div class="badge-progress-bar" style="width:${progress}%;background:${next.gradient}"></div>
         </div>`
      : `<div class="badge-progress-wrap max"><div class="badge-progress-bar" style="width:100%;background:${badge.gradient}"></div></div>`;

    return `
      <div class="supporter-row ${rankClass}"
           style="--badge-glow:${badge.glow};--badge-color:${badge.color};"
           data-idx="${idx}"
           role="listitem"
           tabindex="0"
           aria-label="Rank ${rank}: ${s.shortAddr}, ${s.totalDonated.toFixed(4)} BCH donated">
        <div class="supporter-rank">${rankLabel}</div>
        <div class="supporter-info">
          <div class="supporter-name">${escapeHtml(s.shortAddr)}</div>
          <div class="supporter-sub">
            <span class="rep-pill" style="color:${rep.color};background:${rep.bg};">${rep.label}</span>
            <span class="since-label">Since ${formatDate(s.firstSeen || s.joinDate)}</span>
          </div>
          ${progressHtml}
        </div>
        <div class="supporter-meta">
          <div class="supporter-donated">${s.totalDonated.toFixed(4)} <span>BCH${usd}</span></div>
          <div class="supporter-donations">${s.donations} tx${s.donations !== 1 ? 's' : ''}</div>
        </div>
        <div class="supporter-badge tooltip-wrap"
             style="background:${badge.gradient};box-shadow:0 0 14px ${badge.glow};"
             aria-label="${badge.label}: ${badge.description}">
          <span class="badge-icon">${badge.icon}</span>
          <span class="badge-label">${badge.label}</span>
          <div class="tooltip">${badge.description}</div>
        </div>
      </div>`;
  }).join('');

  // Click/keyboard → open modal
  container.querySelectorAll('.supporter-row').forEach((el, i) => {
    el.style.animationDelay = `${i * 50}ms`;
    el.classList.add('animate-in');
    el.addEventListener('click', () => openModal(state.supporters[i]));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(state.supporters[i]); });
  });
}

// ─── RENDER: STATISTICS ───────────────────────────────────────────────────────

/**
 * updateStatistics — computes all stats and animates counters.
 * 🔌 BACKEND: Feed real aggregated data from your DB here.
 */
function updateStatistics(supporters) {
  if (!supporters.length) return;
  const totalBCH     = supporters.reduce((a,s) => a + s.totalDonated, 0);
  const totalDons    = supporters.reduce((a,s) => a + s.donations, 0);
  const avg          = totalDons > 0 ? totalBCH / totalDons : 0;
  const largest      = Math.max(...supporters.map(s => s.largestDonation || 0));
  const thisMonth    = new Date();
  const monthStart   = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const activeWallets = supporters.filter(s => s.monthlyDonated > 0).length;
  const top          = supporters[0];

  animateCounter('stat-total-bch', totalBCH, 4);
  animateCounter('stat-supporters', supporters.length, 0);
  animateCounter('stat-donations', totalDons, 0);
  animateCounter('stat-avg', avg, 4);
  animateCounter('stat-largest', largest, 4);
  animateCounter('stat-active', activeWallets, 0);

  const topEl = document.getElementById('stat-top');
  if (topEl) topEl.textContent = top.shortAddr || shortenAddress(top.address);

  if (state.bchPriceUSD) {
    const usdEl = document.getElementById('stat-total-usd');
    if (usdEl) {
      usdEl.textContent = `≈ $${Math.round(totalBCH * state.bchPriceUSD).toLocaleString()} USD`;
      usdEl.style.display = 'block';
    }
  }

  updateBadgeProgress();
}

// ─── RENDER: MONTHLY CHAMPIONS ────────────────────────────────────────────────

/**
 * renderMonthlyChampions — top 3 by monthlyDonated, plus "fastest rising".
 * 🔌 BACKEND: Query monthly aggregates from your DB for accuracy.
 */
function renderMonthlyChampions(supporters) {
  const container = document.getElementById('monthly-champions');
  if (!container) return;

  const sorted = [...supporters]
    .filter(s => s.monthlyDonated > 0)
    .sort((a,b) => b.monthlyDonated - a.monthlyDonated)
    .slice(0, 3);

  if (!sorted.length) {
    container.innerHTML = `<p class="empty-state">No donations this month yet — be first!</p>`;
    return;
  }

  const podiumIcons = ['👑','🥈','🥉'];
  const podiumLabels = ['Champion','Runner-up','Third Place'];

  container.innerHTML = sorted.map((s,i) => {
    const badge = s.badgeDef;
    const rep   = s.reputation;
    const usd = state.bchPriceUSD ? `<div class="champion-usd">≈ $${Math.round(s.monthlyDonated * state.bchPriceUSD).toLocaleString()}</div>` : '';
    return `
      <div class="champion-card" style="--badge-color:${badge.color};--badge-glow:${badge.glow};animation-delay:${i*100}ms">
        <div class="champion-crown">${podiumIcons[i]}</div>
        <div class="champion-podium-label">${podiumLabels[i]}</div>
        <div class="champion-badge-icon">${badge.icon}</div>
        <div class="champion-name">${escapeHtml(s.shortAddr)}</div>
        <div class="champion-rep" style="color:${rep.color};background:${rep.bg};">${rep.label}</div>
        <div class="champion-amount">${s.monthlyDonated.toFixed(4)} <span>BCH</span></div>
        ${usd}
        <div class="champion-total-note">${s.donations} total donation${s.donations!==1?'s':''}</div>
      </div>`;
  }).join('');
}

// ─── RENDER: BADGE CARDS ─────────────────────────────────────────────────────

function renderBadgeCards() {
  const container = document.getElementById('badge-cards');
  if (!container) return;
  // Show in ascending order (Pioneer → BCH Legend)
  const displayBadges = [...BADGES].reverse();
  container.innerHTML = displayBadges.map((b,i) => `
    <div class="badge-card reveal" style="--badge-gradient:${b.gradient};--badge-glow:${b.glow};--badge-color:${b.color};transition-delay:${i*60}ms">
      <div class="badge-card-glow"></div>
      <div class="badge-card-icon">${b.icon}</div>
      <div class="badge-card-name">${b.label}</div>
      <div class="badge-card-req">${b.minDonations <= 0 ? 'Just join' : b.minDonations + (b.minDonations >= 50 ? '+' : '') + ' donation' + (b.minDonations !== 1 ? 's' : '')}</div>
      <div class="badge-card-desc">${b.description}</div>
    </div>`).join('');
}

// ─── SUPPORTER PROFILE MODAL ─────────────────────────────────────────────────

/**
 * openModal — shows a privacy-safe profile for a supporter.
 * No personal info — only wallet stats and history.
 */
function openModal(s) {
  const modal = document.getElementById('profile-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content) return;

  const badge = s.badgeDef;
  const rep   = s.reputation;
  const { next, progress, remaining } = getNextBadge(s.donations);
  const usd = state.bchPriceUSD ? ` (≈ $${Math.round(s.totalDonated * state.bchPriceUSD).toLocaleString()})` : '';

  const txRows = (s.txHistory || []).slice(-10).reverse().map(tx => {
    const txUsd = state.bchPriceUSD ? ` ≈ $${(tx.amount * state.bchPriceUSD).toFixed(2)}` : '';
    return `<div class="tx-row">
      <span class="tx-date">${formatDate(tx.date)}</span>
      <span class="tx-amount">+${tx.amount.toFixed(6)} BCH${txUsd}</span>
    </div>`;
  }).join('') || '<p class="tx-empty">No transaction history available.</p>';

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-badge" style="background:${badge.gradient};box-shadow:0 0 20px ${badge.glow}">
        <span>${badge.icon}</span>
      </div>
      <div class="modal-title-wrap">
        <h2 class="modal-addr">${escapeHtml(s.shortAddr)}</h2>
        <div class="modal-meta-row">
          <span class="modal-badge-label" style="color:${badge.color}">${badge.label}</span>
          <span class="rep-pill" style="color:${rep.color};background:${rep.bg}">${rep.label}</span>
        </div>
      </div>
    </div>
    <div class="modal-stats-grid">
      <div class="modal-stat"><div class="modal-stat-val">${s.totalDonated.toFixed(4)}</div><div class="modal-stat-label">BCH Donated${usd}</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${s.donations}</div><div class="modal-stat-label">Transactions</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${(s.largestDonation||0).toFixed(4)}</div><div class="modal-stat-label">Largest Single Tx</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${formatDate(s.firstSeen || s.joinDate)}</div><div class="modal-stat-label">First Seen</div></div>
    </div>
    ${next ? `
    <div class="modal-progress-section">
      <div class="modal-progress-label">Progress to ${next.label} ${next.icon}</div>
      <div class="modal-progress-track">
        <div class="modal-progress-fill" style="width:${progress}%;background:${next.gradient}"></div>
      </div>
      <div class="modal-progress-hint">${remaining} more donation${remaining!==1?'s':''} needed</div>
    </div>` : `<div class="modal-max-badge">👑 Maximum badge achieved</div>`}
    <div class="modal-history">
      <h3 class="modal-history-title">Donation Timeline <span>(last ${Math.min(10,s.txHistory?.length||0)} transactions)</span></h3>
      <div class="tx-list">${txRows}</div>
    </div>
    <p class="modal-privacy-note">🔒 Privacy-first — only on-chain data is displayed. No personal information stored.</p>`;

  modal.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('modal-open');
  document.body.style.overflow = '';
}

function initModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ─── RENDER ALL ───────────────────────────────────────────────────────────────

function renderAll() {
  renderSupporters(state.supporters);
  updateStatistics(state.supporters);
  renderMonthlyChampions(state.supporters);
}

// ─── STATUS ───────────────────────────────────────────────────────────────────

function showStatus(msg, success = false) {
  const el = document.getElementById('data-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'data-status ' + (success ? 'status-ok' : 'status-loading');
  el.style.display = 'inline-flex';
}

// ─── QR CODE ─────────────────────────────────────────────────────────────────

function renderQRCode(address) {
  const img = document.getElementById('qr-image');
  if (!img) return;
  img.src = `${CONFIG.qrApiBase}?size=200x200&data=${encodeURIComponent(address)}&bgcolor=0a0e1a&color=4caf50&qzone=2&format=svg`;
}

// ─── COPY BUTTON ─────────────────────────────────────────────────────────────

function initCopyButton() {
  const btn = document.getElementById('copy-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(CONFIG.donationAddress); }
    catch { const ta = document.createElement('textarea'); ta.value = CONFIG.donationAddress; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    btn.classList.add('copied');
    btn.querySelector('.copy-label').textContent = 'Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.querySelector('.copy-label').textContent = 'Copy Address'; }, 2000);
  });
}

// ─── HERO CANVAS ─────────────────────────────────────────────────────────────

function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
  const makeP  = () => ({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.4+0.3, vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3, alpha:Math.random()*.5+.2 });
  function draw() {
    ctx.clearRect(0,0,W,H);
    for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) {
      const d=Math.hypot(particles[i].x-particles[j].x,particles[i].y-particles[j].y);
      if(d<110){ctx.beginPath();ctx.strokeStyle=`rgba(0,200,83,${.1*(1-d/110)})`;ctx.lineWidth=.5;ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.stroke();}
    }
    particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(76,175,80,${p.alpha})`;ctx.fill();p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;});
    requestAnimationFrame(draw);
  }
  resize(); particles=Array.from({length:75},makeP); draw();
  window.addEventListener('resize', resize);
}

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────

function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('revealed');obs.unobserve(e.target);} });
  }, {threshold:0.08});
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ─── NAV + MOBILE MENU ───────────────────────────────────────────────────────

function initNav() {
  const nav = document.querySelector('.nav');
  const burger = document.getElementById('nav-burger');
  const menu   = document.getElementById('nav-menu');

  window.addEventListener('scroll', () => nav.classList.toggle('nav-scrolled', window.scrollY > 40), {passive:true});

  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('nav-menu-open');
      burger.setAttribute('aria-expanded', open);
    });
    // Close menu on link click
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('nav-menu-open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}
    });
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('toast-show'));
  setTimeout(()=>{t.classList.remove('toast-show');t.addEventListener('transitionend',()=>t.remove());},3000);
}

// ─── COUNTER ANIMATION ───────────────────────────────────────────────────────

function animateCounter(id, target, decimals=0) {
  const el = document.getElementById(id);
  if(!el) return;
  const start = performance.now(), dur = 1200;
  function tick(now) {
    const p = Math.min((now-start)/dur,1), ease=1-Math.pow(1-p,3);
    el.textContent=(target*ease).toFixed(decimals);
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

// Privacy-first: only ever show shortened address in UI
function shortenAddress(addr) {
  if(!addr) return '—';
  const c = addr.replace('bitcoincash:','');
  return `${c.slice(0,6)}…${c.slice(-5)}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if(!d) return '—';
  return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
}

// ─── BACKEND HOOKS (ready for wiring) ────────────────────────────────────────

/**
 * fetchNewDonations — poll for new transactions since last check.
 * 🔌 BACKEND: Call your indexer or webhook receiver here.
 */
async function fetchNewDonations() {
  // TODO: fetch only new txs since state.lastChecked timestamp
  // const res = await fetch(`${CONFIG.haskoinBase}/address/${CONFIG.donationAddress}/transactions?since=${state.lastChecked}`);
  await fetchLiveTransactions();
}

/**
 * syncBlockchainData — full resync of all historical transactions.
 * 🔌 BACKEND: Use pagination to fetch all tx history in batches.
 */
async function syncBlockchainData() {
  // TODO: paginate through Haskoin with offset=0,50,100... until exhausted
  await fetchLiveTransactions();
}

/**
 * updateLeaderboard — triggers a full re-render after data update.
 * 🔌 BACKEND: Call this after any Supabase/Firebase listener fires.
 */
function updateLeaderboard() {
  state.supporters.sort((a,b) => b.totalDonated - a.totalDonated);
  renderAll();
}

// ─── POLLING ─────────────────────────────────────────────────────────────────

function startPolling() {
  setInterval(async () => {
    await Promise.all([fetchNewDonations(), fetchBCHPrice()]);
    updateLeaderboard();
  }, CONFIG.pollInterval);
}

// ─── INIT ────────────────────────────────────────────────────────────────────

async function init() {
  initNav();
  initHeroCanvas();
  renderBadgeCards();
  initScrollReveal();
  initCopyButton();
  initModal();
  renderQRCode(CONFIG.donationAddress);

  document.querySelectorAll('.donation-address-text').forEach(el => el.textContent = CONFIG.donationAddress);
  const monthEl = document.getElementById('current-month');
  if (monthEl) monthEl.textContent = getCurrentMonth();

  await Promise.all([fetchBCHPrice(), fetchLiveTransactions()]);
  updateStatistics(state.supporters);
  startPolling();
}

document.addEventListener('DOMContentLoaded', init);

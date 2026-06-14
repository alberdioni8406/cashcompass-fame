/**
 * BCH Ecosystem Hall of Fame — script.js
 * Live data: Haskoin Store (api.haskoin.com/bch) + CoinPaprika fallback
 * No CORS issues — both APIs are open and free.
 */

'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  donationAddress: 'bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040',
  // Haskoin Store — open BCH indexer, no API key, no CORS issues
  haskoinBase: 'https://api.haskoin.com/bch',
  // CoinPaprika — free, no key, no CORS
  coinpaprikaBase: 'https://api.coinpaprika.com/v1',
  // QR code
  qrApiBase: 'https://api.qrserver.com/v1/create-qr-code/',
  // Polling interval for live updates (ms)
  pollInterval: 60000,
};

// ─── MOCK DATA (fallback when Haskoin has no real transactions yet) ───────────
// Replace / remove these once real donations start arriving.

const MOCK_SUPPORTERS = [
  { address: 'bitcoincash:qpzk9d8x5jfnmvt2rlh4wcq3ays6eu7fxg8c0mn3p', displayName: 'BCH Maximalist',      totalDonated: 5.82, donations: 28, joinDate: '2025-11-03', monthlyDonated: 1.20 },
  { address: 'bitcoincash:qr9w2elka7v3fhymn5xqjd8tpu4cs6dk0gm1bz7xe', displayName: 'CashCrusader',        totalDonated: 3.45, donations: 15, joinDate: '2025-12-18', monthlyDonated: 0.80 },
  { address: 'bitcoincash:qze5tmnr8jkd2pcvl6xhf9q0uyw3as4gk7bntc1eh', displayName: 'Peer-to-Peer Pioneer', totalDonated: 2.10, donations: 11, joinDate: '2026-01-07', monthlyDonated: 0.60 },
  { address: 'bitcoincash:qq8fvkjmdhw5rt3nxpcze6yl0ag2s7u4bk9cv1hmp', displayName: 'SatoshiVision',        totalDonated: 1.77, donations:  9, joinDate: '2026-02-14', monthlyDonated: 0.50 },
  { address: 'bitcoincash:qnxjt7kqp0dhce4rmw8s5uf3lzyvb6ag2m9k4ep1c', displayName: 'GreenChainGuru',       totalDonated: 1.33, donations:  7, joinDate: '2026-02-28', monthlyDonated: 0.45 },
  { address: 'bitcoincash:qpmal3nv8txkejh0qc5d7yre6wf9u2bsgk4fv0pzn', displayName: 'CashToken Wizard',     totalDonated: 0.95, donations:  6, joinDate: '2026-03-10', monthlyDonated: 0.40 },
  { address: 'bitcoincash:qhwev4zkrd9tmqn5jly8x62ufb3psc0agm7e1kvdh', displayName: 'ScalabilitySteve',     totalDonated: 0.58, donations:  4, joinDate: '2026-03-22', monthlyDonated: 0.30 },
  { address: 'bitcoincash:qmdu6cl2e7ps9n4rfh5bk3j0wtxqyav8g1n9zkpvc', displayName: 'MicroPaymentMike',     totalDonated: 0.42, donations:  3, joinDate: '2026-04-01', monthlyDonated: 0.25 },
  { address: 'bitcoincash:qr2wlknv5ce8mjd7uhf4bpyt3xqs09agk6znm1reh', displayName: 'AdoptionAdvocate',     totalDonated: 0.30, donations:  2, joinDate: '2026-04-15', monthlyDonated: 0.20 },
  { address: 'bitcoincash:qzk4p8nfhsj0lxmctyd3vewru7b5qa9g2e6c1mn0p', displayName: 'NewcomerNadia',        totalDonated: 0.15, donations:  1, joinDate: '2026-05-30', monthlyDonated: 0.15 },
];

// ─── STATE ────────────────────────────────────────────────────────────────────

let state = {
  supporters: [],
  bchPriceUSD: null,
  liveDataLoaded: false,
};

// ─── BADGE SYSTEM ─────────────────────────────────────────────────────────────

const BADGES = [
  { id: 'legend',   label: 'BCH Legend', minDonations: 50, color: '#FF6B35', gradient: 'linear-gradient(135deg,#FF6B35,#FF9500)', glow: 'rgba(255,107,53,0.4)',   icon: '🏆', description: 'An unstoppable force for BCH adoption. Legendary status.' },
  { id: 'platinum', label: 'Platinum',   minDonations: 25, color: '#E8E8F0', gradient: 'linear-gradient(135deg,#C8C8D8,#E8E8F0)', glow: 'rgba(232,232,240,0.35)', icon: '💎', description: 'Elite contributor. Platinum-tier commitment to the ecosystem.' },
  { id: 'gold',     label: 'Gold',       minDonations: 10, color: '#FFD700', gradient: 'linear-gradient(135deg,#F5A623,#FFD700)', glow: 'rgba(255,215,0,0.35)',   icon: '⭐', description: 'Consistent and generous. Gold-level trust in BCH.' },
  { id: 'silver',   label: 'Silver',     minDonations:  5, color: '#C0C0C0', gradient: 'linear-gradient(135deg,#A0A0A0,#D8D8D8)', glow: 'rgba(192,192,192,0.3)', icon: '🥈', description: 'Proven supporter with growing dedication to BCH tools.' },
  { id: 'bronze',   label: 'Bronze',     minDonations:  1, color: '#CD7F32', gradient: 'linear-gradient(135deg,#A0522D,#CD7F32)', glow: 'rgba(205,127,50,0.3)',  icon: '🥉', description: 'Every journey starts here. Welcome to the Hall of Fame.' },
];

/**
 * calculateBadge — returns badge tier by donation count.
 * @param {number} donations
 * @returns {Object} badge definition
 */
function calculateBadge(donations) {
  for (const badge of BADGES) {
    if (donations >= badge.minDonations) return badge;
  }
  return BADGES[BADGES.length - 1];
}

/**
 * calculateRank — 1-based rank by position in sorted array.
 * @param {Array} supporters
 * @param {Object} supporter
 * @returns {number}
 */
function calculateRank(supporters, supporter) {
  return supporters.findIndex(s => s.address === supporter.address) + 1;
}

// ─── LIVE DATA: BCH PRICE ─────────────────────────────────────────────────────

/**
 * fetchBCHPrice — tries CoinPaprika first (free, no CORS).
 * Falls back gracefully if unavailable.
 */
async function fetchBCHPrice() {
  try {
    const res = await fetch(`${CONFIG.coinpaprikaBase}/tickers/bch-bitcoin-cash`);
    if (!res.ok) throw new Error('CoinPaprika unavailable');
    const data = await res.json();
    state.bchPriceUSD = data?.quotes?.USD?.price || null;
    updatePriceDisplay();
  } catch (err) {
    console.warn('[HoF] Price fetch failed:', err.message);
  }
}

function updatePriceDisplay() {
  const el = document.getElementById('bch-price');
  if (el && state.bchPriceUSD) {
    el.textContent = `1 BCH ≈ $${state.bchPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    el.style.display = 'inline';
  }
}

// ─── LIVE DATA: HASKOIN TRANSACTIONS ─────────────────────────────────────────

/**
 * fetchLiveTransactions — pulls all transactions to the donation address
 * from Haskoin Store. Builds supporter list from on-chain data.
 *
 * Haskoin endpoint: GET /address/{address}/transactions
 * Returns array of tx objects with inputs/outputs and confirmations.
 */
async function fetchLiveTransactions() {
  try {
    showStatus('Syncing with BCH blockchain…');

    // Fetch transaction list for the donation address
    const txListRes = await fetch(
      `${CONFIG.haskoinBase}/address/${CONFIG.donationAddress}/transactions/full?limit=50&offset=0`
    );

    if (!txListRes.ok) throw new Error(`Haskoin ${txListRes.status}`);
    const txList = await txListRes.json();

    if (!txList || !txList.length) {
      console.info('[HoF] No on-chain transactions yet — using mock data.');
      loadMockData();
      return;
    }

    // Parse transactions into donor records
    const donorMap = buildDonorMap(txList);
    state.supporters = Object.values(donorMap)
      .sort((a, b) => b.totalDonated - a.totalDonated)
      .map(s => ({ ...s, badgeDef: calculateBadge(s.donations) }));

    state.liveDataLoaded = true;
    showStatus('Live blockchain data loaded ✓', true);

  } catch (err) {
    console.warn('[HoF] Haskoin fetch failed:', err.message, '— using mock data.');
    loadMockData();
  }

  renderAll();
}

/**
 * buildDonorMap — groups Haskoin transactions by sender address.
 * Each tx input that isn't the donation address itself is a donor.
 *
 * @param {Array} txList — array of full transaction objects from Haskoin
 * @returns {Object} map of address → donor record
 */
function buildDonorMap(txList) {
  const map = {};
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  txList.forEach(tx => {
    // Skip unconfirmed if desired (remove check to include mempool)
    if (tx.block === null) return;

    const txDate = tx.time ? new Date(tx.time * 1000) : new Date();
    const isThisMonth = txDate >= monthStart;

    // Each input address that sent funds to our address is a donor
    tx.inputs.forEach(input => {
      const senderAddr = input.address;
      if (!senderAddr || senderAddr === CONFIG.donationAddress) return;

      // Calculate how much of this input went to our donation address
      let amountReceived = 0;
      tx.outputs.forEach(out => {
        if (out.address === CONFIG.donationAddress) {
          amountReceived += out.value; // value is in satoshis
        }
      });

      const bchAmount = amountReceived / 1e8;

      if (!map[senderAddr]) {
        map[senderAddr] = {
          address: senderAddr,
          displayName: shortenAddress(senderAddr),
          totalDonated: 0,
          donations: 0,
          monthlyDonated: 0,
          joinDate: txDate.toISOString().slice(0, 10),
        };
      }

      map[senderAddr].totalDonated += bchAmount;
      map[senderAddr].donations += 1;
      if (isThisMonth) map[senderAddr].monthlyDonated += bchAmount;

      // Keep earliest date as joinDate
      if (txDate < new Date(map[senderAddr].joinDate)) {
        map[senderAddr].joinDate = txDate.toISOString().slice(0, 10);
      }
    });
  });

  return map;
}

// ─── MOCK DATA LOADER ─────────────────────────────────────────────────────────

function loadMockData() {
  state.supporters = MOCK_SUPPORTERS
    .sort((a, b) => b.totalDonated - a.totalDonated)
    .map(s => ({ ...s, badgeDef: calculateBadge(s.donations) }));
  showStatus('Showing demo data — donate to appear here!');
}

// ─── RENDER: LEADERBOARD ──────────────────────────────────────────────────────

/**
 * renderSupporters — builds the leaderboard DOM from the supporters array.
 * @param {Array} supporters
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
    const badge = s.badgeDef || calculateBadge(s.donations);
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const rankClass = rank <= 3 ? `rank-top rank-${rank}` : '';
    const usdVal = state.bchPriceUSD ? ` ≈ $${(s.totalDonated * state.bchPriceUSD).toLocaleString('en-US',{maximumFractionDigits:0})}` : '';

    return `
      <div class="supporter-row ${rankClass}" style="--badge-glow:${badge.glow};--badge-color:${badge.color};">
        <div class="supporter-rank">${rankLabel}</div>
        <div class="supporter-info">
          <div class="supporter-name">${escapeHtml(s.displayName || shortenAddress(s.address))}</div>
          <div class="supporter-address">${shortenAddress(s.address)}</div>
        </div>
        <div class="supporter-meta">
          <div class="supporter-donated">${s.totalDonated.toFixed(4)} <span>BCH${usdVal}</span></div>
          <div class="supporter-donations">${s.donations} donation${s.donations !== 1 ? 's' : ''}</div>
        </div>
        <div class="supporter-badge" style="background:${badge.gradient};box-shadow:0 0 12px ${badge.glow};">
          <span>${badge.icon}</span>
          <span class="badge-label">${badge.label}</span>
        </div>
        <div class="supporter-date">Since ${formatDate(s.joinDate)}</div>
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.supporter-row').forEach((el, i) => {
      el.style.animationDelay = `${i * 55}ms`;
      el.classList.add('animate-in');
    });
  });
}

// ─── RENDER: STATISTICS ───────────────────────────────────────────────────────

/**
 * updateStatistics — computes and animates global stats counters.
 * @param {Array} supporters
 */
function updateStatistics(supporters) {
  if (!supporters.length) return;
  const totalBCH      = supporters.reduce((s, x) => s + x.totalDonated, 0);
  const totalDonations = supporters.reduce((s, x) => s + x.donations, 0);
  const avgDonation   = totalDonations > 0 ? totalBCH / totalDonations : 0;
  const topSupporter  = supporters[0];

  animateCounter('stat-total-bch', totalBCH, 4);
  animateCounter('stat-supporters', supporters.length, 0);
  animateCounter('stat-donations', totalDonations, 0);
  animateCounter('stat-avg', avgDonation, 4);

  const topEl = document.getElementById('stat-top');
  if (topEl) topEl.textContent = topSupporter.displayName || shortenAddress(topSupporter.address);

  // USD value of total donated
  if (state.bchPriceUSD) {
    const usdEl = document.getElementById('stat-total-usd');
    if (usdEl) {
      usdEl.textContent = `≈ $${(totalBCH * state.bchPriceUSD).toLocaleString('en-US',{maximumFractionDigits:0})} USD`;
      usdEl.style.display = 'block';
    }
  }
}

// ─── RENDER: MONTHLY CHAMPIONS ────────────────────────────────────────────────

/**
 * renderMonthlyChampions — top 3 by monthlyDonated.
 * @param {Array} supporters
 */
function renderMonthlyChampions(supporters) {
  const container = document.getElementById('monthly-champions');
  if (!container) return;

  const champions = [...supporters]
    .filter(s => s.monthlyDonated > 0)
    .sort((a, b) => b.monthlyDonated - a.monthlyDonated)
    .slice(0, 3);

  if (!champions.length) {
    container.innerHTML = `<p class="empty-state">No donations this month yet — be the first!</p>`;
    return;
  }

  const labels = ['🥇 Champion', '🥈 Runner-up', '🥉 Third Place'];
  container.innerHTML = champions.map((s, i) => {
    const badge = s.badgeDef || calculateBadge(s.donations);
    return `
      <div class="champion-card" style="--badge-color:${badge.color};--badge-glow:${badge.glow};animation-delay:${i*120}ms">
        <div class="champion-podium">${labels[i] || `#${i+1}`}</div>
        <div class="champion-icon">${badge.icon}</div>
        <div class="champion-name">${escapeHtml(s.displayName || shortenAddress(s.address))}</div>
        <div class="champion-address">${shortenAddress(s.address)}</div>
        <div class="champion-amount">${s.monthlyDonated.toFixed(4)} <span>BCH this month</span></div>
      </div>`;
  }).join('');
}

// ─── RENDER: BADGE CARDS ──────────────────────────────────────────────────────

function renderBadgeCards() {
  const container = document.getElementById('badge-cards');
  if (!container) return;
  container.innerHTML = [...BADGES].reverse().map(b => `
    <div class="badge-card reveal" style="--badge-gradient:${b.gradient};--badge-glow:${b.glow};--badge-color:${b.color};">
      <div class="badge-card-glow"></div>
      <div class="badge-card-icon">${b.icon}</div>
      <div class="badge-card-name">${b.label}</div>
      <div class="badge-card-req">${b.minDonations}${b.minDonations >= 50 ? '+' : ''} donation${b.minDonations !== 1 ? 's' : ''}</div>
      <div class="badge-card-desc">${b.description}</div>
    </div>`).join('');
}

// ─── RENDER ALL ───────────────────────────────────────────────────────────────

function renderAll() {
  renderSupporters(state.supporters);
  updateStatistics(state.supporters);
  renderMonthlyChampions(state.supporters);
}

// ─── STATUS BAR ───────────────────────────────────────────────────────────────

function showStatus(msg, success = false) {
  const el = document.getElementById('data-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'data-status ' + (success ? 'status-ok' : 'status-loading');
  el.style.display = 'inline-flex';
}

// ─── QR CODE ──────────────────────────────────────────────────────────────────

function renderQRCode(address) {
  const img = document.getElementById('qr-image');
  if (!img) return;
  img.src = `${CONFIG.qrApiBase}?size=200x200&data=${encodeURIComponent(address)}&bgcolor=0a0e1a&color=4caf50&qzone=2&format=svg`;
  img.alt = `QR code for ${address}`;
}

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────

function initCopyButton() {
  const btn = document.getElementById('copy-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.donationAddress);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = CONFIG.donationAddress;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btn.classList.add('copied');
    btn.querySelector('.copy-label').textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.querySelector('.copy-label').textContent = 'Copy Address';
    }, 2000);
  });
}

// ─── HERO CANVAS ──────────────────────────────────────────────────────────────

function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function makeParticle() {
    return { x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.4+0.3,
             vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, alpha: Math.random()*0.5+0.2 };
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    for (let i=0; i<particles.length; i++) {
      for (let j=i+1; j<particles.length; j++) {
        const d = Math.hypot(particles[i].x-particles[j].x, particles[i].y-particles[j].y);
        if (d < 110) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,200,83,${0.1*(1-d/110)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(76,175,80,${p.alpha})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x<0||p.x>W) p.vx*=-1;
      if (p.y<0||p.y>H) p.vy*=-1;
    });
    requestAnimationFrame(draw);
  }

  resize();
  particles = Array.from({length:80}, makeParticle);
  draw();
  window.addEventListener('resize', resize);
}

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────

function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

function initNav() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => nav.classList.toggle('nav-scrolled', window.scrollY > 40), {passive:true});
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({behavior:'smooth',block:'start'}); }
    });
  });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => { t.classList.remove('toast-show'); t.addEventListener('transitionend', () => t.remove()); }, 3000);
}

// ─── COUNTER ANIMATION ────────────────────────────────────────────────────────

function animateCounter(id, target, decimals=0) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const duration = 1100;
  function tick(now) {
    const p = Math.min((now-start)/duration, 1);
    const eased = 1 - Math.pow(1-p, 3);
    el.textContent = (target * eased).toFixed(decimals);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function shortenAddress(addr) {
  if (!addr) return '—';
  const c = addr.replace('bitcoincash:','');
  return `${c.slice(0,8)}…${c.slice(-6)}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
}

// ─── POLLING ──────────────────────────────────────────────────────────────────

function startPolling() {
  setInterval(async () => {
    await fetchLiveTransactions();
    await fetchBCHPrice();
  }, CONFIG.pollInterval);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  initNav();
  initHeroCanvas();
  initScrollReveal();
  initCopyButton();
  renderBadgeCards();
  renderQRCode(CONFIG.donationAddress);

  // Set static text
  document.querySelectorAll('.donation-address-text').forEach(el => el.textContent = CONFIG.donationAddress);
  const monthEl = document.getElementById('current-month');
  if (monthEl) monthEl.textContent = getCurrentMonth();

  // Fetch price and live tx data in parallel
  await Promise.all([fetchBCHPrice(), fetchLiveTransactions()]);

  // Re-render stats with price once both are loaded
  updateStatistics(state.supporters);

  // Poll for updates
  startPolling();
}

document.addEventListener('DOMContentLoaded', init);

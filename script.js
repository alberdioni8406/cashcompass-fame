/**
 * BCH Ecosystem Hall of Fame — script.js
 * =========================================
 * Pure vanilla JS. No framework dependencies.
 *
 * BACKEND INTEGRATION POINTS are marked with:
 *   🔌 BACKEND: <description of what to swap in>
 *
 * Architecture ready for:
 *   - Haskoin Store (api.haskoin.com/bch)
 *   - Supabase real-time subscriptions
 *   - Firebase Firestore
 *   - Custom REST API
 */

'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  donationAddress: 'bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040',
  dataPath: './data/supporters.json',
  // 🔌 BACKEND: Replace with your live API endpoint
  apiEndpoint: null,
  // 🔌 BACKEND: Polling interval in ms (used when apiEndpoint is set)
  pollInterval: 30000,
  qrApiBase: 'https://api.qrserver.com/v1/create-qr-code/',
};

// ─── BADGE SYSTEM ────────────────────────────────────────────────────────────

const BADGES = [
  {
    id: 'legend',
    label: 'BCH Legend',
    minDonations: 50,
    color: '#FF6B35',
    gradient: 'linear-gradient(135deg, #FF6B35, #FF9500)',
    glow: 'rgba(255,107,53,0.4)',
    icon: '🏆',
    description: 'An unstoppable force for BCH adoption. Legendary status.',
  },
  {
    id: 'platinum',
    label: 'Platinum',
    minDonations: 25,
    color: '#E8E8F0',
    gradient: 'linear-gradient(135deg, #C8C8D8, #E8E8F0)',
    glow: 'rgba(232,232,240,0.35)',
    icon: '💎',
    description: 'Elite contributor. Platinum-tier commitment to the ecosystem.',
  },
  {
    id: 'gold',
    label: 'Gold',
    minDonations: 10,
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #F5A623, #FFD700)',
    glow: 'rgba(255,215,0,0.35)',
    icon: '⭐',
    description: 'Consistent and generous. Gold-level trust in BCH.',
  },
  {
    id: 'silver',
    label: 'Silver',
    minDonations: 5,
    color: '#C0C0C0',
    gradient: 'linear-gradient(135deg, #A0A0A0, #D8D8D8)',
    glow: 'rgba(192,192,192,0.3)',
    icon: '🥈',
    description: 'Proven supporter with growing dedication to BCH tools.',
  },
  {
    id: 'bronze',
    label: 'Bronze',
    minDonations: 1,
    color: '#CD7F32',
    gradient: 'linear-gradient(135deg, #A0522D, #CD7F32)',
    glow: 'rgba(205,127,50,0.3)',
    icon: '🥉',
    description: 'Every journey starts here. Welcome to the Hall of Fame.',
  },
];

/**
 * calculateBadge — determines badge tier by donation count.
 * @param {number} donations — total number of donations made
 * @returns {Object} badge definition object
 *
 * 🔌 BACKEND: Call this after each new transaction is detected.
 */
function calculateBadge(donations) {
  for (const badge of BADGES) {
    if (donations >= badge.minDonations) return badge;
  }
  return BADGES[BADGES.length - 1];
}

/**
 * calculateRank — returns ordinal rank position (1st, 2nd…)
 * @param {Array} supporters — sorted supporters array
 * @param {Object} supporter — the supporter to rank
 * @returns {number} 1-based rank
 *
 * 🔌 BACKEND: Re-run after each leaderboard update.
 */
function calculateRank(supporters, supporter) {
  return supporters.findIndex(s => s.id === supporter.id) + 1;
}

// ─── DATA LAYER ──────────────────────────────────────────────────────────────

let state = {
  supporters: [],
  monthlyChampionIds: [],
  currentMonth: '',
  loaded: false,
};

/**
 * loadData — fetches supporter data.
 * Currently loads from local JSON. Swap CONFIG.apiEndpoint to use a live API.
 *
 * 🔌 BACKEND: Replace fetch(CONFIG.dataPath) with fetch(CONFIG.apiEndpoint)
 *             Response shape should match data/supporters.json schema.
 */
async function loadData() {
  try {
    // 🔌 BACKEND: Switch to live API:
    // const url = CONFIG.apiEndpoint || CONFIG.dataPath;
    const url = CONFIG.dataPath;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Hydrate badges in case data comes from a backend without pre-computed badges
    state.supporters = json.supporters
      .map(s => ({
        ...s,
        badge: calculateBadge(s.donations).label,
        badgeDef: calculateBadge(s.donations),
      }))
      .sort((a, b) => b.totalDonated - a.totalDonated);

    state.monthlyChampionIds = json.monthlyChampions?.topDonors || [];
    state.currentMonth = json.monthlyChampions?.month || getCurrentMonth();
    state.loaded = true;

    return state;
  } catch (err) {
    console.error('[HoF] Failed to load data:', err);
    showDataError();
    return null;
  }
}

/**
 * startPolling — polls the API on an interval for live updates.
 * 🔌 BACKEND: Enable this once a live API endpoint is configured.
 *             Alternatively replace with a Supabase realtime subscription.
 */
function startPolling() {
  if (!CONFIG.apiEndpoint) return; // disabled until backend is ready
  setInterval(async () => {
    const fresh = await loadData();
    if (fresh) {
      renderSupporters(state.supporters);
      updateStatistics(state.supporters);
      renderMonthlyChampions(state.supporters, state.monthlyChampionIds);
    }
  }, CONFIG.pollInterval);
}

/**
 * onNewTransaction — called when a new BCH transaction is detected.
 * 🔌 BACKEND: Wire this to your webhook / Haskoin websocket / Supabase trigger.
 *
 * @param {Object} tx — { fromAddress, amountBCH, txid, timestamp }
 */
function onNewTransaction(tx) {
  const existing = state.supporters.find(s => s.address === tx.fromAddress);
  if (existing) {
    existing.totalDonated = +(existing.totalDonated + tx.amountBCH).toFixed(8);
    existing.donations += 1;
    existing.badgeDef = calculateBadge(existing.donations);
    existing.badge = existing.badgeDef.label;
  } else {
    // New donor — push to supporters list
    const newSupporter = {
      id: Date.now(),
      address: tx.fromAddress,
      displayName: shortenAddress(tx.fromAddress),
      totalDonated: tx.amountBCH,
      donations: 1,
      badge: 'Bronze',
      badgeDef: calculateBadge(1),
      joinDate: new Date().toISOString().slice(0, 10),
      monthlyDonated: tx.amountBCH,
    };
    state.supporters.push(newSupporter);
  }
  // Re-sort and re-render
  state.supporters.sort((a, b) => b.totalDonated - a.totalDonated);
  renderSupporters(state.supporters);
  updateStatistics(state.supporters);
  showToast(`New donation received! 🎉`);
}

// ─── RENDER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * renderSupporters — builds the leaderboard DOM.
 * @param {Array} supporters — sorted array of supporter objects
 *
 * 🔌 BACKEND: Call after each data refresh or onNewTransaction event.
 */
function renderSupporters(supporters) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  if (!supporters.length) {
    container.innerHTML = `<p class="empty-state">No supporters yet. Be the first! 🙌</p>`;
    return;
  }

  container.innerHTML = supporters.map((s, idx) => {
    const rank = idx + 1;
    const badge = s.badgeDef || calculateBadge(s.donations);
    const rankClass = rank <= 3 ? `rank-top rank-${rank}` : '';
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    return `
      <div class="supporter-row ${rankClass}" data-id="${s.id}" style="--badge-glow: ${badge.glow}; --badge-color: ${badge.color};">
        <div class="supporter-rank">${rankLabel}</div>
        <div class="supporter-info">
          <div class="supporter-name">${escapeHtml(s.displayName || shortenAddress(s.address))}</div>
          <div class="supporter-address">${shortenAddress(s.address)}</div>
        </div>
        <div class="supporter-meta">
          <div class="supporter-donated">${s.totalDonated.toFixed(4)} <span>BCH</span></div>
          <div class="supporter-donations">${s.donations} donation${s.donations !== 1 ? 's' : ''}</div>
        </div>
        <div class="supporter-badge" style="background: ${badge.gradient}; box-shadow: 0 0 12px ${badge.glow};">
          <span class="badge-icon">${badge.icon}</span>
          <span class="badge-label">${badge.label}</span>
        </div>
        <div class="supporter-date">Since ${formatDate(s.joinDate)}</div>
      </div>`;
  }).join('');

  // Stagger animate in
  requestAnimationFrame(() => {
    container.querySelectorAll('.supporter-row').forEach((el, i) => {
      el.style.animationDelay = `${i * 60}ms`;
      el.classList.add('animate-in');
    });
  });
}

/**
 * updateStatistics — computes and renders global stats.
 * @param {Array} supporters
 *
 * 🔌 BACKEND: Call after any data update.
 */
function updateStatistics(supporters) {
  if (!supporters.length) return;

  const totalBCH = supporters.reduce((sum, s) => sum + s.totalDonated, 0);
  const totalDonations = supporters.reduce((sum, s) => sum + s.donations, 0);
  const topSupporter = supporters[0];
  const avgDonation = totalDonations > 0 ? totalBCH / totalDonations : 0;

  animateCounter('stat-total-bch', totalBCH, 4);
  animateCounter('stat-supporters', supporters.length, 0);
  animateCounter('stat-donations', totalDonations, 0);
  animateCounter('stat-avg', avgDonation, 4);

  const topEl = document.getElementById('stat-top');
  if (topEl) {
    topEl.textContent = topSupporter.displayName || shortenAddress(topSupporter.address);
  }
}

/**
 * renderMonthlyChampions — highlights top monthly donors.
 * @param {Array} supporters
 * @param {Array} championIds
 *
 * 🔌 BACKEND: Pull monthly totals from your DB and pass the top IDs here.
 */
function renderMonthlyChampions(supporters, championIds) {
  const container = document.getElementById('monthly-champions');
  if (!container) return;

  const champions = championIds
    .map(id => supporters.find(s => s.id === id))
    .filter(Boolean);

  if (!champions.length) {
    container.innerHTML = `<p class="empty-state">Monthly data loading…</p>`;
    return;
  }

  const podiumLabels = ['🥇 Champion', '🥈 Runner-up', '🥉 Third Place'];

  container.innerHTML = champions.map((s, i) => {
    const badge = s.badgeDef || calculateBadge(s.donations);
    return `
      <div class="champion-card" style="--badge-color: ${badge.color}; --badge-glow: ${badge.glow}; animation-delay: ${i * 120}ms">
        <div class="champion-podium">${podiumLabels[i] || `#${i + 1}`}</div>
        <div class="champion-icon">${badge.icon}</div>
        <div class="champion-name">${escapeHtml(s.displayName || shortenAddress(s.address))}</div>
        <div class="champion-address">${shortenAddress(s.address)}</div>
        <div class="champion-amount">${s.monthlyDonated?.toFixed(4) || '—'} <span>BCH this month</span></div>
      </div>`;
  }).join('');
}

// ─── QR CODE ─────────────────────────────────────────────────────────────────

function renderQRCode(address) {
  const img = document.getElementById('qr-image');
  if (!img) return;
  const encoded = encodeURIComponent(address);
  img.src = `${CONFIG.qrApiBase}?size=200x200&data=${encoded}&bgcolor=0a0e1a&color=4caf50&qzone=2&format=svg`;
  img.alt = `QR code for ${address}`;
}

// ─── COPY ADDRESS ────────────────────────────────────────────────────────────

function initCopyButton() {
  const btn = document.getElementById('copy-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.donationAddress);
      btn.classList.add('copied');
      btn.querySelector('.copy-label').textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.querySelector('.copy-label').textContent = 'Copy Address';
      }, 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = CONFIG.donationAddress;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  });
}

// ─── HERO CANVAS ANIMATION ───────────────────────────────────────────────────

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
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.2,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 90 }, makeParticle);
  }

  function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,200,83,${0.12 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    connectParticles();
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(76,175,80,${p.alpha})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }

  init();
  draw();
  window.addEventListener('resize', () => { resize(); });
}

// ─── SCROLL REVEAL ───────────────────────────────────────────────────────────

function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ─── NAV SCROLL EFFECT ───────────────────────────────────────────────────────

function initNav() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 40);
  }, { passive: true });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────────────────────

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

function showDataError() {
  const el = document.getElementById('leaderboard-list');
  if (el) el.innerHTML = `<p class="empty-state error">Could not load supporter data. Please try again later.</p>`;
}

// ─── ANIMATED COUNTERS ───────────────────────────────────────────────────────

function animateCounter(id, target, decimals = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseFloat(el.dataset.current || 0);
  const duration = 1200;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = current.toFixed(decimals);
    el.dataset.current = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function shortenAddress(addr) {
  if (!addr) return '—';
  const clean = addr.replace('bitcoincash:', '');
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── BADGE CARDS RENDERER ────────────────────────────────────────────────────

function renderBadgeCards() {
  const container = document.getElementById('badge-cards');
  if (!container) return;
  container.innerHTML = BADGES.slice().reverse().map(badge => `
    <div class="badge-card reveal" style="--badge-gradient: ${badge.gradient}; --badge-glow: ${badge.glow}; --badge-color: ${badge.color};">
      <div class="badge-card-glow"></div>
      <div class="badge-card-icon">${badge.icon}</div>
      <div class="badge-card-name">${badge.label}</div>
      <div class="badge-card-req">${badge.minDonations}${badge.minDonations >= 50 ? '+' : ''} donation${badge.minDonations !== 1 ? 's' : ''}</div>
      <div class="badge-card-desc">${badge.description}</div>
    </div>
  `).join('');
}

// ─── INIT ────────────────────────────────────────────────────────────────────

async function init() {
  initNav();
  initHeroCanvas();
  renderBadgeCards();
  initScrollReveal();
  initCopyButton();
  renderQRCode(CONFIG.donationAddress);

  // Set donation address in DOM
  const addrEls = document.querySelectorAll('.donation-address-text');
  addrEls.forEach(el => { el.textContent = CONFIG.donationAddress; });

  // Set monthly heading
  const monthEl = document.getElementById('current-month');
  if (monthEl) monthEl.textContent = state.currentMonth || getCurrentMonth();

  // Load and render data
  const data = await loadData();
  if (data) {
    renderSupporters(state.supporters);
    updateStatistics(state.supporters);
    renderMonthlyChampions(state.supporters, state.monthlyChampionIds);

    const monthEl2 = document.getElementById('current-month');
    if (monthEl2) monthEl2.textContent = state.currentMonth;
  }

  // 🔌 BACKEND: Uncomment to enable live polling
  // startPolling();

  // 🔌 BACKEND: Example Supabase realtime subscription:
  // const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // supabase.from('donations').on('INSERT', payload => {
  //   onNewTransaction({
  //     fromAddress: payload.new.from_address,
  //     amountBCH: payload.new.amount_bch,
  //     txid: payload.new.txid,
  //     timestamp: payload.new.created_at,
  //   });
  // }).subscribe();

  // 🔌 BACKEND: Example Haskoin websocket for live BCH monitoring:
  // const ws = new WebSocket('wss://api.haskoin.com/bch/events');
  // ws.onmessage = (event) => {
  //   const msg = JSON.parse(event.data);
  //   if (msg.type === 'tx' && isRelevantTx(msg.data, CONFIG.donationAddress)) {
  //     onNewTransaction(parseHaskoinTx(msg.data));
  //   }
  // };
}

document.addEventListener('DOMContentLoaded', init);

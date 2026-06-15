# 🏆 BCH Ecosystem Hall of Fame

**Live site:** [cashcompass-fame.vercel.app](https://cashcompass-fame.vercel.app)

A prestige-grade, privacy-first recognition platform celebrating every Bitcoin Cash wallet that supports the BCH open-source ecosystem. No sign-ups. No personal data. Just your address, your donations, and your permanent place in BCH history.

---

## What It Is

The Hall of Fame is a public monument to BCH contributors — a historical archive of wallet addresses that have funded the tools driving Bitcoin Cash adoption worldwide. It is **not** a donation page. It is a community pride dashboard and reputation system for wallets.

Three ecosystem projects share a single donation address, and every confirmed on-chain transaction earns the sender a ranked position on the leaderboard:

| Project | Description | URL |
|---------|-------------|-----|
| 🧭 CashCompass | BCH ecosystem directory, DeFi hub, ambassador profiles | [cashcompass-bch.vercel.app](https://cashcompass-bch.vercel.app) |
| 💳 CompassPay | BCH payment toolkit with live fiat conversion and QR generation | [compasspay.cash](https://compasspay.cash) |
| ⚖️ StableShift | BCH-to-stablecoin hedging via AnyHedge oracle relay | [stableshift.cash](https://stableshift.cash) |

---

## Features

### 🔒 Privacy-First by Design
- Only shortened BCH addresses are ever displayed (e.g. `qpzk9d…mn3p`)
- No emails, usernames, names, or social links required or stored
- All data derived exclusively from public, on-chain BCH transaction history

### 🏅 Seven-Tier Badge System
Badges are awarded automatically based on on-chain donation count:

| Badge | Icon | Requirement |
|-------|------|-------------|
| Pioneer | 🌱 | Just discovered the Hall of Fame |
| Early Backer | 🚀 | Registered supporter |
| Bronze | 🥉 | 1+ donations |
| Silver | 🥈 | 5+ donations |
| Gold | 🥇 | 10+ donations |
| Platinum | 🏆 | 25+ donations |
| BCH Legend | 👑 | 50+ donations |

Each badge card includes a hover tooltip explaining the tier. Supporter rows show a progress bar toward the next badge level.

### 🎖️ Reputation Level System
A second recognition layer computed from a score formula:

```
score = (totalBCH × 10) + (donationCount × 5)
```

| Level | Min Score | Color |
|-------|-----------|-------|
| Supporter | 0 | Blue |
| Builder | 20 | Green |
| Backer | 80 | Silver |
| Champion | 200 | Gold |
| Legend | 500 | Orange |

Displayed as a subtle colored pill next to each supporter's badge.

### 📊 Live Leaderboard
- Ranked by total BCH donated
- Animated slide-in on load
- Click or tap any row to open a full supporter profile modal
- Keyboard accessible (Enter / Space to open modal, Escape to close)

### 👤 Supporter Profile Modal
Each supporter modal shows:
- Badge and reputation level
- Total BCH donated (with live USD conversion)
- Total transaction count
- Largest single transaction
- First seen date
- Progress bar toward next badge
- Donation timeline (last 10 transactions)
- Privacy note

### 📅 Monthly Champions
Top 3 supporters for the current calendar month, with animated crown icons and USD value conversion.

### 📈 Statistics Dashboard
Six animated counters updated on load:
- Total BCH donated
- Total supporters
- Total transactions
- Average donation size
- Largest single transaction
- Active wallets this month

### 🌍 Ecosystem Impact Panel
Explains the real-world outcomes funded by supporters:
- CashCompass development
- CompassPay infrastructure
- StableShift liquidity tools
- BCH onboarding in Mozambique
- Merchant adoption campaigns
- Open-source infrastructure

---

## Architecture

### File Structure

```
/
├── index.html          # Full page structure, semantic HTML, SEO meta
├── styles.css          # Complete design system (BCH green, glassmorphism)
├── script.js           # All logic — data, rendering, modal, badge system
└── data/
    └── supporters.json # Legacy mock data file (no longer used directly)
```

### Tech Stack
- **Pure HTML + CSS + vanilla JavaScript** — zero frameworks, zero build steps
- **Static deployment** on Vercel (no serverless functions needed)
- **Single-file architecture** — fully auditable and self-hostable

### Live Data Sources

| Source | Purpose | API Key | CORS |
|--------|---------|---------|------|
| [Haskoin Store](https://api.haskoin.com/bch) | BCH transaction indexing | None | ✅ Open |
| [CoinPaprika](https://api.coinpaprika.com/v1) | Live BCH/USD price | None | ✅ Open |
| [QR Server](https://api.qrserver.com) | Donation QR code generation | None | ✅ Open |

All external APIs are free, require no authentication, and have no CORS restrictions.

### Data Flow

```
On page load:
  1. fetchBCHPrice()        → CoinPaprika → state.bchPriceUSD
  2. fetchLiveTransactions() → Haskoin Store → buildDonorMap() → hydrate()
  3. renderAll()            → renderSupporters() + updateStatistics() + renderMonthlyChampions()
  4. startPolling()         → repeats steps 1–3 every 60 seconds

On supporter click:
  openModal(supporter)      → renders profile modal with full stats + tx history
```

### Supporter Data Shape

```js
{
  address:         "bitcoincash:q...",  // full address (never shown in UI)
  shortAddr:       "qpzk9d…mn3p",      // display-safe shortened version
  totalDonated:    number,              // total BCH from this address
  donations:       number,              // total confirmed transaction count
  firstSeen:       "YYYY-MM-DD",       // date of first confirmed donation
  monthlyDonated:  number,             // BCH donated in current calendar month
  largestDonation: number,             // single largest transaction amount
  txHistory:       [{ date, amount }], // chronological donation list
  badgeDef:        Object,             // computed badge tier (calculateBadge)
  reputation:      Object,             // computed reputation level (calculateReputation)
}
```

---

## Donation Address

All three projects share one BCH address:

```
bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040
```

Every confirmed inbound transaction from any external address automatically creates or updates a leaderboard entry. No registration, no confirmation email — just the blockchain.

---

## Backend Integration Guide

The codebase is designed to accept a live backend with minimal changes. All integration points are marked with `🔌 BACKEND:` comments in `script.js`.

### Option A — Haskoin Store (current, default)
Already working. Fetches up to 50 most recent transactions on load and every 60 seconds.

**Limitation:** Haskoin returns max 50 tx per request. For addresses with heavy history, add pagination:

```js
// In fetchLiveTransactions(), paginate with offset:
const pages = await Promise.all([0, 50, 100].map(offset =>
  fetch(`${CONFIG.haskoinBase}/address/${CONFIG.donationAddress}/transactions/full?limit=50&offset=${offset}`)
    .then(r => r.json())
));
const txList = pages.flat();
```

### Option B — Supabase Real-Time

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase.from('donations')
  .on('INSERT', payload => {
    onNewTransaction({
      fromAddress: payload.new.from_address,
      amountBCH:   payload.new.amount_bch,
      txid:        payload.new.txid,
      timestamp:   payload.new.created_at,
    });
  })
  .subscribe();
```

### Option C — Firebase Firestore

```js
import { onSnapshot, collection } from 'firebase/firestore';
onSnapshot(collection(db, 'donations'), snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      onNewTransaction(change.doc.data());
    }
  });
});
```

### Option D — Custom REST API / Webhook
Replace `fetchLiveTransactions()` to call your own endpoint:

```js
const res = await fetch('https://your-api.vercel.app/api/donations');
const data = await res.json(); // same shape as buildDonorMap output
state.supporters = data.map(hydrate).sort((a,b) => b.totalDonated - a.totalDonated);
```

### Key Backend Functions (already stubbed)

```js
fetchNewDonations()   // Poll for new transactions since last check
syncBlockchainData()  // Full historical resync with pagination
updateLeaderboard()   // Re-sort and re-render after data update
onNewTransaction(tx)  // Process a single new confirmed transaction
```

---

## Deployment

### Vercel (current)

The project deploys as a static site — no build configuration needed.

1. Push all files to a GitHub repository maintaining this structure:
   ```
   /index.html
   /styles.css
   /script.js
   /data/supporters.json
   ```
2. Import the repository into Vercel
3. Framework preset: **None** (or "Other")
4. Build command: *(leave empty)*
5. Output directory: *(leave empty or set to `/`)*
6. Deploy

No environment variables required. No serverless functions needed.

### Self-Hosting

Any static file server works:

```bash
# Python
python -m http.server 8080

# Node
npx serve .

# Nginx — just serve the directory
```

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#0A0E1A` |
| Card surface | `#101624` |
| BCH Green | `#00C853` |
| Gold | `#FFD700` |
| Glass background | `rgba(255,255,255,0.04)` |
| Glass border | `rgba(255,255,255,0.08)` |
| Text primary | `#E8EDF5` |
| Text muted | `#7A8299` |
| Display font | Space Grotesk |
| Body font | Inter |

---

## Ecosystem Links

- **Bitcoin Cash:** [bitcoincash.org](https://bitcoincash.org)
- **Cauldron DEX:** [cauldron.quest](https://cauldron.quest)
- **Paytaca Wallet:** [paytaca.com](https://paytaca.com)
- **Electron Cash:** [electroncash.org](https://electroncash.org)
- **Haskoin API Docs:** [api.haskoin.com](https://api.haskoin.com)

---

## Author

Built by [@alberdioni8406_](https://twitter.com/alberdioni8406_) as part of the CashCompass BCH ecosystem suite.

BCH donation address: `bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040`

---

*Open-source. Community-owned. Powered by Bitcoin Cash. ⚡*

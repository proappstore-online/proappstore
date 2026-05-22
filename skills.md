# ProAppStore — AI Agent Guide

Point your Claude Code, Codex, or any AI agent to this file for platform-aware development.

**Add to your CLAUDE.md or agent config:**
```
See https://proappstore.online/skills.md for platform skills.
```

---

## What is ProAppStore?

The paid counterpart to FreeAppStore. Premium web apps with subscriptions, real-time collaboration, AI features, and Stripe-powered billing. One SDK, one import — everything FreeAppStore has, plus subscription management and license keys.

- **Store**: https://proappstore.online
- **Docs**: https://proappstore.online/docs
- **Roadmap**: https://proappstore.online/roadmap
- **Pricing**: https://proappstore.online/pricing
- **Dashboard**: https://dashboard.proappstore.online
- **Console**: https://console.proappstore.online
- **API**: https://api.proappstore.online
- **Free tier**: https://freeappstore.online
- **GitHub org**: https://github.com/proappstore-online

---

## Per-repo CLAUDE.md convention

Same as FAS. Keep it minimal — only what's unique to that repo:

````markdown
# <name>

<one-line description>

- Subdomain: `<name>.proappstore.online`
- Dev:    `pnpm install && pnpm dev`
- Build:  `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

For platform conventions, read
https://proappstore.online/skills.md
before writing or changing anything.
````

---

## SDK — one import, all features

```bash
npm i @proappstore/sdk
```

```ts
import { initPro } from '@proappstore/sdk'

const app = initPro({ appId: 'my-app' })

// Auth (GitHub OAuth — shared identity with FreeAppStore)
await app.auth.init()
app.auth.onChange(user => { ... })
app.auth.signIn()
app.auth.signOut()

// Per-user KV storage
await app.kv.set('key', value)
await app.kv.get('key')
await app.kv.list({ prefix: 'note:' })
await app.kv.getMany(keys)
await app.kv.delete('key')

// Shared counters (cross-user, atomic)
await app.counters.increment('views')
await app.counters.get('views')
await app.counters.list()

// Real-time rooms (WebSocket)
const room = app.rooms.join('room-id')
room.send(data)
room.onMessage(cb)
room.onPeers(cb)
room.close()

// Secret-injecting API proxy
const res = await app.proxy.fetch('api.example.com/v1/data')

// Subscription (Stripe)
const sub = await app.subscription.status()
await app.subscription.openCheckout({ priceId, successUrl, cancelUrl })
await app.subscription.openPortal(returnUrl)

// Per-app SQL database (full D1 access)
await app.db.execute('CREATE TABLE events (id TEXT PK, title TEXT, city TEXT)')
const { rows } = await app.db.query('SELECT * FROM events WHERE city = ?', ['SF'])
await app.db.execute('INSERT INTO events VALUES (?, ?, ?)', [id, 'Meetup', 'SF'])
// File storage (images, videos, documents — backed by R2)
await app.storage.upload('events/photo.jpg', file, 'image/jpeg')
const response = await app.storage.download('events/photo.jpg')
const files = await app.storage.list()
await app.storage.delete('events/photo.jpg')

// Maps (geocoding, routing, embeds — no Google API keys needed)
const results = await app.maps.geocode('Sydney Opera House')
const place = await app.maps.reverseGeocode(-33.856, 151.215)
const route = await app.maps.route({ lat: -33.856, lng: 151.215 }, { lat: -33.870, lng: 151.209 })
// route.geometry (GeoJSON LineString), route.distanceMeters, route.durationSeconds
const mapUrl = app.maps.embedUrl(-33.856, 151.215)  // for <iframe>
const tileUrl = app.maps.staticUrl(-33.856, 151.215) // for <img>

// Push notifications (Web Push)
await app.notifications.subscribe()          // request permission + register SW
await app.notifications.isSubscribed()       // check status
await app.notifications.send('user-id', { title: 'Hey!', body: 'Event starting soon.', url: '/events/1' })
await app.notifications.broadcast({ title: 'New feature!', body: 'Check it out.' })

// SMS (Twilio-backed, creator-only)
await app.sms.send('+15551234567', 'Your reservation is confirmed!')
await app.sms.broadcast(['+15551234567', '+15559876543'], 'Meetup in 30 min!')

// AI (Workers AI — server-side LLM + embeddings, included in subscription)
const { text } = await app.ai.generate('Write a haiku about yoga')
const { text } = await app.ai.generate('Summarize...', { model: 'smart' })  // 'fast' or 'smart'
const { text } = await app.ai.chat([
  { role: 'system', content: 'You are a yoga instructor.' },
  { role: 'user', content: 'What is downward dog?' },
])
const { vectors } = await app.ai.embed(['vinyasa', 'restorative'])  // 'm3' or 'base'

// Multi-tenant helpers (auto-scoped by tenant_id)
const tx = app.db.tenant('studio-123')
await tx.insert('clients', { id: 'c-1', name: 'Alice' })
const alice = await tx.find('clients', { id: 'c-1' })
const all = await tx.findMany('clients')
await tx.update('clients', { id: 'c-1' }, { name: 'Alicia' })
await tx.delete('clients', { id: 'c-1' })

// License keys
const license = await app.license.current()
await app.license.validate('KEY-123')
```

### React Hooks (recommended)

Hooks give apps full control over their UI. Import from `@proappstore/sdk/hooks`.

```tsx
import { initPro } from '@proappstore/sdk'
import { useProAuth, useProSubscription, useProGate } from '@proappstore/sdk/hooks'

const app = initPro({ appId: 'my-app' })

// useProAuth — auth state + actions
function App() {
  const { user, loading, signIn, signOut, deleteAccount } = useProAuth(app)
  if (loading) return <p>Loading...</p>
  if (!user) return <button onClick={signIn}>Sign in</button>
  return <p>Welcome, {user.login}!</p>
}

// useProSubscription — subscription state
function Billing() {
  const { isPro, upgrade, manageBilling } = useProSubscription(app)
  if (!isPro) return <button onClick={() => upgrade()}>Upgrade</button>
  return <button onClick={manageBilling}>Manage billing</button>
}

// useProGate — combined auth + subscription gate
function GatedApp() {
  const { gate, user, signIn, upgrade } = useProGate(app, { allowFree: true })
  if (gate === 'loading') return <p>Loading...</p>
  if (gate === 'signed-out') return <button onClick={signIn}>Sign in</button>
  if (gate === 'no-subscription') return <button onClick={() => upgrade()}>Upgrade</button>
  return <p>Welcome, {user?.login}!</p>
}
```

Gate states: `'loading'` | `'signed-out'` | `'no-subscription'` | `'ready'`

### ProShell — platform UI component

Wrap your app in `<ProShell>` for automatic auth gate, subscription wall, and topbar:

```tsx
import { initPro } from '@proappstore/sdk'
import { ProShell } from '@proappstore/sdk/shell'

const app = initPro({ appId: 'my-app' })

export default function App() {
  return (
    <ProShell app={app} appName="My App">
      {/* Only renders when signed in + subscribed */}
      <MyAppContent />
    </ProShell>
  )
}
```

ProShell provides: sign-in screen, subscription upgrade wall, topbar with avatar + menu (sign out, manage billing, delete account).

---

## What Pro adds over Free

| Feature | Free (FAS) | Pro (PAS) |
|---------|-----------|-----------|
| Auth + KV + Counters + Rooms + Proxy | Included | Included (same SDK) |
| KV storage limit | 1MB/user | 10MB/user |
| Per-app SQL database | No (use collections) | Yes (full D1, custom schema) |
| Real-time rooms | 5 rooms, 50 user-hours/day | Uncapped |
| Subscriptions (Stripe) | No | Yes |
| File storage (R2) | No | Yes (images, videos, 50MB/file) |
| Maps + geocoding + routing | No | Yes (OpenStreetMap, no Google keys) |
| Push notifications | No | Yes (Web Push, VAPID) |
| SMS | No | Yes (Twilio-backed, creator-only) |
| Server-side AI | No | Yes (Workers AI — text, chat, embeddings) |
| Multi-tenant helpers | No | Yes (auto tenant_id scoping) |
| ProShell (platform UI) | No | Yes (auth + sub gate + topbar) |
| License keys | No | Yes |
| Custom domain | No | Yes |
| Cron/scheduled | No | Coming |

---

## Architecture

```
proappstore-online/platform     — monorepo (sdk, cli, backend, data-worker)
proappstore-online/proappstore  — store site (static HTML)
proappstore-online/dashboard    — user account management (React)
proappstore-online/console      — creator console (React)
proappstore-online/<app-name>   — individual app repos
```

Platform monorepo packages:

| Package | npm | Purpose |
|---------|-----|---------|
| `packages/sdk` | `@proappstore/sdk` | Unified SDK (FAS + Pro) |
| `packages/cli` | `@proappstore/cli` | CLI for publishing |
| `packages/backend` | private | CF Worker — Stripe, subscriptions, licenses |

---

## Tech stack

- TypeScript, React 19, Vite 8, Tailwind CSS 4, pnpm
- Node >=22 (CI uses 24)
- Backend: Cloudflare Workers + D1 + Durable Objects
- Payments: Stripe (checkout, portal, webhooks)
- Publishing: OIDC trusted publishing (no stored npm tokens)

---

## IMPORTANT: What NOT to do

- **Do NOT ask for API tokens or secrets.** All infra is automated.
- **Do NOT deploy manually.** Push to main = auto-deploy.
- **Do NOT scaffold from scratch.** Copy from templates.
- **Do NOT import both SDKs.** `@proappstore/sdk` includes everything.

---

## Deployment

Push to main → auto-deploy via CF Pages (apps) or GH Actions (backend/SDK).

---

## Local folder structure

```
~/dev/stores/pas/
├── platform/       → proappstore-online/platform
├── proappstore/    → proappstore-online/proappstore (store site)
├── dashboard/      → proappstore-online/dashboard
├── apps/
│   ├── meetup/     → proappstore-online/meetup
│   └── ...
└── templates/      → app scaffolding
```

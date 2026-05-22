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
- **MCP**: https://mcp.proappstore.online/mcp (AI agent tools)
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
app.auth.signIn()           // GitHub OAuth (default)
app.auth.signIn('google')   // Google OAuth
app.auth.signIn('apple')    // Apple OAuth
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
await app.notifications.notifyUser('gh:123', {   // peer-to-peer (no creator check, 30/min)
  title: '@serge mentioned you', body: 'In "Wire the broadcast"',
  url: 'https://kanban.proappstore.online/#/...', tag: 'mention:card-1',
})

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

// Roles (app-level RBAC — default: owner, member, moderator, editor, viewer)
await app.roles.assign('user-456', 'moderator')   // assign
await app.roles.revoke('user-456', 'moderator')   // revoke
const isMod = await app.roles.check('moderator')    // check current user's role
const myRoles = await app.roles.myRoles()            // list current user's roles
const all = await app.roles.listAll()                // all assignments (owner-only)

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

### App UI Components (`@proappstore/sdk/ui`)

**Pro apps MUST use the SDK components for auth, profile, and subscription UI.** The SDK components enforce brand consistency and handle the full lifecycle.

#### ProShell — zero-config app wrapper

```tsx
import { initPro } from '@proappstore/sdk'
import { ProShell } from '@proappstore/sdk/shell'

const app = initPro({ appId: 'my-app' })

export default function App() {
  return (
    <ProShell app={app} appName="My App">
      <MyAppContent />
    </ProShell>
  )
}
```

Props: `app` (required), `children`, `appName`, `allowFree` (default true), `showThemeToggle` (default true).

#### Individual components

Use these when you need more layout control than ProShell provides:

```tsx
import {
  Avatar,           // GitHub avatar with initial fallback
  SignInButton,     // Platform-branded sign-in
  ThemeToggle,      // Sun/moon, cycles system→light→dark
  TextSizeToggle,   // A/A+/A-, cycles default→large→small text
  ProBadge,         // Purple "PRO" badge (sm/md/lg)
  ProfileMenu,      // Avatar dropdown: badge, billing, theme, sign out, delete
  SubscriptionStatus, // Inline: PRO badge or "Free plan [Upgrade]"
  UpgradeCard,      // Styled upgrade CTA card with features list
  BillingButton,    // Opens Stripe billing portal (primary/secondary/ghost)
  GateScreen,       // Loading / sign-in / upgrade screens
  ProProfilePage,   // Full settings: subscription, billing, theme, danger zone
} from '@proappstore/sdk/ui'

// Avatar
<Avatar user={user} size={32} />

// ProBadge
<ProBadge size="md" />

// Theme toggle (no props needed)
<ThemeToggle />

// Profile menu with billing
<ProfileMenu app={app} showThemeToggle showBilling />

// Inline subscription status
<SubscriptionStatus app={app} />

// Upgrade prompt card
<UpgradeCard app={app} title="Go Pro" priceLabel="$9/month" features={['Cloud sync', 'AI', 'Support']} />

// Billing portal button
<BillingButton app={app} variant="secondary" />

// Gate screen (use with useProGate)
const { gate } = useProGate(app)
if (gate !== 'ready') return <GateScreen gate={gate} app={app} appName="My App" />

// Full profile/settings page
<Route path="/profile" element={<ProProfilePage app={app} />} />
```

#### useTheme hook

```tsx
import { useTheme } from '@proappstore/sdk/hooks'

const { theme, preference, setPreference } = useTheme()
// theme: 'light' | 'dark' (resolved)
// preference: 'light' | 'dark' | 'system'
// Stores in localStorage('fas:theme'), applies data-theme on <html>
```

#### useProNotifications hook

```tsx
import { useProNotifications } from '@proappstore/sdk/hooks'

const { permission, isSubscribed, subscribe, unsubscribe, loading } = useProNotifications(app)
```

### Exports map

```
@proappstore/sdk          → initPro, ProAppStore, TenantScope, types
@proappstore/sdk/hooks    → useProAuth, useProSubscription, useProGate, useProNotifications, useTheme
@proappstore/sdk/shell    → ProShell
@proappstore/sdk/ui       → Avatar, SignInButton, ThemeToggle, TextSizeToggle, ProBadge, ProfileMenu,
                            SubscriptionStatus, UpgradeCard, BillingButton, GateScreen, ProProfilePage
```

Full UI component docs: https://proappstore.online/docs/ui

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

## CLI Reference (`@proappstore/cli`)

```bash
npm i -g @proappstore/cli

# Create a new app (scaffolds repo + provisions D1 + R2 + data worker)
pas create my-app

# Check compliance before publishing
pas check

# Publish to the store (submits for review)
pas publish

# Check CLI version
pas --version
```

`pas create` does everything: scaffolds from template, creates GitHub repo, provisions D1 database, sets up data worker, creates CF Pages project. Push to main = live.

---

## Project Structure

Every Pro app follows this layout (created by `pas create`):

```
my-app/
├── web/
│   ├── src/
│   │   ├── App.tsx          ← your app (wrap in ProShell)
│   │   ├── main.tsx         ← entry point
│   │   └── index.css        ← Tailwind + CSS custom properties
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json         ← @proappstore/sdk dependency
├── package.json              ← workspace root
├── pnpm-workspace.yaml
├── CLAUDE.md                 ← AI agent instructions
└── .github/workflows/deploy.yml
```

---

## How Deployment Works

1. Developer pushes to `main`
2. GitHub Actions builds (`pnpm build`)
3. Built output uploads to R2 (`apps/<app-id>/`)
4. Host worker serves from R2 at `<app-id>.proappstore.online`
5. SDK npm packages auto-publish via OIDC (no tokens stored)

**Two distinct operations:**
- **Deploy** = push code → live on subdomain (automatic, every push)
- **Publish** = submit to store listing for review (manual, `pas publish`)

---

## Platform Rules

1. **One SDK import.** Use `@proappstore/sdk` — it includes everything from FAS + Pro features.
2. **ProShell or SDK components.** Use `<ProShell>` or individual `@proappstore/sdk/ui` components for auth/subscription UI. No custom sign-in buttons.
3. **No inline secrets.** Use `app.proxy.fetch()` for third-party APIs — it injects keys server-side.
4. **No in-app payments.** Monetization is through the platform subscription only. Don't gate features behind separate payments.
5. **Mobile-first.** Test at 375px width. Touch targets ≥ 44px. No horizontal scroll.

---

## Privacy Rules

- **No tracking.** No Google Analytics, no Facebook Pixel, no third-party trackers.
- **No cookies.** Use `localStorage` (via SDK KV) for persistence.
- **No data selling.** User data stays on the platform.
- **Delete account = delete data.** `deleteAccount()` in SDK hooks wipes all KV data.

---

## Brand Design

- **Accent color:** Purple `#7c3aed` (light), `#a78bfa` (dark)
- **Fonts:** Manrope (body), Fraunces (display headings)
- **CSS tokens:** `--ink`, `--muted`, `--accent`, `--accent-soft`, `--border`, `--surface`, `--bg`, `--radius`
- **Dark mode:** Via `data-theme="dark"` on `<html>` — SDK `useTheme()` handles it
- Full design token reference: https://proappstore.online/docs/ui#design-tokens

---

## IMPORTANT: What NOT to do

- **Do NOT ask for API tokens or secrets.** All infra is automated.
- **Do NOT deploy manually.** Push to main = auto-deploy.
- **Do NOT scaffold from scratch.** Use `pas create`.
- **Do NOT import both SDKs.** `@proappstore/sdk` includes everything from FAS.
- **Do NOT build custom auth UI.** Use SDK components (ProShell, ProfileMenu, SignInButton).
- **Do NOT add tracking.** No GA, no pixels, no third-party analytics.
- **Do NOT gate features behind payments.** Platform subscription covers everything.

---

## MCP Server

AI agents can connect to the ProAppStore MCP server for platform-aware tooling:

```json
{
  "mcpServers": {
    "proappstore": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.proappstore.online/mcp"]
    }
  }
}
```

Tools: `list_apps`, `deploy_status`, `app_info`, `platform_guide`, `sdk_reference` (16 feature sections: auth, db, storage, maps, AI, subscriptions, rooms, hooks, UI, etc.)

---

## Local folder structure

```
~/dev/stores/pas/
├── platform/       → proappstore-online/platform (sdk, cli, backend)
├── proappstore/    → proappstore-online/proappstore (store site)
├── console/        → proappstore-online/console (creator portal)
├── dashboard/      → proappstore-online/dashboard (user account)
├── mcp/            → proappstore-online/mcp (MCP server for AI agents)
├── apps/
│   ├── meetup/     → proappstore-online/meetup
│   ├── carsads/    → carsads-online/carsads
│   └── ...
└── templates/      → app scaffolding
```

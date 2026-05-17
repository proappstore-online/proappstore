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
- **Dashboard**: https://dashboard.proappstore.online
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

// License keys
const license = await app.license.current()
await app.license.validate('KEY-123')
```

---

## What Pro adds over Free

| Feature | Free (FAS) | Pro (PAS) |
|---------|-----------|-----------|
| Auth + KV + Counters + Rooms + Proxy | Included | Included (same SDK) |
| KV storage limit | 1MB/user | 10MB/user |
| Real-time rooms | 5 rooms, 50 user-hours/day | Uncapped |
| Subscriptions (Stripe) | No | Yes |
| License keys | No | Yes |
| Custom domain | No | Yes |
| Server-side AI | No | Coming |
| Cron/scheduled | No | Coming |

---

## Architecture

```
proappstore-online/platform     — monorepo (sdk, cli, backend)
proappstore-online/proappstore  — store site (static HTML)
proappstore-online/dashboard    — user account management
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

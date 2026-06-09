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
- **Docs**: https://docs.proappstore.online/
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

Keep it minimal — only what's unique to that repo:

````markdown
# <name>

<one-line description>

- Subdomain: `<name>.proappstore.online`
- Dev:    `pnpm install && pnpm dev`
- Build:  `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare R2)

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

// Auth (PAS-owned; GitHub OAuth is the default)
await app.auth.init()
app.auth.onChange(user => { ... })
app.auth.signIn()           // GitHub OAuth (default)
app.auth.signIn('google')   // Google OAuth
// providers are ONLY 'github' (default) and 'google'. There is NO 'apple' — signIn('apple') fails tsc.
await app.auth.signInWithEmail(email)  // Magic-link email sign-in
app.auth.signOut()
app.auth.user                        // Current user (or null)
// The User is EXACTLY: { id: string; login: string; avatarUrl: string | null; dateOfBirth: string | null }
// There is NO `name` and NO `email`. Use `user.login` to display, `user.id` (e.g. "gh:123") as the key.
// `user.name` / `user.email` / `user.name ?? user.email` do NOT exist → they fail tsc and break the deploy.
app.auth.token                       // Session token (for API calls)
await app.auth.setDateOfBirth('2000-01-15')  // Set DOB (set-once, age >= 13)

// Per-user KV storage
await app.kv.set('key', value)
await app.kv.get<T>('key')                 // → T | null
await app.kv.list({ prefix: 'note:' })     // → string[] (KEYS only, no values — fetch each with kv.get)
await app.kv.getMany(keys)                 // → Map<string, T> (use .get(k), NOT obj[k])
await app.kv.delete('key')

// Shared counters (cross-user, atomic)
await app.counters.increment('views')      // → number (new value)
await app.counters.get('views')            // → number
await app.counters.list()                  // → Record<string, number> (object keyed by name, NOT an array)

// Real-time rooms (WebSocket)
const room = app.rooms.join('room-id')
room.send<T>(data)
room.onMessage<T>(m => { /* m = { from: { uid, login }, data: T, at: number } — your payload is m.data, sender is m.from */ })
room.onPeers(peers => { /* peers = { uid, login }[] */ })
room.close()

// Secret-injecting API proxy
const res = await app.proxy.fetch('api.example.com/v1/data')

// Subscription (Stripe)
const sub = await app.subscription.status()
await app.subscription.openCheckout({ priceId, successUrl, cancelUrl })
await app.subscription.openPortal(returnUrl)

// Per-app SQL database (full D1 access)
await app.db.execute('CREATE TABLE events (id TEXT PK, title TEXT, city TEXT)')
const { rows } = await app.db.query<Event>('SELECT * FROM events WHERE city = ?', ['SF'])  // → { rows: Event[]; meta }. PASS <T> or rows are Record<string,unknown>[] (row.title is unknown → tsc errors).
const r = await app.db.execute('INSERT INTO events VALUES (?, ?, ?)', [id, 'Meetup', 'SF'])  // → { meta: { changes, duration, last_row_id } }. NO .rows; the field is last_row_id (snake_case), not lastRowId.
await app.db.batch([{ sql: 'INSERT ...', params: [...] }, { sql: 'UPDATE ...' }])  // transactional; → array of { rows, meta } (one per statement)
await app.db.migrate([{ name: '0001_init', sql: 'CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT)' }])  // migrations are { name, sql } ONLY (no id/version/up/down). Each runs once, in order; idempotent.
const tables = await app.db.tables()  // list user-created tables

// File storage (images, videos, documents — backed by R2)
await app.storage.upload('events/photo.jpg', file, 'image/jpeg')        // → { key, size, contentType, url }
await app.storage.uploadPublic('avatar.jpg', file, 'image/jpeg')        // → { key, size, contentType, url }
const url = app.storage.publicUrl('avatar.jpg')  // no-auth URL for <img src>
const response = await app.storage.download('events/photo.jpg')  // → Response (call .blob() / .arrayBuffer())
const files = await app.storage.list()           // → { key, size, uploaded }[]  (it's .key, NOT .name; no .url — use publicUrl(key))
await app.storage.delete('events/photo.jpg')

// Maps (geocoding, routing, embeds — no Google API keys needed)
const results = await app.maps.geocode('Sydney Opera House')  // → GeoResult[]; each = { lat, lng, displayName, address, type, importance }. Use results[0].lat/.lng (NOT latitude/longitude).
const place = await app.maps.reverseGeocode(-33.856, 151.215)  // → { lat, lng, displayName, address }
const route = await app.maps.route({ lat: -33.856, lng: 151.215 }, { lat: -33.870, lng: 151.209 })
// route.geometry (GeoJSON LineString), route.distanceMeters, route.durationSeconds
const mapUrl = app.maps.embedUrl(-33.856, 151.215)  // for <iframe>
const tileUrl = app.maps.staticUrl(-33.856, 151.215) // for <img>

// Push notifications (Web Push)
await app.notifications.subscribe()          // request permission + register SW
await app.notifications.unsubscribe()        // unsubscribe
await app.notifications.isSubscribed()       // check status
await app.notifications.send('user-id', { title: 'Hey!', body: 'Event starting soon.', url: '/events/1' })  // send/broadcast/notifyUser → { sent: number; failed: number }
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
const { vectors } = await app.ai.embed(['vinyasa', 'restorative'], { model: 'm3' })  // model is an OPTIONS object { model: 'm3' | 'base' }, NOT a positional arg

// Multi-tenant helpers (auto-scoped by tenant_id)
const tx = app.db.tenant('studio-123')
await tx.insert('clients', { id: 'c-1', name: 'Alice' })
const alice = await tx.find('clients', { id: 'c-1' })
const all = await tx.findMany('clients')
await tx.update('clients', { id: 'c-1' }, { name: 'Alicia' })
await tx.delete('clients', { id: 'c-1' })

// Roles (app-level RBAC) — BUILT-IN platform feature. Use this for ANY permission
// gating (admins, moderators, owner-only screens, member vs viewer). Don't roll
// your own roles table or hardcode user ids. Default roles: owner, member,
// moderator, editor, viewer (custom = pass any string). `owner` is auto-assigned
// to the app creator.
await app.roles.assign('gh:123', 'moderator')   // assign a role to a user
await app.roles.revoke('gh:123', 'moderator')   // revoke
const isMod = await app.roles.check('moderator') // → boolean (current user has the role?)
const mine = await app.roles.myRoles()           // → string[] (current user's roles)
const all = await app.roles.listAll()            // → RoleAssignment[] (owner-only)

// License keys
const license = await app.license.current()
await app.license.validate('KEY-123')

// Usage tracking (auto-started by default, powers creator payouts)
app.usage.start()   // start tracking (automatic unless opts.usage.auto === false)
app.usage.stop()    // pause tracking
app.usage.flush()   // flush pending events

// Email (transactional — Resend-backed, 100/day per app)
await app.email.send('alice@example.com', 'Confirmed!', '<h1>Your reservation is set.</h1>')
await app.email.send('bob@example.com', 'Reset password', '<p>Click here</p>', { replyTo: 'support@my-app.com' })

// Webhooks (outbound — HMAC-SHA256 signed delivery)
const { id, secret } = await app.webhooks.register('notification.sent', 'https://my-backend.com/hook')
const hooks = await app.webhooks.list()
await app.webhooks.test(id)                   // fire test event
await app.webhooks.remove(id)
// Events: notification.sent, storage.uploaded
// Headers: X-Webhook-Signature (HMAC-SHA256 hex), X-Webhook-Event, Content-Type: application/json

// Invites (BUILT-IN platform feature — join codes + shareable link + QR).
// Do NOT roll your own invite/join-code table; use this. One invite, three ways
// in: say the CODE, send the LINK, or scan the QR. Redeem assigns the role via
// app.roles and returns your pass-through metadata. group/metadata are opaque —
// use them for org/team scoping and any app-specific data.
const invite = await app.invites.create({ role: 'member', group: 'org-1', metadata: { schoolId: 's1' }, uses: 30, expiresIn: '7d' })
// → { id, code, link, qr, role, group, maxUses, usedCount, expiresAt }
//   code = "HKWX3P"; link = https://<appId>.proappstore.online/join/HKWX3P; qr = <svg> string (server-rendered).
//   Defaults: role 'member', uses 1, expiresIn '7d'. Cannot invite role 'owner'. create/list/revoke need developer-level access.
const list = await app.invites.list()           // → InviteListItem[] (no qr; has metadata, expired, exhausted)
await app.invites.revoke(invite.id)
const r = await app.invites.redeem('HKWX3P')     // any signed-in user → { ok, role, group, metadata, appId }
// The /join/<code> landing is app-routed: read the code from the URL and call app.invites.redeem(code).
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

#### ProShell — app wrapper with optional custom chrome

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

Props: `app` (required), `children`, `appName`, `allowFree` (default true), `showThemeToggle` (default true), `menuItems`, `hideTopbar`, `hideFooter`, `renderTopbar`, `renderFooter`.

Use the default ProShell for simple apps that do not need app-level navigation. For apps with their own primary navigation, do **not** add a second navbar under ProShell. Replace the shell topbar and reuse the platform controls:

```tsx
<ProShell
  app={app}
  appName="My App"
  renderTopbar={({ appName, profileMenu, textSizeToggle, proBadge }) => (
    <header className="top-nav">
      <a href="/">{appName}</a>
      {proBadge}
      <nav>{/* app navigation */}</nav>
      {textSizeToggle}
      {profileMenu}
    </header>
  )}
>
  <MyAppContent />
</ProShell>
```

For apps that own all chrome, use `<ProShell app={app} hideTopbar hideFooter>` to keep the auth/subscription gates, or use hooks plus SDK UI primitives for a fully custom layout.

#### Individual components

Use these when you need more layout control than ProShell provides or when building custom app chrome:

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

#### Exact component props (do NOT pass undocumented props — it fails `tsc`)

These are the real signatures. Passing a prop not listed here is a compile error.

```ts
<ProShell app appName? allowFree? showThemeToggle? menuItems? hideTopbar? hideFooter? renderTopbar? renderFooter?>{children}</ProShell>
<Avatar user size? />                 // size defaults to 32
<SignInButton app label? provider? /> // provider is 'github' | 'google'. NO `onClick`.
<ThemeToggle />                       // no props
<TextSizeToggle />                    // no props
<ProfileMenu app showThemeToggle? showBilling?>{children?}</ProfileMenu>
<GateScreen gate app appName? />
```

**Multi-provider sign-in.** `<SignInButton>` supports GitHub and Google through
its `provider` prop:

```tsx
<SignInButton app={app} provider="github" label="Sign in with GitHub" />
<SignInButton app={app} provider="google" label="Sign in with Google" />
```

Also note: the `useProAuth(app)` hook's `signIn` is **zero-arg** (GitHub only). To
choose a provider, call `app.auth.signIn(provider)` directly, not the hook's
`signIn(provider)`.

#### useTheme hook

```tsx
import { useTheme } from '@proappstore/sdk/hooks'

const { theme, preference, setPreference } = useTheme()
// theme: 'light' | 'dark' (resolved)
// preference: 'light' | 'dark' | 'system'
// Stores in localStorage('stores-theme'), applies data-theme on <html>
```

#### useProNotifications hook

```tsx
import { useProNotifications } from '@proappstore/sdk/hooks'

const { permission, isSubscribed, subscribe, unsubscribe, loading } = useProNotifications(app)
```

### Exports map

```
@proappstore/sdk          → initPro, ProAppStore, TenantScope, Email, Webhooks, types
@proappstore/sdk/hooks    → useProAuth, useProSubscription, useProGate, useProNotifications, useTheme
@proappstore/sdk/shell    → ProShell
@proappstore/sdk/ui       → Avatar, SignInButton, ThemeToggle, TextSizeToggle, ProBadge, ProfileMenu,
                            SubscriptionStatus, UpgradeCard, BillingButton, GateScreen, ProProfilePage
```

Full UI component docs: https://docs.proappstore.online/ui/

---

## What Pro adds over Free

| Feature | Free | Pro |
|---------|-----------|-----------|
| Auth + KV + Counters + Rooms + Proxy | Included | Included (same SDK) |
| KV storage limit | 1MB/user | 10MB/user |
| Per-app SQL database | No (use collections) | Yes (full D1, custom schema) |
| Real-time rooms | 5 rooms, 50 user-hours/day | Uncapped rooms (32 peers/room, 4KB/msg, 100 msg/s/peer) |
| Subscriptions (Stripe) | No | Yes |
| File storage (R2) | No | Yes (images, videos, 50MB/file) |
| Maps + geocoding + routing | No | Yes (OpenStreetMap, no Google keys) |
| Push notifications | No | Yes (Web Push, VAPID) |
| SMS | No | Yes (Twilio-backed, creator-only) |
| Server-side AI | No | Yes (Workers AI — text, chat, embeddings) |
| Multi-tenant helpers | No | Yes (auto tenant_id scoping) |
| ProShell (platform UI) | No | Yes (auth + sub gate + topbar) |
| License keys | No | Yes |
| Transactional email | No | Yes (Resend-backed, 100/day) |
| Outbound webhooks | No | Yes (HMAC-signed, Zapier/Make/n8n) |
| Custom domain | No | Yes |
| Cron/scheduled | No | Coming |

### Platform limits

| Resource | Limit |
|----------|-------|
| **Storage** file size | 50 MB per file |
| **Storage** blocked types | HTML, JS, SVG (security) |
| **AI** prompt length | 16,000 chars |
| **AI** max output tokens | 1,024 |
| **AI** models | `fast` = Llama-3.1-8B, `smart` = Llama-3.3-70B |
| **Rooms** peers per room | 32 |
| **Rooms** message size | 4 KB |
| **Rooms** rate | 100 msg/s per peer |
| **Rooms** idle eviction | 24 hours |
| **Proxy** daily requests | 10,000 |
| **Proxy** request/response body | 100 KB each |
| **Secrets** per app | 5 |
| **Notifications** p2p rate | 30/min per app |
| **Email** daily sends | 100 per app |
| **Webhooks** per app | 5 |
| **Webhooks** events | `notification.sent`, `storage.uploaded` |
| **Listings** tagline | 60 chars |
| **Listings** description | 5,000 chars |
| **Listings** screenshots | 8 |
| **Logs** per POST batch | 100 entries, 4 KB each |

---

## Agent Teams

Every PAS project has a team of AI agents that build and test apps autonomously. A **PO** drives the backlog (Build-tab chat), an **Architect** owns the Knowledge Base (Research-tab chat), and **BA/Dev/QA** execute the pipeline. Every agent's identity, prompt, skills, and model are tunable per project — see [Agent customization](#agent-customization).

### Ticket lifecycle

```
inbox → ba-refining → awaiting-approval → ready → dev-active → qa-active → deploying → done
                                                       ↑              ↓
                                                       └── qa-failed ──┘
```

Also: `cancelled` (PO kills it), `failed` (cost cap, iteration cap, or a deploy
that can't be verified). **`deploying` is a deterministic system stage, not an
agent** — after QA passes, the platform pushes the code, captures the commit SHA,
and verifies the real CI build for that exact commit. Green → `done`; red → back
to Dev with the compiler error. So "done" means "verified live", and agents
cannot self-declare a deploy.

### Roles

| Role | Job | Tools |
|------|-----|-------|
| PO | Build-tab chat: turn the founder's intent into the smallest shippable tickets; answer from the real code; own the backlog | `list_files`, `read_file`, `search_files`, `remember`, `create_ticket` |
| Architect | Research-tab chat **+** build: research the app and author the Knowledge Base (`KNOWLEDGE.md` + `docs/`) the team builds against; design the app's MCP tool surface | `write_file`, `batch_write_files`, `read_file`, `list_files`, `search_files`, `read_docs`, `remember` |
| BA | Refine ideas into specs with acceptance criteria | read-only (`read_file`, `list_files`, `search_files`, `read_docs`) |
| Dev | Write app code with the PAS SDK; author the app's `mcp.json` so it's MCP-callable | `write_file`, `batch_write_files`, `read_file`, `list_files`, `search_files`, `read_docs` — **no deploy/scaffold tools; deployment is automatic after QA** |
| QA | Write Playwright E2E specs that run against the live app on every deploy; a failing assertion routes the ticket back to Dev | `write_file` (specs only), `read_file`, `list_files`, `search_files`, `read_docs` |

### Runtimes

| Runtime | Provider | Key pattern |
|---------|----------|-------------|
| `cf-native` | Anthropic (Messages API) | BYO `ANTHROPIC_API_KEY` |
| `openai-responses` | OpenAI (Responses API) | BYO `OPENAI_API_KEY` |

Each role can use a different runtime + model. Keys come from PAS key vault.

### Agent customization

Everything textual about an agent is data, scoped per project, and tunable — its
**identity** (persona), its **system prompt**, the **skills** it can use, and its
**model/runtime**. Override only what you need; the rest keeps the seeded default.

- **See every agent** — `GET /v1/projects/:slug/agents` returns the resolved
  catalog (each agent's identity, base system prompt, tools, model, runtime, and
  whether it's running a default or a custom override). This is what powers "see
  all prompts / skills / identities" in the Console.
- **Tune the build roles** — `PUT /v1/projects/:slug/roles` sets `persona`
  (identity), `systemPromptOverride`, `model`, `runtime`, `spineTools`, and
  `maxTokens` per role. The Architect's persona is shared with its Research chat.

### API

```
POST   /v1/projects                              # create project
GET    /v1/projects/:slug                         # get project
GET    /v1/projects/:slug/agents                  # resolved catalog of all agents (identity/prompt/skills/model)
GET    /v1/projects/:slug/roles                   # get role configs
PUT    /v1/projects/:slug/roles                   # set role configs (identity, prompt, model, tools…)
POST   /v1/projects/:slug/tickets                 # create ticket (PO)
GET    /v1/projects/:slug/tickets                 # list tickets (kanban)
POST   /v1/projects/:slug/tickets/:id/transition  # move ticket
POST   /v1/projects/:slug/tickets/:id/run         # run agent
GET    /v1/projects/:slug/tickets/:id/messages    # message history
GET    /v1/projects/:slug/cost                    # cost summary
WS     /v1/projects/:slug/ws                      # real-time stream
```

### Cost controls

Monthly cap per project (default $50). Token spend tracked per ticket per role. Cap hit → active tickets auto-fail. Max 5 QA→Dev iterations per ticket.

---

## Architecture

```
proappstore-online/platform     — monorepo (sdk, cli, backend, data-worker)
proappstore-online/proappstore  — store site (static HTML)
proappstore-online/dashboard    — user account management (React)
proappstore-online/console      — creator console (React)
```

App repos live in the **creator's own GitHub account or org** — the platform doesn't create or manage them. Creators scaffold with `pas create`, push to their own repo, then `pas publish` to provision platform resources.

Platform monorepo packages:

| Package | npm | Purpose |
|---------|-----|---------|
| `packages/sdk` | `@proappstore/sdk` | Full platform SDK |
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

# Sign in with GitHub
pas login

# Check who you're signed in as
pas whoami

# Scaffold a new app from the template
pas create my-app

# Scaffold + create GitHub repo + push in one step
pas create my-app --repo my-org/my-app

# Check compliance before publishing
pas check

# Provision platform resources (CF Pages, DNS, D1, Data Worker)
pas publish

# Connect a third-party API (one command, pre-configured)
pas integrate openai        # prompts for API key, sets up proxy
pas integrate amadeus       # prompts for client_id + client_secret
pas integrate list          # show all available integrations

# Or configure manually
pas secret set MY_KEY <value>
pas secret list
pas secret rm MY_KEY
pas proxy allow 'https://api.example.com/' --inject bearer --secret MY_KEY
pas proxy list
pas proxy deny 'https://api.example.com/'

# Manage custom domains
pas domain add my-custom.com
pas domain list
pas domain verify my-custom.com
pas domain remove my-custom.com

# Sign out
pas logout

# Check CLI version
pas --version
```

`pas create` scaffolds from the template repo and provisions the D1 database + Data Worker. The optional `--repo owner/name` flag creates a GitHub repo and pushes in one step. `pas publish` creates the CF Pages project, DNS record (`<id>.proappstore.online`), D1 database, and Data Worker. For repos outside `proappstore-online`, `pas publish` auto-sets the `CLOUDFLARE_API_TOKEN` deploy secret. Developers own their own GitHub repos — the platform doesn't create or manage them.

### Integrations

`pas integrate <name>` connects third-party APIs with one command. The platform knows how each API authenticates — you just provide your credentials.

**AI providers:**

| Integration | Command | What you need |
|---|---|---|
| OpenAI (GPT, DALL-E) | `pas integrate openai` | API key from platform.openai.com |
| Anthropic (Claude) | `pas integrate anthropic` | API key from console.anthropic.com |
| Google AI (Gemini) | `pas integrate google-ai` | API key from aistudio.google.com |
| OpenRouter | `pas integrate openrouter` | API key from openrouter.ai |
| Replicate | `pas integrate replicate` | API key from replicate.com |
| Stability AI | `pas integrate stability` | API key from stability.ai |
| ElevenLabs (TTS) | `pas integrate elevenlabs` | API key from elevenlabs.io |

**Data & services:**

| Integration | Command | What you need |
|---|---|---|
| Amadeus (flights) | `pas integrate amadeus` | Client ID + Secret from developers.amadeus.com |
| Spotify | `pas integrate spotify` | Client ID + Secret from developer.spotify.com |
| GitHub API | `pas integrate github` | Personal access token from github.com |
| OpenWeatherMap | `pas integrate openweathermap` | API key from openweathermap.org |
| Stripe | `pas integrate stripe` | Secret key from dashboard.stripe.com |
| RapidAPI | `pas integrate rapidapi` | API key from rapidapi.com |

After integrating, use `app.proxy.fetch()` in your app — the platform handles auth, token refresh (for OAuth2), and secret injection server-side. Your API keys never touch the browser.

Note: `app.ai` (Workers AI) is built into the platform and doesn't need integration. Use `pas integrate openai` etc. only if you need a specific provider's models beyond what Workers AI offers.

---

## Project Structure

Every Pro app follows this layout (created by `pas create`):

```
my-app/
├── web/
│   ├── src/
│   │   ├── App.tsx          ← your app (ProShell or SDK auth/UI primitives)
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

1. Developer runs `pas publish` → provisions CF Pages project, DNS, D1, Data Worker
2. App is live at `<id>.proappstore.online` immediately
3. Developer pushes to `main` → GitHub Actions builds and deploys to Cloudflare R2
4. Every subsequent `git push` auto-deploys

**Two distinct operations:**
- **Publish** = provision platform resources + DNS (one-time, `pas publish`)
- **Deploy** = push code → live on Pages (automatic, every `git push`)

**Developer owns:** GitHub repo, deploy workflow.
**Platform owns:** CF Pages project, DNS, D1 database, Data Worker, `CLOUDFLARE_API_TOKEN` (org-level secret), compliance checks.

---

## Platform Rules

1. **One SDK import.** Use `@proappstore/sdk` — it includes all platform features.
2. **ProShell or SDK components.** Use `<ProShell>` or individual `@proappstore/sdk/ui` components for auth/subscription UI. If an app needs primary navigation, use `renderTopbar` or `hideTopbar`; do not stack a second navbar below the default shell. No custom sign-in buttons.
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
- Full design token reference: https://docs.proappstore.online/ui/#design-tokens

---

## IMPORTANT: What NOT to do

- **Do NOT ask for API tokens or secrets.** All infra is automated.
- **Do NOT deploy manually.** Push to main = auto-deploy.
- **Do NOT scaffold from scratch.** Use `pas create`.
- **Do NOT import `@freeappstore/sdk` directly.** `@proappstore/sdk` includes everything.
- **Do NOT build custom auth logic.** Use SDK components/hooks (`ProShell`, `ProfileMenu`, `SignInButton`, `useProAuth`). Custom app navigation is fine when it reuses SDK account controls.
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

### Three ways to build an app

**1. Direct build via MCP (you are the developer).**
Use MCP tools as your file system — no local clone needed:
- `scaffold_app` — create a GitHub repo from the template
- `sdk_reference` / `recipe` — read SDK docs and get copy-paste code patterns
- `write_file` / `batch_write_files` — write app source code directly to the repo
- `read_file` / `search_files` / `list_files` — inspect existing code
- `provision_app` — register the R2 route + D1 database (makes it live)
- Push to main triggers auto-deploy to R2 (the deploy workflow is in the template)

This is the most powerful mode for an AI agent: full SDK knowledge via `sdk_reference`, 19 recipes via `recipe`, and direct file writes via MCP. No local machine required.

**2. Agent Teams (autonomous AI build).**
Create a project with `create_app`, describe what you want via `chat_agent`, and AI agents (PO/BA/Dev/QA) build it autonomously. Auth-capable clients such as `mcp-remote` use browser OAuth on first connection. Clients that cannot run browser OAuth can send the PAS session token from `~/.proappstore/config.json` (field `session.token`, set by `pas login`). If the Console shows `project_not_initialized`, call `create_app` to initialize it.

**3. Local development.**
`pas create <id>` scaffolds locally, you code it, `git push` deploys.

---

Platform tools: `list_apps`, `deploy_status`, `app_info`, `platform_guide`, `sdk_reference` (18 feature sections: auth, db, storage, maps, AI, subscriptions, rooms, hooks, UI, recipes, design_system, etc.), `discover_tools`, and `recipe` (19 pre-built code patterns).

### Drive the Agent Teams loop over MCP

You can build an app end-to-end from your own AI client. Each tool takes a PAS
session `token` (the owner's; the account needs a BYO Anthropic key for agents to
run): `create_app`, `list_projects`, `get_project`, `build_knowledge_base`,
`chat_agent` (`thread:'build'`→PO files tickets; `thread:'research'`→Architect
revises the KB), `list_tickets`, `list_agents` (resolved agent catalog),
`get_project_files`, `set_project_running` (play/pause), `set_project_budget`
(monthly cost cap). See [Agent customization](https://docs.proappstore.online/).

### Your app can expose its own tools

ProAppStore is **AI-first**: any app can publish tools to this MCP server, so an
external AI can call the app's data operations as `<app_id>/<tool_name>`.

Declare them in an **`mcp.json`** at the repo root — each tool is one
parameterized SQL statement against your app's D1:

```json
{
  "tools": [
    {
      "name": "list_items",
      "description": "List the signed-in user's items, newest first",
      "operation": "query",
      "sql": "SELECT id, title FROM items WHERE user_id = :__user_id ORDER BY created_at DESC LIMIT :limit",
      "params": { "limit": { "type": "integer", "default": 50, "max": 200, "optional": true } },
      "requires_auth": true
    }
  ]
}
```

- `operation`: `query` (a single `SELECT`, returns rows) or `execute` (a single
  `INSERT`/`UPDATE`/`DELETE`; `UPDATE`/`DELETE` need a `WHERE`). No semicolons,
  one statement, no DDL.
- Bind values with `:name` placeholders declared in `params` (`string` /
  `integer` / `number` / `boolean`).
- Magic placeholders (don't declare them): `:__user_id` (the caller — forces
  `requires_auth: true`), `:__now` (ms epoch), `:__uuid` (a fresh id).
- App-data tools should be authenticated by default, including reads. Use
  `requires_auth: true` unless the data is deliberately public.
- Role and permission checks are enforced in SQL today: combine `:__user_id`
  with app-domain tables such as memberships (`WHERE org_id = :org_id AND
  user_id = :__user_id AND role = 'manager'`). Manifest-level `app_roles` /
  `platform_roles` gates are the intended next extension, not yet enforced by
  the production tool registry.
- Max 50 tools per app.

**Registration is automatic.** `pas publish` registers a CLI app's `mcp.json`;
the Agent Teams deploy stage registers an agent-built app's `mcp.json` after a
green deploy. Then `discover_tools` shows it and `<app>/<tool>` calls it (tools
with `requires_auth` run as the connected user). The MCP transport is
authenticated, so tool discovery and calls are tied to a PAS user. Full guide:
[docs › MCP App Tools](https://docs.proappstore.online/mcp-app-tools/).

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
│   ├── meetup/     → proappstore-online/meetup (platform default apps)
│   ├── carsads/    → carsads-online/carsads (third-party creator)
│   └── ...         (creators host apps in their own GitHub accounts)
└── templates/      → app scaffolding
```

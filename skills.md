# ProAppStore — AI Agent Guide

Point your Claude Code, Codex, or any AI agent to this file for platform-aware development.

**Add to your CLAUDE.md or agent config:**
```
See https://proappstore.online/skills.md for platform skills.
```

---

## What is ProAppStore?

The paid counterpart to FreeAppStore. A marketplace for premium web apps with cloud sync, server-side AI, real-time collaboration, and Stripe-powered subscriptions. Developers set their own subscription prices; the platform takes a 10% commission.

- **Store**: https://proappstore.online
- **Free tier**: https://freeappstore.online (see its [skills.md](https://freeappstore.online/skills.md))
- **GitHub org**: https://github.com/proappstore-online

---

## Quick start — contribute to the platform

```bash
# Clone the platform monorepo
gh repo clone proappstore-online/platform pas-platform
cd pas-platform

# Install and run
pnpm install
pnpm build
pnpm typecheck
```

---

## What Pro adds over Free

| Feature | Free (FAS) | Pro (PAS) |
|---------|-----------|-----------|
| Hosting | CF Pages (static) | CF Pages + Workers |
| Auth | GitHub OAuth | GitHub OAuth + extended |
| Storage | 1MB/user KV | 10MB/user KV, no user-count cap |
| Real-time | 5 rooms × 25 connections, 50 user-hours/day | Uncapped |
| AI | None | Server-side AI via API key vault |
| Payments | None | Stripe Connect, developer-set pricing |
| Custom domain | No | Yes |
| Cron/scheduled | No | Yes |
| Email | No | Transactional email quota |

---

## Architecture

Platform monorepo at `proappstore-online/platform`:

| Package | Purpose |
|---------|---------|
| `packages/backend` | CF Worker — auth, KV, rooms, subscriptions, AI proxy |
| `packages/cli` | `pas` CLI — scaffold, publish, manage pro apps |
| `packages/sdk` | `@proappstore/sdk` — client library for pro features |

App developers import both SDKs:

```ts
import { initApp } from '@freeappstore/sdk';   // free: auth, KV, rooms
import { initPro } from '@proappstore/sdk';     // pro: subscriptions, AI, higher quotas

const fas = initApp({ appId: 'bandmates' });
const pas = initPro({ appId: 'bandmates' });
```

---

## IMPORTANT: What NOT to do

- **Do NOT ask for API tokens, CF keys, or secrets.** All infra is automated.
- **Do NOT provision manually.** No `wrangler` commands for setup.
- **Do NOT deploy manually.** Push to main = auto-deploy.
- **Do NOT handle Stripe keys directly.** The platform proxies all payment flows.
- **Do NOT store user API keys client-side.** The API key vault handles server-side injection.

---

## Tech stack

- TypeScript ^5.7, React ^19, Vite ^6, Tailwind CSS ^4.1, pnpm
- Node >=22
- Backend: Cloudflare Workers + D1 + Durable Objects
- Payments: Stripe Connect
- AI proxy: Server-side key vault (users add keys once, apps call through proxy)

---

## Deployment

```
Push to main → GitHub Actions → auto-deploy
```

No manual deploy commands. Same trunk-based model as the free stores.

---

## Current status

**v0 skeleton.** Public API surfaces are defined; implementations are stubs. Production-ready modules landing iteratively.

---

## Support

| Need | Where |
|------|-------|
| Platform docs | This file |
| GitHub org | https://github.com/proappstore-online |
| Free tier guide | https://freeappstore.online/skills.md |

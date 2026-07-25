# ronzzdoi-public-web

Public-facing web frontend for [ronzzdoi](https://github.com/Ron-RONZZ-org/ronzzdoi) — the in-house DOI and citation management system at ronzz.org.

Built with [Astro](https://astro.build) + [Svelte 5](https://svelte.dev) + [Tailwind CSS 4](https://tailwindcss.com).

## Features

- **Search** — FTS5 full-text search across DOI metadata
- **Browse** — browse all DOI records with filtering by type
- **Resolve** — redirect to target URLs via `doi.ronzz.org/<id>`
- **Cite** — formatted citations (APA, Vancouver, JSON)
- **Rate-limited** — public API calls are throttled via slowapi
- **No auth** — read-only public interface; authentication is handled by the backend

## Architecture

```
Browser ──HTTPS──► Cloudflare (edge TLS)
                      │
                      ▼
                  nginx (port 80)
                      │
                  proxy_pass
                      ▼
            Astro SSR (127.0.0.1:4321)
                      │
                  API call
                      ▼
            ronzzdoi API (127.0.0.1:8012)
```

The Astro server runs in **SSR mode** (`@astrojs/node`, standalone). The public web
frontend and the ronzzdoi API run on the same machine; the web server proxies API
calls internally.

## Quick Start

### Prerequisites

```bash
node >= 22
npm
```

### Install & run

```bash
npm ci
npm run dev
```

The dev server starts on `http://localhost:4321`. Set `API_BASE_URL` in `.env`
to point to a running ronzzdoi backend (default: `http://127.0.0.1:8012`).

### Build

```bash
npm run build
```

Output goes to `dist/` (server entry at `dist/server/entry.mjs`, static assets at `dist/client/`).

## Deployment

### Production server

| Aspect | Detail |
|--------|--------|
| Server | `ronzz-linux-server-2` (`158.178.193.231`, OCI Ubuntu 24.04) |
| Domain | `https://doi.ronzz.org` (Cloudflare proxied, TLS at edge) |
| User | `ronzz` (system user, no login) |
| Path | `/opt/ronzzdoi-public-web` |
| Service | `ronzzdoi-web.service` — Astro SSR on `127.0.0.1:4321` |
| Entry | `/usr/bin/node dist/server/entry.mjs` |
| Env | `API_BASE_URL=http://127.0.0.1:8012` |

### Reverse proxy

nginx on the server proxies `doi.ronzz.org` → `127.0.0.1:4321`. Cloudflare
handles TLS termination (`proxied: true`). A fallback Let's Encrypt cert on
port 443 enables direct-IP HTTPS access when needed.

### Auto-deploy (GitHub Actions)

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. SSH into the server as `ubuntu` (passwordless sudo)
2. `git pull` in `/opt/ronzzdoi-public-web`
3. `npm ci` → `npm run build`
4. `systemctl restart ronzzdoi-web`

The deploy key is stored as GitHub repo secret `DEPLOY_SSH_KEY` (shared with
ronzzdoi).

## Testing

```bash
npm run test    # vitest
```

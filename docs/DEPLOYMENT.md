# Deployment

**Current status: the demo is live on GitHub Pages; the product is not
deployed anywhere**, because there is no server to deploy yet. This file
records where we intend to run, why, and what to watch out for — written for
someone without cloud operations experience.

The short version: **don't start on AWS** (decision 016). Start on a
platform-as-a-service, move to AWS when there's a concrete reason.

## The demo (live)

The Ludo playground deploys to **GitHub Pages** on every push to the default
branch, via `.github/workflows/pages.yml`:

<https://marcuseinar.github.io/spelstugan/>

This works because the playground is genuinely static — the rules run in the
browser and there is no server to host. It is a demo, not the product:
hot-seat only, nothing persists, and a refresh loses the game.

Two things worth knowing if it ever breaks:

- **Pages is enabled by the workflow itself**, via `enablement: true` on
  `configure-pages`. Without that the first run fails with "Get Pages site
  failed", because Pages is off by default. If it is ever switched off by
  hand, the next push turns it back on.
- **The site is served from `/<repo>/`, not the domain root.** The workflow
  passes `BASE_PATH` so Vite rewrites asset URLs; without it every asset 404s
  while the page itself still loads. That is the usual way a Pages deploy of a
  bundled app fails.

The workflow runs `npm run check` before building, because a broken demo is
worse than no demo.

Once there is a server, Pages stops being enough — it can only serve files.
That is when the section below starts to matter.

## Why not AWS first

AWS is often described as the cheap option. It is cheap *if you already know
which twelve services you need and which four will quietly bill you*. For
someone learning it, it is the expensive option — paid in weeks, and in
surprise invoices.

What this product needs to run is genuinely small:

- one always-on process serving HTTP,
- a database,
- static file hosting for the frontend,
- eventually a websocket layer.

On Fly.io, Render, or Railway that's one config file and a `git push`. On AWS
the same shape means learning VPCs, security groups, IAM roles, task
definitions, load balancers, and RDS parameter groups — before any of it plays
Ludo. Meanwhile the monthly cost is comparable, and often *higher* on AWS
because the beginner-friendly paths (Fargate, ALB, NAT Gateway, RDS) are the
expensive ones.

Nothing in the architecture is provider-specific — the rules are pure
functions and state is a move log — so this is cheap to reverse later. That's
precisely why it shouldn't be decided now.

Rough sense of scale for a project this size: a PaaS runs it for roughly
$5–20/month. A naive AWS setup can reach that before serving a single request,
because several AWS components bill by the hour whether or not anyone is using
them.

## Recommended first deployment

1. **Frontend** — static hosting with a CDN. Any of Cloudflare Pages, Netlify,
   or Vercel; free at this scale.
2. **Backend** — one small always-on instance on Fly.io or Render.
3. **Database** — managed Postgres from the same provider, or Neon/Supabase.
   Postgres rather than SQLite once more than one process exists; SQLite is
   fine for local development.
4. **Backups from day one.** A move log is the source of truth for every game
   ever played. Losing it loses the product's memory. Verify a restore
   actually works — an untested backup is a rumour.

## When AWS does make sense

Revisit when one of these is true — not before:

- Measured traffic a PaaS struggles with, or PaaS costs that exceed AWS plus
  the operational time AWS costs.
- A hard requirement for a service only AWS provides.
- Meaningful AWS credits.

### What the migration would look like

Mapping the same four pieces onto the smallest sensible AWS:

| Need | Service | Rough cost | Notes |
|---|---|---|---|
| Static frontend | S3 + CloudFront | cents | Genuinely cheap and simple; fine to adopt early on its own |
| Backend | Lightsail, or EC2 `t4g.small` | ~$5–12/mo | Lightsail bundles a fixed price and predictable bandwidth |
| Database | Postgres on the same box → RDS later | $0 → ~$15/mo | RDS single-AZ, smallest Graviton instance |
| Websockets | The same instance | included | API Gateway websockets bill per message and per connection-minute |

Lightsail specifically exists to be the un-intimidating AWS: fixed monthly
price, bandwidth included, no VPC archaeology. For a single-box backend it is
the right first step into AWS, not ECS or Lambda.

### The cost traps, in order of how often they catch people

1. **NAT Gateway — about $32/month, plus data charges, forever.** The single
   most common surprise on a beginner's bill. It appears automatically in many
   "best practice" VPC templates. If a tutorial gives you private subnets and a
   NAT Gateway, you almost certainly don't need either yet.
2. **Multi-AZ RDS** — doubles the database bill for redundancy that a
   pre-launch product does not need.
3. **Load balancers** — an ALB is roughly $16–20/month before traffic. One
   instance serving TLS directly doesn't need one.
4. **CloudWatch Logs retention defaults to "never expire."** Set a retention
   period (30 days is plenty) the first time you create a log group, or you
   will pay storage on debug output forever.
5. **Idle resources.** Elastic IPs not attached to anything, orphaned EBS
   volumes, and old snapshots all bill quietly.
6. **Fargate/Lambda "scales to zero" reasoning.** True for compute, but the
   surrounding pieces — API Gateway, NAT, log ingestion — often don't, and a
   stateful realtime service fights the serverless model anyway.

### Set these up before creating a single resource

- **AWS Budgets** with an email alert at a threshold that would actually
  worry you. Do this first, always.
- **A billing alarm** in CloudWatch as a second line of defence.
- **Cost Explorer** enabled, and check it weekly for the first month.
- **An IAM user with MFA** for daily use; never work as the root account.
- **Tag every resource** with the project name, so Cost Explorer can attribute
  spend rather than showing one undifferentiated total.
- **Graviton (ARM) instances** where offered — same performance, cheaper, and
  Node runs on ARM without issue.
- Pick one region and stay in it. Cross-region data transfer is billed, and
  resources in a forgotten region are invisible until the invoice.

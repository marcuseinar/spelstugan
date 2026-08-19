# Deployment

**Current status: the demo is live on GitHub Pages; the product is not
deployed anywhere**, because there is no server to deploy yet. This file
records where we intend to run, why, and what to watch out for — written for
someone without cloud operations experience.

The short version: **the server runs on Cloudflare Workers with Durable
Objects** (decision 021), and **not on AWS** (decision 016) until there is a
concrete reason. Setup instructions are below; the AWS material is kept as the
comparison it is.

## The demo (live)

The demo shell deploys to **GitHub Pages** on every push to the default
branch, via `.github/workflows/pages.yml`:

<https://marcuseinar.github.io/spelstugan/> — the shell
<https://marcuseinar.github.io/spelstugan/playground/> — the board on its own

This works because the demo is genuinely static — the rules run in the browser
and there is no server to host. It is a demo, not the product: hot-seat only,
chat that talks to itself, and a refresh loses everything.

Two things worth knowing if it ever breaks:

- **Pages must be enabled once, by hand**: Settings -> Pages -> Source:
  **GitHub Actions**. Until then the workflow fails at `configure-pages` with
  "Get Pages site failed". Automating it with `enablement: true` does not
  work — creating a Pages site needs repository admin, and the workflow token
  is refused with "Resource not accessible by integration". Granting that
  would mean storing a personal access token as a secret, which is a poor
  trade for a setting clicked once.
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

On Cloudflare, Fly.io, or Render that's one config file and a `git push`. On
AWS the same shape means learning VPCs, security groups, IAM roles, task
definitions, load balancers, and RDS parameter groups — before any of it plays
Ludo. Meanwhile the monthly cost is comparable, and often *higher* on AWS
because the beginner-friendly paths (Fargate, ALB, NAT Gateway, RDS) are the
expensive ones.

What the same product costs per month, priced in August 2026:

| Option | Monthly | Who administers the machine |
|---|---|---|
| Cloudflare Workers + Durable Objects | $0, then $5 | nobody |
| Render — web service plus Postgres | ~$14 | nobody |
| AWS Lightsail, Postgres on the same box | $8–15 | you, over SSH |
| AWS as most tutorials build it | $75–95 | you, plus IAM |

That last row is not an exotic setup: it is Fargate, an ALB, a NAT Gateway and
RDS — the standard "production-ready" walkthrough. The NAT Gateway alone is
about $32/month and exists only so containers can reach the internet.

A new AWS account no longer gets the old twelve-month free tier either: it
gets credits and a plan that ends after six months. Free until it isn't, which
is worse than either free or paid.

Nothing in the architecture is provider-specific — the rules are pure
functions and state is a move log — so this stays cheap to reverse.

## Where the server will run

**Cloudflare Workers, with one Durable Object per game table** (decision 021).

The fit is the reason, not the price. A Durable Object is a single, consistent,
addressable object with storage attached — which is exactly what a game table
is: one move log, one strict order of events, one place the truth lives. It
also comes with WebSockets, so the realtime transport that phase 2 needs
(decision 005) arrives with the model rather than as a later bolt-on.

| Piece | Where | Cost |
|---|---|---|
| Frontend | GitHub Pages now; Workers static assets when there's a domain | free |
| Game tables | One Durable Object each, move log in its SQLite storage | free tier |
| Accounts, servers, channels | D1 when the relational shape is needed | free tier |
| Realtime | WebSockets on the Durable Object | included |

The Workers free plan covers this comfortably at our size; Workers Paid is a
$5/month minimum if we outgrow it. Confirm current limits on Cloudflare's
pricing page before relying on any number here — free tiers move.

**The cost that isn't money:** this is the Workers runtime, not Node. Our
reducer is pure TypeScript and the server layer is thin, so the fit is good,
but it is a more opinionated bet than a Linux box. `packages/game-kit` and the
game plugins must stay free of Node-specific APIs so they run in either place.

**Backups from day one.** The move log is the source of truth for every game
ever played; losing it loses the product's memory. Export it on a schedule and
verify a restore actually works — an untested backup is a rumour.

## Setting up Cloudflare

One-time, and every step is a web page — it works from a phone. Nothing here
needs a payment method.

1. **Create a free Cloudflare account** at `dash.cloudflare.com` and verify the
   email.
2. **Copy the Account ID.** Dashboard → *Workers & Pages*. The account ID is
   shown on the overview page (on a narrow screen it may be under the account
   menu rather than a sidebar).
3. **Create an API token.** Profile menu → *API Tokens* → *Create Token* →
   start from the **"Edit Cloudflare Workers"** template. Under *Account
   Resources* pick your account; under *Zone Resources* pick "All zones" —
   or leave it empty if no domain is attached yet. Create it, then **copy the
   token: it is shown once and never again**.
   - If the template has been renamed, a custom token works: Account →
     *Workers Scripts* → Edit, plus Account → *Account Settings* → Read.
   - The template does not include D1. Add Account → *D1* → Edit when the
     first D1 database appears; Durable Objects need nothing extra, since
     they deploy as part of the Worker script.
4. **Put the token in GitHub, not anywhere else.** Repository → *Settings* →
   *Secrets and variables* → *Actions* → *New repository secret*, named
   `CLOUDFLARE_API_TOKEN`. Add the account ID the same way as
   `CLOUDFLARE_ACCOUNT_ID` (it is not secret, but keeping the pair together is
   simpler than remembering which is which).

**Never paste the token into a chat, an issue, a commit, or a config file.**
This repository is public. A token that has been shown anywhere else is burned
and must be rolled — Cloudflare's token list has a *Roll* action for exactly
that. GitHub secrets are write-only to everyone including agents working on
the repo, which is the property that makes this arrangement safe.

## How deploys work

**Live at <https://spelstugan.marcus-einar.workers.dev>** — `GET /` answers
with `{"service":"spelstugan","status":"ok"}`.

Same shape as the demo: pushing is the deploy.

```yaml
- uses: cloudflare/wrangler-action@v4
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: deploy
```

The gates run first — a deploy that skips `npm run check` is how a broken
demo ships. Configuration lives in `wrangler.toml` next to the Worker, in
version control, because the shape of the deployment is part of the code.

**And the deploy is not the proof.** After publishing, the workflow plays a
whole game of Ludo against the URL it just deployed to: seats a table, plays to
a winner, reads the log back, and tries every way of asking wrongly. A green
Server run means the live server played a game, not merely that an upload
succeeded.

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

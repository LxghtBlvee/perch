# Contributing to Perch

Thanks for taking the time to contribute! This guide covers how to get a local
environment running, how the repo is laid out, and what we expect on a pull
request.

## Ways to contribute

- **Reporting a bug:** open an [issue](https://github.com/LxghtBlvee/perch/issues?q=sort%3Aupdated-desc+is%3Aissue+state%3Aopen+) with steps to reproduce, what you expected,
  and what actually happened.
- **Request a feature:** open an [issue](https://github.com/LxghtBlvee/perch/issues?q=sort%3Aupdated-desc+is%3Aissue+state%3Aopen+) describing the problem you're trying to
  solve (not just the solution you have in mind).
- **Send a [pull request](https://github.com/LxghtBlvee/perch/pulls?q=sort%3Aupdated-desc+is%3Apr+state%3Aopen+):** Minor fixes, and small contributions are welcome. For
  anything large, open an [issue](https://github.com/LxghtBlvee/perch/issues?q=sort%3Aupdated-desc+is%3Aissue+state%3Aopen+) first so we can agree on the approach before you
  write code.
- **Improve the docs:** the user-facing docs are published at
  [perch.lxghtblvee.dev/docs](https://perch.lxghtblvee.dev/docs). To suggest a
  change, open an issue describing what's wrong or missing.

## Found a security issue?

Please **do not** open a public issue. Follow the [security policy](./SECURITY.md)
to report it privately.

## Development setup

**Prerequisites:** [Bun](https://bun.sh) and Docker (for the Postgres database).

```bash
git clone https://github.com/LxghtBlvee/perch.git
cd perch
bun install
```

Run the whole stack (hub, agent, and database) with Docker:

```bash
docker compose up -d
```

Or run the dev servers individually with live reload:

```bash
bun dev:hub     # dashboard + API (Elysia)
bun dev:web     # frontend (Vue 3 + Vite)
bun dev:agent   # metrics collector
```

## Project structure

This is a Bun workspaces monorepo.

| Path             | What it is                                            |
| ---------------- | ----------------------------------------------------- |
| `apps/hub`       | Dashboard + API — serves the UI and streams live data |
| `apps/web`       | Vue 3 frontend, built with Vite                       |
| `apps/agent`     | Lightweight per-host metrics/container collector      |
| `packages/types` | Shared TypeScript types used across the apps          |

## Before you open a pull request

Branch off and target **`live`** (the default branch). Run these locally first —
CI runs the same checks and will block the PR otherwise:

```bash
bun lint        # ESLint (use `bun lint:fix` to autofix)
bun typecheck   # type-check hub, agent, and web
```

If you touched the hub or agent, make sure their Docker images still build
(CI runs `apps/hub/Dockerfile` and `apps/agent/Dockerfile` on every PR):

```bash
docker build -f apps/hub/Dockerfile .
docker build -f apps/agent/Dockerfile .
```

## Commit and PR conventions

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/)
— this is enforced by CI. Use one of these types:

`feat:` &nbsp; `fix:` &nbsp; `docs:` &nbsp; `refactor:` &nbsp; `perf:` &nbsp;
`test:` &nbsp; `build:` &nbsp; `ci:` &nbsp; `chore:`

Examples:

```
feat: add ntfy support to the alert engine
fix: prevent agent reconnect loop when the hub restarts
docs: clarify the reverse-proxy WebSocket requirement
```

Keep PRs focused — one logical change per PR is much easier to review than a
grab-bag of unrelated edits.

## License

By contributing to Perch, you agree that your contributions will be licensed
under the [AGPL-3.0](./LICENSE), the same license that covers the project.

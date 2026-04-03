# codebase.agent

A chat-based developer agent for exploring unfamiliar codebases. Paste any code, ask anything — architecture, documentation, bugs, refactors. Built with Next.js and Claude.

![codebase.agent screenshot](screenshot.png)

## What it does

- **Explain** — understand overall architecture, data flow, design patterns
- **Document** — generate JSDoc, docstrings, inline comments, READMEs
- **Debug** — identify bugs, edge cases, and code smells
- **Refactor** — get concrete improvement suggestions

Conversation history persists across page refreshes via localStorage, so you can pick up where you left off.

## Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- [Anthropic Claude](https://anthropic.com) via `@anthropic-ai/sdk`
- Streaming responses via the Web Streams API
- Zero UI dependencies — plain React + CSS

## Running locally

```bash
git clone https://github.com/YOUR_USERNAME/codebase-agent
cd codebase-agent
npm install
cp .env.local.example .env.local
# add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add `ANTHROPIC_API_KEY` as an environment variable
4. Deploy

The API key is never exposed to the browser — all Anthropic calls are proxied through a Next.js API route.

## Architecture

```
app/
├── page.jsx          # chat UI — streaming reader, localStorage persistence
├── globals.css       # dark developer theme
└── api/chat/
    └── route.js      # server-side Anthropic proxy (streaming)
```

The `/api/chat` route accepts `{ messages, codebase }`, injects the codebase into a system prompt, and streams the response back as plain text. The client reads the stream incrementally using `response.body.getReader()`.

## Why this exists

Built as a side project to explore what a genuinely useful AI coding agent needs — and where current models fall short. Key observations:

- **Multi-turn context** works well for complex codebases
- **Static analysis** is useful but ungrounded — the agent can't run code to verify its findings
- **Documentation generation** is the highest-value use case today
- **Persistent project memory** across sessions is the most important missing primitive

## License

MIT

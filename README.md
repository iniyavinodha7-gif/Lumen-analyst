# LUMON — Conversational Business Data Analyst

LUMON is a full-stack conversational data-analysis application built with React, TanStack Start, TypeScript, Supabase and Pyodide. It lets authenticated users upload business datasets, ask questions in natural language, execute verified analysis in the browser, and explore interactive Plotly visualizations.

## Run locally

Requirements: Node.js 20+ (or Bun), a Supabase project, and a Google Gemini API key.

1. Copy `.env.example` to `.env`.
2. Set the Supabase and Gemini environment variables.
3. Install dependencies: `npm install` (or `bun install`).
4. Start development: `npm run dev`.
5. Open the local URL shown by Vite.

## Core capabilities

- Authentication and user profiles
- Conversation history and persistent messages
- Conversation-scoped dataset context
- CSV, TSV, JSON and Excel analysis
- Automatic dataset profiling and data-quality scoring
- Browser-side Python execution with Pyodide
- Business/HR/sales/customer/finance/marketing/inventory analysis
- Interactive Plotly charts
- Conversational chart changes
- Verified numerical explanations based on executed Python output
- Notebook export
- Dashboard and pinned insights
- Dark/light/system theme support
- Voice and responsive chat experience

## Architecture

The browser owns the uploaded dataframe and executes generated analysis locally with Pyodide. The server-side AI layer calls Google Gemini directly; no proprietary app-builder gateway is required. Supabase remains the persistence/authentication layer in this baseline release.

## Deployment

The application can be deployed to Vercel or another Node-compatible hosting target. Configure the same environment variables in the deployment environment. Never commit real API keys.

## Documentation

See the accompanying HLD and LLD documents for architecture, modules, data flows and database design.

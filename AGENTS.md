# LUMON Development Guide

This repository is a standalone Conversational Business Data Analyst application.

## Local workflow

- Install dependencies with `npm install` or `bun install`.
- Run development with `npm run dev`.
- Run a production build with `npm run build`.
- Run linting with `npm run lint`.

## Architecture rules

- Keep uploaded dataframe execution in the browser through Pyodide.
- Keep AI credentials server-side.
- Keep conversations and datasets scoped to the authenticated user and conversation.
- Do not commit secrets.

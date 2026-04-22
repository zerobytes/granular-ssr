# @granularjs/ssr

Server-side rendering and streaming adapters for `@granularjs/core`.

## Features

- `renderToStringAsync(view, options?)` — full markup, awaiting all `Suspense` boundaries.
- `renderToReadableStream(view, options?)` — Web Streams: shell first, suspense chunks streamed out-of-order.
- `renderToNodeStream(view, options?)` / `renderToNodeWritable(view, writable)` — Node.js streams.
- `expressMiddleware(viewFactory, options?)` — drop-in middleware for Express/Connect.
- `Suspense` / `suspense({ fallback, promise })` — async boundary that flushes when its promise resolves.
- `inlineHydrationScript(name, data)` — safely embeds JSON-safe state for client hydration.

## Install

```bash
npm install @granularjs/core @granularjs/ssr
```

## Suspense + streaming

```js
import express from 'express';
import { Div, H1, P, Span } from '@granularjs/core';
import { expressMiddleware, suspense, inlineHydrationScript } from '@granularjs/ssr';

const app = express();

app.get('/', expressMiddleware(async ({ req }) => {
  return Div(
    H1('Welcome'),
    suspense({
      fallback: Span('loading...'),
      promise: fetch('https://api.example.com/feed').then((r) => r.json()).then((feed) =>
        Div(...feed.items.map((it) => P(it.title)))
      ),
    }),
    // Hydrate client state
    inlineHydrationScript('__APP__', { route: req.path, ts: Date.now() }),
  );
}));
```

The browser receives the shell instantly; each `Suspense`'s resolved markup is appended as a `<template data-granular-suspense-resolved>` chunk, which a tiny inlined script swaps into place. No JS framework needed for the swap itself.

## Manual streaming

```js
import { renderToReadableStream } from '@granularjs/ssr';

const stream = renderToReadableStream(view);
return new Response(stream, {
  headers: { 'content-type': 'text/html; charset=utf-8' },
});
```

## Awaiting full HTML (no streaming)

```js
import { renderToStringAsync } from '@granularjs/ssr';

const html = await renderToStringAsync(view, {
  errorFallback: (err) => Div({ class: 'error' }, err.message),
});
```

import test from 'node:test';
import assert from 'node:assert/strict';
import { Div, Span, P, H1, renderToString } from '@granularjs/core';
import { suspense, renderToStringAsync, inlineHydrationScript } from '../src/index.js';
import { renderToReadableStream } from '../src/web.js';

test('renderToString: plain markup', () => {
  const out = renderToString(Div({ class: 'page' }, H1('Hi'), P('body')));
  assert.match(out, /<div[^>]*class="page"[^>]*>/);
  assert.match(out, /<h1>Hi<\/h1>/);
  assert.match(out, /<p>body<\/p>/);
});

test('renderToStringAsync: resolves Suspense placeholders', async () => {
  const view = Div(
    H1('Shell'),
    suspense({
      fallback: Span('loading...'),
      promise: Promise.resolve(P('async ready')),
    }),
  );
  const html = await renderToStringAsync(view);
  assert.doesNotMatch(html, /loading/);
  assert.match(html, /async ready/);
  assert.doesNotMatch(html, /data-granular-suspense=/);
});

test('renderToStringAsync: error branch uses errorFallback', async () => {
  const view = Div(suspense({
    fallback: Span('loading'),
    promise: Promise.reject(new Error('nope')),
  }));
  const html = await renderToStringAsync(view, {
    errorFallback: (err) => Span(`err: ${err.message}`),
  });
  assert.match(html, /err: nope/);
});

test('renderToReadableStream: emits shell then resolved chunks', async () => {
  let resolveLater;
  const later = new Promise((r) => { resolveLater = r; });
  const view = Div(
    H1('shell'),
    suspense({ fallback: Span('loading'), promise: later }),
  );
  const stream = renderToReadableStream(view);
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  const chunks = [];
  let pendingRead = reader.read();
  const first = await pendingRead;
  chunks.push(decoder.decode(first.value));

  resolveLater(P('done'));
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(decoder.decode(r.value));
  }
  const all = chunks.join('');
  assert.match(all, /shell/);
  assert.match(all, /data-granular-suspense-resolved/);
  assert.match(all, /done/);
});

test('inlineHydrationScript: escapes closing script tags', () => {
  const s = inlineHydrationScript('__APP__', { html: '</script><img/>' });
  assert.doesNotMatch(s, /<\/script>(?!\s*$)/);
  assert.match(s, /window\["__APP__"\]/);
});

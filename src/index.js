import { renderToString } from '@granularjs/core';
import { registerSuspenseCollector } from './suspense.js';

export { Suspense, suspense, registerSuspenseCollector } from './suspense.js';
export { renderToReadableStream } from './web.js';
export { renderToNodeStream, renderToNodeWritable, expressMiddleware } from './node.js';

/**
 * Walks the rendered output and collects pending Suspense promises.
 * The collector pattern: render once with a tracking context, then await
 * any remaining promises, replacing the placeholders with their resolved
 * markup.
 */
export async function renderToStringAsync(view, options = {}) {
  const collected = [];
  const off = registerSuspenseCollector((s) => collected.push(s));
  try {
    const html = renderToString(view);
    if (collected.length === 0) { off(); return html; }

    const resolved = await Promise.all(collected.map(async (s) => {
      try {
        const value = await s.promise;
        const inner = renderToString(value);
        return { id: s.id, html: inner, ok: true };
      } catch (err) {
        const fallback = options.errorFallback
          ? renderToString(options.errorFallback(err, s))
          : `<!-- suspense ${s.id} failed: ${escape(String(err && err.message || err))} -->`;
        return { id: s.id, html: fallback, ok: false };
      }
    }));

    let out = html;
    for (const r of resolved) {
      const marker = `<template data-granular-suspense="${r.id}">`;
      const start = out.indexOf(marker);
      if (start === -1) {
        out += `<!-- orphan suspense ${r.id} -->${r.html}`;
        continue;
      }
      const closingTagEnd = out.indexOf('</template>', start);
      if (closingTagEnd === -1) continue;
      out = out.slice(0, start) + r.html + out.slice(closingTagEnd + '</template>'.length);
    }
    return out;
  } finally {
    off();
  }
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Serializes plain JSON-safe data into an inline `<script>` tag suitable
 * for hydration on the client. Uses `JSON.stringify` and escapes the closing
 * script tag.
 */
export function inlineHydrationScript(globalName, data) {
  const safe = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  return `<script>window["${globalName}"]=${safe};</script>`;
}

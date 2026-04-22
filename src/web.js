import { renderToString } from '@granularjs/core';
import { registerSuspenseCollector } from './suspense.js';

/**
 * Streams a Granular view as a Web `ReadableStream<Uint8Array>`.
 * Renders the shell synchronously, then flushes resolved Suspense chunks
 * out-of-order in `<template>` islands the client can swap in.
 */
export function renderToReadableStream(view, options = {}) {
  const encoder = new TextEncoder();
  const collected = [];
  const off = registerSuspenseCollector((s) => collected.push(s));
  let shell;
  try {
    shell = renderToString(view);
  } finally {
    off();
  }

  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const swapClient = options.includeSwapClient !== false;

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(shell));
      if (swapClient && collected.length > 0) {
        controller.enqueue(encoder.encode(SWAP_SCRIPT));
      }
      await Promise.all(collected.map(async (s) => {
        try {
          const value = await s.promise;
          const html = renderToString(value);
          controller.enqueue(encoder.encode(formatChunk(s.id, html)));
        } catch (err) {
          onError(err, s);
          const fallback = options.errorFallback
            ? renderToString(options.errorFallback(err, s))
            : `<!-- suspense ${s.id} failed -->`;
          controller.enqueue(encoder.encode(formatChunk(s.id, fallback)));
        }
      }));
      controller.close();
    },
  });
}

function formatChunk(id, html) {
  return `<template data-granular-suspense-resolved="${id}">${html}</template>`;
}

const SWAP_SCRIPT = `<script>(function(){
  function swap(t){
    var id=t.getAttribute('data-granular-suspense-resolved');
    var ph=document.querySelector('template[data-granular-suspense="'+id+'"]');
    if(!ph){t.remove();return;}
    var frag=document.createDocumentFragment();
    var src=t.content||document.createElement('div');
    if(t.content){while(src.firstChild) frag.appendChild(src.firstChild);}else{src.innerHTML=t.innerHTML;while(src.firstChild) frag.appendChild(src.firstChild);}
    ph.parentNode.replaceChild(frag,ph);
    t.remove();
  }
  var mo=new MutationObserver(function(records){
    records.forEach(function(rec){rec.addedNodes.forEach(function(n){
      if(n && n.nodeType===1 && n.tagName==='TEMPLATE' && n.hasAttribute('data-granular-suspense-resolved')) swap(n);
    });});
  });
  mo.observe(document.body||document.documentElement,{childList:true,subtree:true});
})();</script>`;


import { Renderable } from '@granularjs/core';

let suspenseSeq = 0;

export function nextSuspenseId() {
  return `__g_suspense_${++suspenseSeq}`;
}

const _collectors = new Set();

export function registerSuspenseCollector(fn) {
  _collectors.add(fn);
  return () => _collectors.delete(fn);
}

function notifyCollectors(suspense) {
  for (const fn of _collectors) fn(suspense);
}

export class Suspense extends Renderable {
  fallback;
  promise;
  id;

  constructor({ fallback, promise } = {}) {
    super();
    if (!promise || typeof promise.then !== 'function') {
      throw new Error('Suspense({ promise }): promise must be a thenable');
    }
    this.fallback = fallback;
    this.promise = Promise.resolve(promise);
    this.id = nextSuspenseId();
  }

  /**
   * Server-only: emits a placeholder marker that the streaming SSR
   * renderer recognizes and replaces (or appends) once the promise resolves.
   */
  renderToString(render) {
    notifyCollectors(this);
    const fb = this.fallback != null ? render(this.fallback) : '';
    return `<template data-granular-suspense="${this.id}">${fb}</template>`;
  }

  /**
   * Browser-only: when used with hydrated DOM we just delegate to the
   * resolved view once the promise settles.
   */
  render() {
    return null;
  }
}

export function suspense({ fallback, promise }) {
  return new Suspense({ fallback, promise });
}

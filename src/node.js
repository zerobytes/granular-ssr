import { Readable } from 'node:stream';
import { renderToReadableStream } from './web.js';

export function renderToNodeStream(view, options = {}) {
  const webStream = renderToReadableStream(view, options);
  return Readable.fromWeb(webStream);
}

export async function renderToNodeWritable(view, writable, options = {}) {
  const stream = renderToNodeStream(view, options);
  return await new Promise((resolve, reject) => {
    stream.on('error', reject);
    writable.on('error', reject);
    writable.on('finish', resolve);
    stream.pipe(writable);
  });
}

/**
 * Express/Connect-style middleware factory.
 *   app.get('/page', expressMiddleware(({ req }) => Layout()));
 */
export function expressMiddleware(viewFactory, options = {}) {
  return async (req, res, next) => {
    try {
      const view = await viewFactory({ req, res });
      res.statusCode = options.status || 200;
      res.setHeader('Content-Type', options.contentType || 'text/html; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      const stream = renderToNodeStream(view, options);
      stream.on('error', (err) => {
        if (typeof next === 'function') next(err);
        else res.destroy(err);
      });
      stream.pipe(res);
    } catch (err) {
      if (typeof next === 'function') next(err);
      else {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  };
}

/**
 * Where a request is going, decided from the method and path alone.
 *
 * Routing is a decision, so it lives in a pure function rather than inside the
 * Worker's request handler: it can be read as a table, and every branch of it
 * is testable without a runtime.
 */

import { normalizeCode } from './codes.js';

export type Route =
  | { readonly kind: 'health' }
  | { readonly kind: 'games' }
  | { readonly kind: 'openTable' }
  | { readonly kind: 'readTable'; readonly code: string }
  | { readonly kind: 'joinTable'; readonly code: string }
  | { readonly kind: 'startTable'; readonly code: string }
  | { readonly kind: 'playMove'; readonly code: string }
  | { readonly kind: 'sayAtTable'; readonly code: string }
  | { readonly kind: 'unknown' };

const UNKNOWN: Route = { kind: 'unknown' };

export function routeFor(method: string, pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');

  if (segments.length === 0) {
    return method === 'GET' ? { kind: 'health' } : UNKNOWN;
  }
  if (segments[0] !== 'api') {
    return UNKNOWN;
  }
  return apiRoute(method, segments.slice(1));
}

function apiRoute(method: string, segments: readonly string[]): Route {
  const [collection, ...rest] = segments;

  if (collection === 'games') {
    return rest.length === 0 && method === 'GET' ? { kind: 'games' } : UNKNOWN;
  }
  if (collection === 'tables') {
    return tableRoute(method, rest);
  }
  return UNKNOWN;
}

/** Everything below `/api/tables`, where a room code names the table. */
function tableRoute(method: string, segments: readonly string[]): Route {
  const [rawCode, action, ...deeper] = segments;

  if (rawCode === undefined) {
    return method === 'POST' ? { kind: 'openTable' } : UNKNOWN;
  }

  const code = normalizeCode(rawCode);
  if (code === null || deeper.length > 0) {
    return UNKNOWN;
  }
  if (action === undefined) {
    return method === 'GET' ? { kind: 'readTable', code } : UNKNOWN;
  }
  if (method !== 'POST') {
    return UNKNOWN;
  }
  return actionRoute(action, code);
}

function actionRoute(action: string, code: string): Route {
  switch (action) {
    case 'players':
      return { kind: 'joinTable', code };
    case 'start':
      return { kind: 'startTable', code };
    case 'moves':
      return { kind: 'playMove', code };
    case 'messages':
      return { kind: 'sayAtTable', code };
    default:
      return UNKNOWN;
  }
}

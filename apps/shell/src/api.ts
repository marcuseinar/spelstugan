/**
 * Talking to the server.
 *
 * Every call answers with a result rather than throwing: a table that is full,
 * a code nobody is at, and a network that is down are all ordinary things a
 * player can cause, and each one needs a sentence on screen rather than an
 * exception in a console.
 */

/** A line in a table's conversation, as the server keeps it. */
export interface TableMessage {
  readonly id: number;
  readonly kind: 'said' | 'joined';
  readonly author?: string;
  readonly text: string;
}

export interface TableSnapshot {
  readonly code: string;
  readonly gameId: string;
  readonly seats: number;
  readonly players: readonly string[];
  readonly phase: 'lobby' | 'playing';
  readonly finished: boolean;
  readonly moveCount: number;
  /** The board, once there is one. Null while the table is still filling. */
  readonly view: { readonly shared: unknown } | null;
  readonly messages: readonly TableMessage[];
}

export type Answer<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

/** What the shell needs of `fetch`, so a test can hand it something smaller. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class Tables {
  constructor(
    private readonly base: string,
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  open(gameId: string, seats: number): Promise<Answer<TableSnapshot>> {
    return this.table('/api/tables', { method: 'POST', body: { game: gameId, seats } });
  }

  join(code: string, name: string): Promise<Answer<TableSnapshot>> {
    return this.table(`/api/tables/${code}/players`, { method: 'POST', body: { name } });
  }

  start(code: string): Promise<Answer<TableSnapshot>> {
    return this.table(`/api/tables/${code}/start`, { method: 'POST' });
  }

  read(code: string, viewer: string | null): Promise<Answer<TableSnapshot>> {
    const query = viewer === null ? '' : `?viewer=${encodeURIComponent(viewer)}`;
    return this.table(`/api/tables/${code}${query}`, { method: 'GET' });
  }

  say(code: string, author: string, text: string): Promise<Answer<TableSnapshot>> {
    return this.table(`/api/tables/${code}/messages`, {
      method: 'POST',
      body: { author, text },
    });
  }

  play(code: string, player: string, move: unknown): Promise<Answer<TableSnapshot>> {
    return this.table(`/api/tables/${code}/moves`, { method: 'POST', body: { player, move } });
  }

  private async table(
    path: string,
    request: { method: string; body?: unknown },
  ): Promise<Answer<TableSnapshot>> {
    const answered = await this.send(path, request);
    if (!answered.ok) {
      return answered;
    }

    const table = tableIn(answered.value);
    if (table === null) {
      return { ok: false, reason: 'The server answered without a table.' };
    }
    return { ok: true, value: table };
  }

  private async send(
    path: string,
    request: { method: string; body?: unknown },
  ): Promise<Answer<unknown>> {
    const init: RequestInit = { method: request.method };
    if (request.body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(request.body);
    }

    let response: Response;
    try {
      response = await this.fetcher(`${this.base}${path}`, init);
    } catch {
      return { ok: false, reason: 'Could not reach the server. Check your connection.' };
    }

    const payload = await readJson(response);
    if (response.ok) {
      return { ok: true, value: payload };
    }
    return { ok: false, reason: errorIn(payload) ?? `The server answered ${response.status}.` };
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * The table in a successful answer, if there is one.
 *
 * A body that is not an object at all reaches here whenever something between
 * the browser and the Worker answers with a page instead — a captive portal, a
 * proxy, an outage — and that must read as "no table", not as a crash.
 *
 * The `typeof` half of the guard states the intent rather than changing the
 * outcome: reading a property off a primitive is already undefined. Mutation
 * testing reports it as a survivor for exactly that reason, and it is an
 * equivalent mutant, not a missing test.
 */
function tableIn(payload: unknown): TableSnapshot | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  return (payload as { table?: TableSnapshot }).table ?? null;
}

function errorIn(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message !== '' ? message : null;
}

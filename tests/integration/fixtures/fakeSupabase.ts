// A fake Supabase client for route-handler tests: a chainable query builder that records every
// call, plus rpc() and auth.getUser(). Responses come from per-test handlers.
import { vi } from "vitest";

export type Op = "select" | "insert" | "update" | "delete";

export interface QueryCall {
  table: string;
  op: Op;
  /** Columns passed to select(), including a trailing .select() after insert/update */
  columns?: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
  order?: [string, unknown];
  limit?: number;
  terminal: "then" | "single" | "maybeSingle";
}

export interface Result {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

export interface FakeOptions {
  user?: { id: string; email?: string } | null;
  query?: (call: QueryCall) => Result | undefined;
  rpc?: (fn: string, args: Record<string, unknown>) => Result | undefined;
}

const OK_EMPTY: Result = { data: null, error: null };

export function createFakeSupabase(opts: FakeOptions = {}) {
  const calls: QueryCall[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  function from(table: string) {
    const call: Partial<QueryCall> & { table: string; filters: Array<[string, unknown]> } = {
      table,
      filters: [],
    };
    const run = (terminal: QueryCall["terminal"]) => {
      const done = { ...call, op: call.op ?? "select", terminal } as QueryCall;
      calls.push(done);
      return Promise.resolve(opts.query?.(done) ?? OK_EMPTY);
    };
    const builder = {
      select(columns?: string) {
        if (!call.op) call.op = "select";
        call.columns = columns ?? "*";
        return builder;
      },
      insert(payload: unknown) {
        call.op = "insert";
        call.payload = payload;
        return builder;
      },
      update(payload: unknown) {
        call.op = "update";
        call.payload = payload;
        return builder;
      },
      delete() {
        call.op = "delete";
        return builder;
      },
      eq(col: string, value: unknown) {
        call.filters.push([col, value]);
        return builder;
      },
      order(col: string, o: unknown) {
        call.order = [col, o];
        return builder;
      },
      limit(n: number) {
        call.limit = n;
        return builder;
      },
      single: () => run("single"),
      maybeSingle: () => run("maybeSingle"),
      then<T1 = Result, T2 = never>(
        onFulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
        onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
      ) {
        return run("then").then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const client = {
    from: vi.fn(from),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return opts.rpc?.(fn, args) ?? OK_EMPTY;
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user ?? null }, error: null })),
    },
  };

  return { client, calls, rpcCalls };
}

/**
 * A tiny stand-in for an OpenAI-compatible AI service (the layout Nightshift and NVIDIA both use).
 * Tests script what each request gets back: a reply, a server error (optionally with headers such as Retry-After), a hang, or a "not allowed".
 * Runs on 127.0.0.1 on a random free port; nothing leaves this machine.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeStep =
  | { kind: 'reply'; content: string; model?: string }
  | { kind: 'status'; status: number; body?: string; headers?: Record<string, string> }
  | { kind: 'hang' };

export interface FakeRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: any;
}

export interface FakeOpenAiServer {
  baseUrl: string;
  requests: FakeRequest[];
  /** Steps used in order for chat calls; the last one repeats. */
  script: FakeStep[];
  /** If set, requests without `Authorization: Bearer <token>` get a 401. */
  token?: string;
  models: string[];
  close(): Promise<void>;
}

export async function startFakeOpenAiServer(opts: { script?: FakeStep[]; token?: string; models?: string[] } = {}): Promise<FakeOpenAiServer> {
  const hung: http.ServerResponse[] = [];
  let chatCalls = 0;
  const state: FakeOpenAiServer = {
    baseUrl: '',
    requests: [],
    script: opts.script ?? [{ kind: 'reply', content: 'ok' }],
    token: opts.token,
    models: opts.models ?? ['fake/model'],
    close: async () => {},
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
      state.requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      const send = (status: number, obj: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(obj));
      };
      if (state.token && req.headers.authorization !== `Bearer ${state.token}`) {
        return send(401, { error: { message: 'wrong token' } });
      }
      if (req.method === 'GET' && req.url?.endsWith('/models')) {
        return send(200, { object: 'list', data: state.models.map((id) => ({ id, object: 'model' })) });
      }
      if (req.method === 'POST' && req.url?.endsWith('/chat/completions')) {
        const step = state.script[Math.min(chatCalls, state.script.length - 1)];
        chatCalls++;
        if (step.kind === 'hang') { hung.push(res); return; }
        if (step.kind === 'status') return send(step.status, { error: { message: step.body ?? `status ${step.status}` } }, step.headers);
        return send(200, {
          id: `chatcmpl-${chatCalls}`,
          object: 'chat.completion',
          created: 0,
          model: step.model ?? body?.model ?? 'fake/model',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: step.content } }],
        });
      }
      send(404, { error: { message: 'not found' } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  state.baseUrl = `http://127.0.0.1:${port}/v1`;
  state.close = () =>
    new Promise<void>((resolve) => {
      for (const r of hung) r.destroy();
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  return state;
}

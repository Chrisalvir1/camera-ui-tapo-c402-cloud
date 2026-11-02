import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { workerSource } from './worker-source.js';

export type ControlKey =
  | 'privacy'
  | 'led'
  | 'motionEnabled'
  | 'personEnabled'
  | 'petEnabled'
  | 'vehicleEnabled'
  | 'whiteLight'
  | 'recordAudio';

export interface Reading {
  observedAt: number;
  battery: { level?: number; charging?: 'CHARGING' | 'NOT_CHARGING'; low?: boolean; overheated?: boolean };
  controls: Partial<Record<ControlKey, boolean>>;
  diagnostic: Record<string, string | number>;
}

export class TelemetryError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

/** One persistent session per camera. Writes are never automatically replayed. */
export class TelemetryClient {
  private child?: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private buffer = '';
  private pending = new Map<number, { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private queue: Promise<unknown> = Promise.resolve();

  private readonly executable: string;
  private readonly timeoutMs: number;
  constructor(executable: string, timeoutMs = 30000) { this.executable = executable; this.timeoutMs = timeoutMs; }

  async start(config: { host: string; port: number; secret: string; controlPort: number }): Promise<Reading> {
    if (this.child) throw new TelemetryError('ALREADY_STARTED');
    this.child = spawn(this.executable, ['-u', '-c', workerSource], { shell: false, windowsHide: true, stdio: 'pipe' });
    this.child.stdout.on('data', (chunk: Buffer) => this.onData(chunk));
    let stderr = '';
    this.child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-1024); });
    this.child.stdin.on('error', () => this.stop('WORKER_STDIN_ERROR: ' + stderr));
    this.child.once('error', err => this.stop('PYTHON_UNAVAILABLE: ' + (err instanceof Error ? err.message : String(err))));
    this.child.once('exit', (code, signal) => this.stop(`WORKER_EXITED: code=${code} signal=${signal} stderr=${stderr}`));
    try { return await this.request('init', { config }) as Reading; }
    catch (error) { this.stop(); throw error; }
  }

  read(): Promise<Reading> { return this.serial(() => this.request('read') as Promise<Reading>); }
  write(control: ControlKey, value: boolean): Promise<void> {
    return this.serial(async () => { await this.request('write', { control, value }); });
  }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {}); return next;
  }
  private request(op: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    const child = this.child;
    if (!child) return Promise.reject(new TelemetryError('WORKER_EXITED'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => this.stop('TIMEOUT'), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, op, ...extra }) + '\n');
    });
  }
  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    if (this.buffer.length > 262144) return this.stop('INVALID_RESPONSE');
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        const entry = this.pending.get(message.id);
        if (!entry) continue;
        clearTimeout(entry.timer); this.pending.delete(message.id);
        if (message.ok === true) entry.resolve(message.data);
        else entry.reject(new TelemetryError(typeof message.code === 'string' ? message.code : 'DEVICE_ERROR'));
      } catch { return this.stop('INVALID_RESPONSE'); }
    }
  }
  stop(code = 'STOPPED'): void {
    const child = this.child; this.child = undefined;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new TelemetryError(code)); }
    this.pending.clear(); this.buffer = '';
    child?.stdin.destroy(); child?.kill();
  }
}

import { TelemetryClient } from './telemetry.ts';
import { CameraSensors } from './sensors.ts';
import type { Reading } from './telemetry.ts';
import type { CameraDevice } from '@camera.ui/sdk';
import type { Profile } from './profiles.ts';

export interface TelemetrySettings { python: string; interval: number; exposeControls: boolean }
type TelemetryPort = Pick<TelemetryClient, 'start' | 'read' | 'write' | 'stop'>;
export class CameraTelemetry {
  private readonly client: TelemetryPort;
  readonly sensors: CameraSensors;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private freshness?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private active?: Promise<void>;
  public status = 'iniciando';
  public lastReading?: Reading;

  private readonly profile: Profile;
  private readonly settings: TelemetrySettings;
  constructor(camera: CameraDevice, profile: Profile, settings: TelemetrySettings, transport?: TelemetryPort) {
    this.profile = profile; this.settings = settings;
    this.client = transport ?? new TelemetryClient(settings.python);
    this.sensors = new CameraSensors(camera, profile.id, async (key, value) => {
      if (this.stopped || !settings.exposeControls || this.status !== 'conectada') throw new Error('Control Tapo no disponible.');
      try { await this.client.write(key, value); }
      catch { this.sensors.unavailable(); this.status = 'consulta fallida'; throw new Error('La cámara no confirmó el cambio. Actualiza sus estados antes de reintentar.'); }
    });
  }
  start(): Promise<void> { this.active = this.initialize(); return this.active; }
  private async initialize(): Promise<void> {
    const secret = this.profile.controlSecret || (this.profile.auth === 'password' ? this.profile.secret : '');
    if (!secret) { this.status = 'requiere contraseña Tapo para telemetría; el hash solo cubre vídeo'; return; }
    try {
      const reading = await this.client.start({ host: this.profile.host, port: this.profile.port,
        controlPort: this.profile.controlPort ?? 443, secret });
      if (this.stopped) return;
      await this.accept(reading);
      this.schedule();
    } catch {
      // Do not retry authentication repeatedly: user explicitly saves/restarts to try again.
      this.status = 'no disponible: revisa Python, pytapo 3.4.30 y credenciales; guarda para reintentar';
      this.sensors.unavailable(); this.client.stop();
    }
  }
  private async accept(reading: Reading): Promise<void> {
    if (this.stopped) return;
    await this.sensors.apply(reading, this.settings.exposeControls);
    if (this.stopped) return;
    this.lastReading = reading; this.status = 'conectada'; this.failures = 0;
    if (this.freshness) clearTimeout(this.freshness);
    this.freshness = setTimeout(() => {
      this.sensors.unavailable(); this.status = 'lectura caducada';
    }, Math.max(45000, this.settings.interval * 3000));
    this.freshness.unref();
  }
  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.active = this.poll();
      void this.active.catch(() => { this.sensors.unavailable(); this.status = 'error de telemetría'; });
    }, this.settings.interval * 1000);
    this.timer.unref();
  }
  private async poll(): Promise<void> {
    try {
      await this.accept(await this.client.read());
    } catch {
      if (this.stopped) return;
      this.sensors.unavailable(); this.failures++;
      this.status = 'consulta fallida';
      if (this.failures >= 3) {
        this.status = 'telemetría detenida tras 3 fallos; guarda el perfil para reintentar';
        this.client.stop(); return;
      }
    }
    this.schedule();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer); clearTimeout(this.freshness);
    this.client.stop();
    await this.active?.catch(() => {});
    await this.sensors.stop();
  }
}

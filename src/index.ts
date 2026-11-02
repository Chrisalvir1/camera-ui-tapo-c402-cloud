import { API_EVENT, BasePlugin } from '@camera.ui/sdk';
import type { CameraConfig, CameraDevice, DeviceStorage, DiscoveredCamera, DiscoveryProvider, FormSubmitResponse, JsonSchema, LoggerService, PluginAPI } from '@camera.ui/sdk';
import { publicProfile, sourceUrl, validateProfile } from './profiles.ts';
import type { Profile } from './profiles.ts';
import { probeService } from './probe.ts';
import { CameraTelemetry } from './telemetry-session.ts';
import { C402 } from './model.ts';

interface Settings extends Record<string, unknown> { profiles?: Profile[] }

export default class TapoC402Cloud extends BasePlugin<Settings> implements DiscoveryProvider {
  private cameras = new Map<string, CameraDevice>();
  private stopping = false;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private generations = new Map<string, number>();
  private telemetry = new Map<string, CameraTelemetry>();
  private telemetryReconfigure: Promise<void> = Promise.resolve();

  constructor(logger: LoggerService, api: PluginAPI, storage: DeviceStorage<Settings>) {
    super(logger, api, storage);
    this.api.on(API_EVENT.SHUTDOWN, () => {
      this.stopping = true;
      void Promise.allSettled([...this.telemetry.values()].map(session => session.stop()));
      this.telemetry.clear();
      for (const timer of this.timers.values()) clearTimeout(timer);
      this.timers.clear(); this.cameras.clear(); this.generations.clear();
    });
  }

  private get profiles(): Profile[] { return this.storage.values.profiles ?? []; }

  public get storageSchema(): JsonSchema[] {
    const profileItem = { type: 'object' as const, title: 'Perfil', description: 'Dispositivo Tapo.', properties: [
      { type: 'string', key: 'id', title: 'ID', description: 'Identidad estable.' },
      { type: 'string', key: 'name', title: 'Nombre', description: 'Nombre visible.' },
      { type: 'string', key: 'host', title: 'Host', description: 'Dirección del dispositivo.' },
      { type: 'number', key: 'port', title: 'Puerto', description: 'Puerto Tapo.' },
      { type: 'string', key: 'auth', title: 'Modo', description: 'Modo de autenticación.' },
      { type: 'string', key: 'secret', title: 'Credencial', description: 'Secreto del dispositivo.', format: 'password' },
      { type: 'string', key: 'controlSecret', title: 'Contraseña de control', description: 'Opcional si vídeo usa contraseña.', format: 'password' },
      { type: 'number', key: 'controlPort', title: 'Puerto de control', description: 'API HTTPS Tapo.' },
    ] };
    return [
      { type: 'array', key: 'profiles', title: 'Perfiles internos', description: 'Configuración privada de dispositivos.', hidden: true, store: true,
        items: profileItem },
      { type: 'string', key: 'profileId', title: 'ID para editar o eliminar',
        description: 'Vacío para añadir una cámara. El ID aparece al guardar y en el inventario.' },
      { type: 'string', key: 'name', title: 'Nombre de la cámara', description: 'Nombre visible en Camera UI.' },
      { type: 'string', key: 'host', title: 'IP o nombre de host de la cámara',
        description: 'Accesible desde el servidor o worker que ejecuta este plugin.' },
      { type: 'number', key: 'port', title: 'Puerto Tapo', description: 'Puerto del protocolo propietario.', defaultValue: 8800, minimum: 1, maximum: 65535 },
      { type: 'string', key: 'secret', title: 'Contraseña Tapo (la que usas con tu correo)', format: 'password',
        description: 'Escribe solo la contraseña de tu TP-Link ID; no el correo ni la Camera Account. Se usa para abrir el stream local tapo://, no es RTSP/ONVIF. Al editar, vacío conserva la guardada.' },
      { type: 'string', key: 'controlSecret', title: 'Contraseña Tapo para sensores (opcional)', format: 'password',
        description: 'Déjalo vacío si usas la contraseña Tapo de arriba. Si el transporte de vídeo usa un hash, escribe aquí la contraseña original. Al editar, vacío conserva la guardada.' },
      { type: 'number', key: 'controlPort', title: 'Puerto de control', description: 'API de sensores y controles.', defaultValue: 443, minimum: 1, maximum: 65535 },
      { type: 'submit', key: 'saveCamera', title: 'Guardar perfil', description: 'Añade o edita un dispositivo.', onClick: this.saveProfile.bind(this) },
      { type: 'submit', key: 'testService', title: 'Comprobar acceso al servicio', onClick: this.testService.bind(this),
        description: 'Comprueba acceso de red, no valida contraseña ni recepción de vídeo.' },
      { type: 'submit', key: 'inventory', title: 'Ver cámaras configuradas', description: 'Muestra nombres e IDs, sin credenciales.', onClick: async () => ({
        toast: { type: 'info', message: this.profiles.map(p => `${p.name}: ${p.id}`).join(' · ') || 'Sin cámaras configuradas.' },
      }) },
      { type: 'boolean', key: 'telemetryEnabled', title: 'Batería y sensores Tapo', description: 'Requiere un entorno Python con pytapo 3.4.30. No afecta al stream de vídeo.', defaultValue: true, store: true,
        onSet: async () => this.restartTelemetry() },
      { type: 'string', key: 'pythonPath', title: 'Ejecutable Python de telemetría', description: 'Ruta del Python con pytapo instalado, preferiblemente en un entorno virtual.',
        defaultValue: process.platform === 'win32' ? 'python' : 'python3', store: true, onSet: async () => this.restartTelemetry() },
      { type: 'number', key: 'pollSeconds', title: 'Actualizar estados cada (segundos)', description: 'Sondeo, no eventos instantáneos. Menos tiempo genera más consultas.',
        defaultValue: 15, minimum: 5, maximum: 300, store: true, onSet: async () => this.restartTelemetry() },
      { type: 'boolean', key: 'exposeControls', title: 'Publicar controles de la cámara', description: 'Privacidad, LED, detección y luz cuando la cámara responda. Las órdenes solo se envían al accionar un control.',
        defaultValue: true, store: true, onSet: async () => this.restartTelemetry() },
      { type: 'submit', key: 'telemetryStatus', title: 'Ver estado de sensores', description: 'Muestra estado y última lectura sin credenciales.', onClick: async () => ({
        toast: { type: 'info', message: [...this.telemetry.entries()].map(([cameraId, session]) => `${this.cameras.get(cameraId)?.name ?? 'C402'}: ${session.status}${session.sensors.observedAt ? ` · ${new Date(session.sensors.observedAt).toISOString()}` : ''}${session.lastReading ? ` · ${JSON.stringify(session.lastReading.battery)} · ${JSON.stringify(session.lastReading.diagnostic)}` : ''}`).join(' | ') || 'Sin telemetría activa.' },
      }) },
      { type: 'boolean', key: 'confirmRemove', title: 'Confirmo eliminar el perfil indicado', description: 'Requiere desasignar la cámara primero.', defaultValue: false },
      { type: 'submit', key: 'removeCamera', title: 'Eliminar perfil', description: 'Elimina también su credencial del almacenamiento activo.', onClick: this.removeProfile.bind(this) },
    ];
  }

  private async saveProfile(values: Record<string, unknown>): Promise<FormSubmitResponse> {
    try {
      const id = typeof values.profileId === 'string' ? values.profileId.trim() : '';
      const previous = id ? this.profiles.find(p => p.id === id) : undefined;
      if (id && !previous) throw new Error('No existe ese perfil.');
      const profile = validateProfile({ ...previous, ...values, secret: values.secret || previous?.secret,
        controlSecret: values.controlSecret || previous?.controlSecret }, previous?.id);
      if (this.profiles.some(p => p.id !== profile.id && p.host.toLowerCase() === profile.host.toLowerCase() && p.port === profile.port)) {
        throw new Error('Ese dispositivo ya tiene un perfil. Edita el existente.');
      }
      await this.storage.setValue('profiles', [...this.profiles.filter(p => p.id !== profile.id), profile]);
      // Refresh dynamic handlers, keeping camera identity and host-owned sessions.
      for (const camera of this.cameras.values()) if (camera.nativeId === profile.id) await this.onCameraAdded(camera);
      return { toast: { type: 'success', message: `Perfil guardado. ID: ${profile.id}. Busca la cámara en Descubiertas para adoptarla.` } };
    } catch (error) { return this.failure(error); }
  }

  private async removeProfile(values: Record<string, unknown>): Promise<FormSubmitResponse> {
    if (values.confirmRemove !== true) return this.failure(new Error('Confirma la eliminación del perfil.'));
    const id = typeof values.profileId === 'string' ? values.profileId.trim() : '';
    if (!this.profiles.some(p => p.id === id)) return this.failure(new Error('No existe ese perfil.'));
    for (const camera of this.cameras.values()) {
      if (camera.nativeId === id) return this.failure(new Error('Desasigna primero esta cámara del plugin en Camera UI.'));
    }
    await this.storage.setValue('profiles', this.profiles.filter(p => p.id !== id));
    return { toast: { type: 'success', message: 'Perfil y credencial eliminados.' } };
  }

  private async testService(values: Record<string, unknown>): Promise<FormSubmitResponse> {
    try {
      const profile = this.profiles.find(p => p.id === values.profileId);
      const candidate = validateProfile({ ...profile, ...values, secret: values.secret || profile?.secret });
      await probeService(candidate);
      return { toast: { type: 'success', message: 'Servicio Tapo accesible. La autenticación y el vídeo se comprueban al abrir la fuente.' } };
    } catch (error) { return this.failure(error); }
  }

  private failure(error: unknown): FormSubmitResponse {
    // Never echo upstream errors that may embed credentials or URLs.
    return { toast: { type: 'error', message: error instanceof Error && !/tapo:\/\//i.test(error.message)
      ? error.message : 'La operación no pudo completarse.' } };
  }

  public async onDiscoverCameras(): Promise<DiscoveredCamera[]> {
    return this.profiles.map(p => ({ id: p.id, name: p.name, manufacturer: C402.manufacturer, model: C402.model }));
  }
  public async onGetCameraSettings(): Promise<[]> { return []; }
  public async onAdoptCamera(discovered: DiscoveredCamera): Promise<CameraConfig> {
    const profile = this.profiles.find(p => p.id === discovered.id);
    if (!profile) throw new Error('El perfil ya no existe.');
    return {
      name: profile.name, nativeId: profile.id, isCloud: false,
      // mains selects continuous host policy; battery telemetry remains independent.
      info: { manufacturer: C402.manufacturer, model: C402.model, power: 'mains' },
      sources: [{ name: C402.sourceName, role: 'high-resolution', urls: ['cui://127.0.0.1'],
        hotMode: true, preload: true, useForSnapshot: true, muted: false,
        backchannelDisabled: true, handshakeTimeout: 15, timeout: 15 }],
    };
  }

  private async attach(camera: CameraDevice): Promise<void> {
    if (this.stopping) return;
    if (!this.profiles.some(p => p.id === camera.nativeId)) throw new Error('Configura el perfil de esta cámara en Tapo C402 Cloud.');
    await camera.implement({ streamUrl: async sourceId => {
      if (this.stopping || !this.cameras.has(camera.id)) throw new Error('Cámara desasignada.');
      if (!camera.sources.some(s => s._id === sourceId)) throw new Error('Fuente de cámara desconocida.');
      const profile = this.profiles.find(p => p.id === camera.nativeId);
      if (!profile) throw new Error('El perfil ya no existe.');
      // The C402's only verified go2rtc selector is subtype=0 (HD). Do not
      // expose undocumented values: they produced EOF/no video on the test unit.
      return sourceUrl(profile);
    } });
  }
  public async configureCameras(cameras: CameraDevice[]): Promise<void> {
    for (const camera of cameras) {
      try { await this.onCameraAdded(camera); }
      catch { this.logger.warn('Una cámara Tapo no tiene un perfil válido; revisa su configuración.'); }
    }
  }
  public async onCameraAdded(camera: CameraDevice): Promise<void> {
    await this.onCameraReleased(camera.id);
    this.cameras.set(camera.id, camera);
    try { await this.attach(camera); }
    catch (error) { this.cameras.delete(camera.id); throw error; }
    const generation = (this.generations.get(camera.id) ?? 0) + 1;
    this.generations.set(camera.id, generation);
    this.startTelemetry(camera);
    // Probe the host's multiplexed source, never open a competing Tapo session here.
    void this.monitor(camera, generation, 0);
  }
  private async monitor(camera: CameraDevice, generation: number, failures: number): Promise<void> {
    const active = () => !this.stopping && this.cameras.get(camera.id) === camera && this.generations.get(camera.id) === generation;
    if (!active()) return;
    try {
      const probe = await camera.streamSource.probeStream({ video: true, audio: true }, true);
      if (!active()) return;
      if (!probe?.video.length) throw new Error('Sin pista de vídeo.');
      await camera.connect();
      failures = 0;
    } catch {
      if (!active()) return;
      failures++;
      try { await camera.disconnect(); } catch { /* host shutting down */ }
      if (failures === 1) this.logger.warn('Una fuente Tapo no está disponible. Se reintentará sin mostrar credenciales.');
    }
    if (!active()) return;
    const timer = setTimeout(() => { void this.monitor(camera, generation, failures); },
      failures ? Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4)) : 30000);
    timer.unref(); this.timers.set(camera.id, timer);
  }
  public async onCameraReleased(cameraId: string): Promise<void> {
    const timer = this.timers.get(cameraId); if (timer) clearTimeout(timer);
    this.timers.delete(cameraId); this.cameras.delete(cameraId);
    this.generations.set(cameraId, (this.generations.get(cameraId) ?? 0) + 1);
    const session = this.telemetry.get(cameraId); this.telemetry.delete(cameraId);
    await session?.stop();
  }
  private startTelemetry(camera: CameraDevice): void {
    if (this.stopping || this.storage.values.telemetryEnabled === false) return;
    const profile = this.profiles.find(p => p.id === camera.nativeId);
    if (!profile) return;
    const configured = this.storage.values.pythonPath;
    const poll = Number(this.storage.values.pollSeconds ?? 15);
    const session = new CameraTelemetry(camera, profile, {
      python: typeof configured === 'string' && configured ? configured : process.platform === 'win32' ? 'python' : 'python3',
      interval: Number.isFinite(poll) ? Math.max(5, Math.min(300, poll)) : 15,
      exposeControls: this.storage.values.exposeControls !== false,
    });
    this.telemetry.set(camera.id, session);
    void session.start().catch(() => { this.logger.warn('No se pudo iniciar la telemetría Tapo. Revisa las dependencias en los ajustes.'); });
  }
  private restartTelemetry(): Promise<void> {
    this.telemetryReconfigure = this.telemetryReconfigure.then(async () => {
      await Promise.allSettled([...this.telemetry.values()].map(session => session.stop())); this.telemetry.clear();
      for (const camera of this.cameras.values()) this.startTelemetry(camera);
    });
    return this.telemetryReconfigure;
  }
}

// Public metadata only. Credential values never appear in diagnostics.
export { publicProfile };

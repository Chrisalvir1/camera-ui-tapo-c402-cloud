import { API_EVENT, BasePlugin, PluginInterface, PluginRole } from '@camera.ui/sdk';
import type {
  CameraConfig,
  CameraDevice,
  DiscoveredCamera,
  DeviceStorage,
  JsonSchema,
  JsonSchemaWithoutCallbacks,
  LoggerService,
  PluginAPI,
} from '@camera.ui/sdk';
import { createConnection, Socket } from 'node:net';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { cameraNativeId, parseProfiles, type CameraProfile } from './profile.js';
import { C402 } from './model.js';
import { startMediaBridge, type BridgeHandle } from './media-bridge.js';
import { CameraTelemetry } from './telemetry-session.js';

interface PluginSettings extends Record<string, unknown> {
  name?: string;
  host?: string;
  port?: number;
  password?: string;
  python?: string;
  interval?: number;
  exposeSwitches?: boolean;
}

function tcpReachable(host: string, port: number, timeout = 1_500): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    const done = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

/**
 * Escaneo rápido en paralelo de las subredes locales IPv4 en el puerto 8800 (protocolo Tapo).
 * Permite descubrir automáticamente la cámara en cualquier router o red doméstica en <500ms.
 */
async function scanLocalSubnetForTapo(port = 8800, probeTimeout = 400): Promise<string[]> {
  const ifaces = networkInterfaces();
  const subnets = new Set<string>();

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      const isIpv4 = iface.family === 'IPv4' || (iface.family as unknown) === 4;
      if (isIpv4 && !iface.internal && typeof iface.address === 'string') {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }

  const found = new Set<string>();
  const probes: Promise<void>[] = [];

  for (const subnet of subnets) {
    for (let i = 1; i < 255; i++) {
      const ip = `${subnet}.${i}`;
      probes.push(
        tcpReachable(ip, port, probeTimeout).then(reachable => {
          if (reachable) found.add(ip);
        }).catch(() => {})
      );
    }
  }

  await Promise.all(probes);
  return Array.from(found);
}

function resolvePythonPath(customPath?: string): string {
  if (customPath && customPath.trim() && existsSync(customPath.trim())) {
    return customPath.trim();
  }
  // 1. Entorno virtual local en el espacio de trabajo si existe
  const localVenv = join(process.cwd(), '.venv-camera-ui-tapo', 'bin', 'python3');
  if (existsSync(localVenv)) return localVenv;

  const fallbackVenv = join(process.cwd(), '.venv', 'bin', 'python3');
  if (existsSync(fallbackVenv)) return fallbackVenv;

  // 2. Entorno embebido de Camera.UI en macOS si existe
  const home = process.env.HOME ?? '';
  const embedded15 = join(home, 'Library/Application Support/camera.ui/camera.ui/python-electron/python-headless-3.11.15-darwin-universal2/bin/python3');
  if (existsSync(embedded15)) return embedded15;
  const embedded14 = join(home, 'Library/Application Support/camera.ui/camera.ui/python-electron/python-headless-3.11.14-darwin-universal2/bin/python3');
  if (existsSync(embedded14)) return embedded14;

  // 3. Python 3 del sistema en Linux, macOS o Windows
  return process.platform === 'win32' ? 'python' : 'python3';
}

function ensurePytapoInstalled(python: string, logger?: LoggerService): void {
  try {
    const check = spawnSync(python, ['-c', 'import pytapo'], { timeout: 4000 });
    if (check.status !== 0) {
      logger?.log(`Instalando dependencia necesaria pytapo==3.4.30 en ${python}...`);
      const install = spawnSync(python, ['-m', 'pip', 'install', 'pytapo==3.4.30'], { timeout: 45000 });
      if (install.status === 0) {
        logger?.log('Dependencia pytapo instalada correctamente.');
      } else {
        logger?.warn(`Aviso de instalación pytapo (código ${install.status}). Si la telemetría falla, ejecuta: ${python} -m pip install pytapo==3.4.30`);
      }
    }
  } catch (err) {
    logger?.warn(`Verificación automática de pytapo omitida: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default class TapoC402Cloud extends BasePlugin<PluginSettings> {
  private readonly cameras = new Map<string, CameraDevice>();
  private readonly bridges = new Map<string, BridgeHandle>();
  private readonly telemetries = new Map<string, CameraTelemetry>();
  private stopping = false;

  constructor(logger: LoggerService, api: PluginAPI, storage: DeviceStorage<PluginSettings>) {
    super(logger, api, storage);
    this.api.on(API_EVENT.SHUTDOWN, () => this.shutdown());
    this.api.on(API_EVENT.FINISH_LAUNCHING, async () => {
      const config = await this.storage.getConfig();
      this.logger.log(`Formulario Tapo: ${config.schema.length} campos registrados.`);
      const devices = await this.onDiscoverCameras();
      await this.api.deviceManager.pushDiscoveredCameras(devices);
      this.logger.log(`Alta Tapo: ${devices.length} entradas publicadas.`);
    });
  }

  override get storageSchema(): JsonSchema[] {
    return [
      { type: 'string', key: 'name', title: 'Nombre de la cámara', description: 'Nombre visible en Camera UI.', defaultValue: 'Tapo C402', store: true },
      { type: 'string', key: 'host', title: 'IP de la cámara', description: 'Dirección IP local de la C402 en tu red.', defaultValue: '192.168.110.24', store: true },
      { type: 'number', key: 'port', title: 'Puerto Tapo', description: 'Puerto del protocolo Tapo (por defecto 8800).', defaultValue: 8800, minimum: 1, maximum: 65535, store: true },
      { type: 'string', key: 'password', title: 'Contraseña de tu cuenta Tapo', description: 'La contraseña que usas junto con tu correo en la app Tapo.', format: 'password', store: true },
      { type: 'string', key: 'python', title: 'Ejecutable Python de sensores', description: 'Ruta o comando de Python 3 con pytapo.', defaultValue: 'python3', store: true },
      { type: 'number', key: 'interval', title: 'Intervalo de sondeo (segundos)', description: 'Frecuencia de lectura de batería y controles.', defaultValue: 15, minimum: 5, maximum: 300, store: true },
      { type: 'boolean', key: 'exposeSwitches', title: 'Exponer interruptores adicionales', description: 'Publica interruptores de detección, LED y micrófono en Camera UI. Déjalo desactivado para tener la vista limpia en HomeKit (solo batería y foco en el contenedor de la cámara).', defaultValue: false, store: true },
    ];
  }

  private profiles(): CameraProfile[] {
    const values = this.storage.values;
    if (!values.password || !values.host) return [];
    return parseProfiles([{ name: values.name ?? 'Tapo C402', host: values.host, port: values.port ?? 8800, password: values.password }]);
  }

  async onDiscoverCameras(): Promise<DiscoveredCamera[]> {
    const profiles = this.profiles();
    const discovered: DiscoveredCamera[] = [];
    const registeredIps = new Set<string>();

    // 1. Cámaras configuradas en el perfil guardado
    if (profiles.length) {
      const verified = await Promise.all(profiles.map(async profile => ({
        profile,
        reachable: await tcpReachable(profile.host, profile.port),
      })));
      for (const { profile, reachable } of verified) {
        if (reachable) {
          registeredIps.add(profile.host);
          discovered.push({
            id: cameraNativeId(profile),
            name: profile.name,
            manufacturer: C402.manufacturer,
            model: C402.model,
            address: `${profile.host}:${profile.port}`,
          });
        }
      }
    }

    // 2. Autodescubrimiento en la red local (escaneo rápido en puerto 8800)
    try {
      const lanIps = await scanLocalSubnetForTapo(8800, 450);
      for (const ip of lanIps) {
        if (!registeredIps.has(ip)) {
          discovered.push({
            id: `tapo-c402:discovered-${ip}`,
            name: `Tapo C402 (${ip})`,
            manufacturer: C402.manufacturer,
            model: C402.model,
            address: `${ip}:8800`,
          });
        }
      }
    } catch (err) {
      this.logger.debug?.(`Error en escaneo de subred: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. Opción de alta manual siempre disponible
    discovered.push({
      id: 'tapo-c402:manual',
      name: 'Añadir Tapo C402 manualmente por IP',
      manufacturer: C402.manufacturer,
      model: C402.model,
    });

    return discovered;
  }

  async onGetCameraSettings(camera: DiscoveredCamera): Promise<JsonSchemaWithoutCallbacks[]> {
    let prefilledHost = '';
    if (camera.id.startsWith('tapo-c402:discovered-')) {
      prefilledHost = camera.id.replace('tapo-c402:discovered-', '');
    }

    return this.storageSchema
      .filter(field => field.type !== 'button' && field.type !== 'submit')
      .map(field => {
        const { store, onGet, onSet, ...schema } = field as JsonSchema & { store?: boolean; onGet?: unknown; onSet?: unknown };
        if (prefilledHost && schema.key === 'host') {
          return { ...schema, defaultValue: prefilledHost };
        }
        return schema;
      }) as JsonSchemaWithoutCallbacks[];
  }

  async onAdoptCamera(discovered: DiscoveredCamera, settings: Record<string, unknown>): Promise<CameraConfig> {
    const isManual = discovered.id === 'tapo-c402:manual';
    const isDiscovered = discovered.id.startsWith('tapo-c402:discovered-');

    if (isManual || isDiscovered) {
      const candidateHost = (typeof settings.host === 'string' && settings.host.trim())
        ? settings.host.trim()
        : (isDiscovered ? discovered.id.replace('tapo-c402:discovered-', '') : '');

      const candidate = parseProfiles([{
        name: typeof settings.name === 'string' ? settings.name : 'Tapo C402',
        host: candidateHost,
        port: typeof settings.port === 'number' ? settings.port : 8800,
        password: typeof settings.password === 'string' ? settings.password : undefined,
      }])[0];

      if (!candidate || !candidate.password) {
        throw new Error('Se requiere la contraseña de tu cuenta Tapo para adoptar la cámara.');
      }
      if (!await tcpReachable(candidate.host, candidate.port)) {
        throw new Error(`No se alcanza la cámara en ${candidate.host}:${candidate.port}. Revisa la IP y que esté conectada en la misma red.`);
      }

      await this.storage.setConfig({
        name: candidate.name,
        host: candidate.host,
        port: candidate.port,
        password: candidate.password,
        python: typeof settings.python === 'string' ? settings.python : 'python3',
        interval: typeof settings.interval === 'number' ? settings.interval : 15,
        exposeSwitches: settings.exposeSwitches === true,
      });
      discovered = { ...discovered, id: cameraNativeId(candidate) };
    }

    const profile = this.profiles().find(candidate => cameraNativeId(candidate) === discovered.id);
    if (!profile) throw new Error('No se encuentra el perfil guardado de esta cámara.');
    if (!await tcpReachable(profile.host, profile.port)) throw new Error('No se alcanza la cámara en el puerto Tapo. Revisa la IP y que esté en la misma red.');

    return {
      name: profile.name,
      nativeId: cameraNativeId(profile),
      isCloud: false,
      info: { manufacturer: C402.manufacturer, model: C402.model, power: 'mains' },
      sources: [{
        name: 'Video y audio originales · Tapo directo',
        role: 'high-resolution',
        urls: ['cui://127.0.0.1'],
        hotMode: true,
        preload: true,
        useForSnapshot: true,
        muted: false,
        backchannelDisabled: true,
        timeout: 60,
        handshakeTimeout: 20,
      }],
    };
  }

  async configureCameras(cameras: CameraDevice[]): Promise<void> {
    for (const camera of cameras) await this.onCameraAdded(camera);
  }

  async onCameraAdded(camera: CameraDevice): Promise<void> {
    await this.onCameraReleased(camera.id);
    const profile = this.profiles().find(candidate => cameraNativeId(candidate) === camera.nativeId);
    if (!profile) {
      this.logger.warn(`No hay perfil guardado para la cámara ${camera.name}.`);
      return;
    }
    this.cameras.set(camera.id, camera);
    await camera.implement({
      streamUrl: async sourceId => {
        if (this.stopping || this.cameras.get(camera.id) !== camera) throw new Error('La cámara no está asignada al plugin.');
        if (!camera.sources.some(source => source._id === sourceId)) throw new Error('La fuente solicitada no pertenece a esta cámara.');
        let bridge = this.bridges.get(camera.id);
        if (!bridge || !bridge.isRunning()) {
          bridge = await startMediaBridge(profile);
          this.bridges.set(camera.id, bridge);
        }
        return bridge.streamUrl;
      },
    });

    const values = this.storage.values;
    const python = resolvePythonPath(typeof values.python === 'string' ? values.python : undefined);
    ensurePytapoInstalled(python, this.logger);

    const interval = typeof values.interval === 'number' && values.interval >= 5 ? values.interval : 15;
    const exposeControls = values.exposeSwitches === true;
    const telemetry = new CameraTelemetry(camera, profile, { python, interval, exposeControls });
    this.telemetries.set(camera.id, telemetry);
    void telemetry.start().then(() => {
      this.logger.log(`Sensores de ${camera.name} inicializados correctamente.`);
    }).catch(err => {
      this.logger.warn(`Telemetría de ${camera.name}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  async onCameraReleased(cameraId: string): Promise<void> {
    this.cameras.delete(cameraId);
    const bridge = this.bridges.get(cameraId);
    this.bridges.delete(cameraId);
    await bridge?.stop();

    const telemetry = this.telemetries.get(cameraId);
    this.telemetries.delete(cameraId);
    await telemetry?.stop();
  }

  private async shutdown(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    const ids = [...new Set([...this.bridges.keys(), ...this.telemetries.keys(), ...this.cameras.keys()])];
    await Promise.all(ids.map(id => this.onCameraReleased(id)));
  }
}


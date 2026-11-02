import { BatteryCapability, BatteryInfo, ChargingState, LightControl, ProblemSensor, SwitchControl } from '@camera.ui/sdk';
import type { CameraDevice } from '@camera.ui/sdk';
import type { ControlKey, Reading } from './telemetry.js';

const switchLabels: Record<Exclude<ControlKey, 'whiteLight'>, string> = {
  privacy: 'Privacidad',
  led: 'LED indicador',
  motionEnabled: 'Detección de movimiento habilitada',
  personEnabled: 'Detección de personas habilitada',
  petEnabled: 'Detección de mascotas habilitada',
  vehicleEnabled: 'Detección de vehículos habilitada',
  recordAudio: 'Micrófono de cámara',
};

type WriteControl = (key: ControlKey, value: boolean) => Promise<void>;

class TapoBattery extends BatteryInfo {
  constructor(nativeId: string) {
    super('Batería C402', { nativeId });
    this.capabilities = [BatteryCapability.Charging, BatteryCapability.LowBattery];
  }
}

class TapoSwitch extends SwitchControl {
  private readonly key: ControlKey;
  private readonly write: WriteControl;
  constructor(name: string, nativeId: string, key: ControlKey, write: WriteControl) {
    super(name, { nativeId });
    this.key = key;
    this.write = write;
  }
  override async setOn(): Promise<void> { await this.write(this.key, true); await super.setOn(); }
  override async setOff(): Promise<void> { await this.write(this.key, false); await super.setOff(); }
  async sync(value: boolean): Promise<void> { if (value) await super.setOn(); else await super.setOff(); }
}

class TapoLight extends LightControl {
  private readonly write: WriteControl;
  constructor(name: string, nativeId: string, write: WriteControl) {
    super(name, { nativeId });
    this.write = write;
  }
  override async setOn(): Promise<void> { await this.write('whiteLight', true); await super.setOn(); }
  override async setOff(): Promise<void> { await this.write('whiteLight', false); await super.setOff(); }
  async sync(value: boolean): Promise<void> { if (value) await super.setOn(); else await super.setOff(); }
}

/** Registers only properties backed by a complete successful device reading. */
export class CameraSensors {
  battery?: BatteryInfo;
  overheated?: ProblemSensor;
  light?: TapoLight;
  private readonly switches = new Map<string, TapoSwitch>();
  private closed = false;
  private lastReading?: number;
  private readonly camera: CameraDevice;
  private readonly profileId: string;
  private readonly write: WriteControl;

  constructor(camera: CameraDevice, profileId: string, write: WriteControl) {
    this.camera = camera;
    this.profileId = profileId;
    this.write = write;
  }

  async apply(reading: Reading, exposeControls = false): Promise<void> {
    if (this.closed) return;
    if (!Number.isFinite(reading.observedAt) || Date.now() - reading.observedAt > 120000 || reading.observedAt > Date.now() + 5000) {
      this.unavailable();
      return;
    }

    // 1. Batería (integrada directamente en la tarjeta de la cámara en HomeKit)
    const { level, charging, low } = reading.battery;
    if (typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 100
        && (charging === 'CHARGING' || charging === 'NOT_CHARGING') && typeof low === 'boolean') {
      if (!this.battery) {
        this.battery = new TapoBattery(`${this.profileId}:battery`);
        this.battery.setLevel(level);
        this.battery.setLow(low);
        this.battery.setCharging(charging === 'CHARGING' ? ChargingState.Charging : ChargingState.NotCharging);
        this.battery.setSourceState('connected');
        await this.camera.addSensor(this.battery);
      }
      if (this.closed) return;
      this.battery.setLevel(level);
      this.battery.setLow(low);
      this.battery.setCharging(charging === 'CHARGING' ? ChargingState.Charging : ChargingState.NotCharging);
      this.battery.setSourceState('connected');
    } else {
      this.battery?.setSourceState('unavailable');
    }

    // 2. Sobrecalentamiento
    if (typeof reading.battery.overheated === 'boolean') {
      if (!this.overheated) {
        this.overheated = new ProblemSensor('Sobrecalentamiento de batería', { nativeId: `${this.profileId}:overheated` });
        this.overheated.setDetected(reading.battery.overheated);
        this.overheated.setSourceState('connected');
        await this.camera.addSensor(this.overheated);
      }
      if (this.closed) return;
      this.overheated.setDetected(reading.battery.overheated);
      this.overheated.setSourceState('connected');
    } else {
      this.overheated?.setSourceState('unavailable');
    }

    // 3. Luz blanca / Reflector (integrada directamente en los controles de vídeo de la cámara en HomeKit)
    const whiteLightValue = reading.controls.whiteLight;
    if (typeof whiteLightValue === 'boolean') {
      if (!this.light) {
        this.light = new TapoLight('Luz blanca', `${this.profileId}:whiteLight`, this.write);
        await this.light.sync(whiteLightValue);
        this.light.setSourceState('connected');
        await this.camera.addSensor(this.light);
      }
      if (this.closed) return;
      await this.light.sync(whiteLightValue);
      this.light.setSourceState('connected');
    } else {
      this.light?.setSourceState('unavailable');
    }

    // 4. Interruptores de configuración (solo cuando exposeControls esté activo)
    const switchKeys = Object.keys(switchLabels) as (keyof typeof switchLabels)[];
    for (const key of switchKeys) {
      const value = reading.controls[key];
      if (!exposeControls || typeof value !== 'boolean') {
        const existing = this.switches.get(key);
        if (existing) {
          existing.setSourceState('unavailable');
          await this.camera.removeSensor(existing.id).catch(() => {});
          this.switches.delete(key);
        }
        continue;
      }
      let control = this.switches.get(key);
      if (!control) {
        control = new TapoSwitch(switchLabels[key], `${this.profileId}:${key}`, key, this.write);
        await control.sync(value);
        control.setSourceState('connected');
        await this.camera.addSensor(control);
        this.switches.set(key, control);
      }
      if (this.closed) return;
      await control.sync(value);
      control.setSourceState('connected');
    }
    this.lastReading = reading.observedAt;
  }

  get observedAt(): number | undefined { return this.lastReading; }

  unavailable(): void {
    this.battery?.setSourceState('unavailable');
    this.overheated?.setSourceState('unavailable');
    this.light?.setSourceState('unavailable');
    for (const control of this.switches.values()) control.setSourceState('unavailable');
  }

  async stop(): Promise<void> {
    this.closed = true;
    this.unavailable();
    const sensors = [
      ...this.switches.values(),
      ...(this.light ? [this.light] : []),
      ...(this.battery ? [this.battery] : []),
      ...(this.overheated ? [this.overheated] : []),
    ];
    await Promise.allSettled(sensors.map(sensor => this.camera.removeSensor(sensor.id)));
    this.switches.clear();
    this.light = undefined;
    this.battery = undefined;
    this.overheated = undefined;
  }
}

import { BatteryCapability, BatteryInfo, ChargingState, LightControl, ProblemSensor, SwitchControl } from '@camera.ui/sdk';
import type { CameraDevice } from '@camera.ui/sdk';
import type { ControlKey, Reading } from './telemetry.ts';

const labels: Record<ControlKey, string> = {
  privacy: 'Privacidad', led: 'LED indicador', motionEnabled: 'Detección de movimiento habilitada',
  personEnabled: 'Detección de personas habilitada', whiteLight: 'Luz blanca',
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
    super(name, { nativeId }); this.key = key; this.write = write;
  }
  async setOn(): Promise<void> { await this.write(this.key, true); await super.setOn(); }
  async setOff(): Promise<void> { await this.write(this.key, false); await super.setOff(); }
  async sync(value: boolean): Promise<void> { if (value) await super.setOn(); else await super.setOff(); }
}
class TapoLight extends LightControl {
  private readonly write: WriteControl;
  constructor(name: string, nativeId: string, write: WriteControl) { super(name, { nativeId }); this.write = write; }
  async setOn(): Promise<void> { await this.write('whiteLight', true); await super.setOn(); }
  async setOff(): Promise<void> { await this.write('whiteLight', false); await super.setOff(); }
  async sync(value: boolean): Promise<void> { if (value) await super.setOn(); else await super.setOff(); }
}

/** Registers only properties backed by a complete successful device reading. */
export class CameraSensors {
  battery?: BatteryInfo;
  overheated?: ProblemSensor;
  private controls = new Map<ControlKey, TapoSwitch | TapoLight>();
  private closed = false;
  private lastReading?: number;
  private readonly camera: CameraDevice;
  private readonly profileId: string;
  private readonly write: WriteControl;
  constructor(camera: CameraDevice, profileId: string, write: WriteControl) { this.camera = camera; this.profileId = profileId; this.write = write; }

  async apply(reading: Reading, exposeControls = true): Promise<void> {
    if (this.closed) return;
    if (!Number.isFinite(reading.observedAt) || Date.now() - reading.observedAt > 120000 || reading.observedAt > Date.now() + 5000) {
      this.unavailable(); return;
    }
    const { level, charging, low } = reading.battery;
    if (typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 100
        && (charging === 'CHARGING' || charging === 'NOT_CHARGING') && typeof low === 'boolean') {
      if (!this.battery) {
        this.battery = new TapoBattery(`${this.profileId}:battery`);
        this.battery.setLevel(level); this.battery.setLow(low);
        this.battery.setCharging(charging === 'CHARGING' ? ChargingState.Charging : ChargingState.NotCharging);
        this.battery.setSourceState('connected');
        await this.camera.addSensor(this.battery);
      }
      if (this.closed) return;
      this.battery.setLevel(level); this.battery.setLow(low);
      this.battery.setCharging(charging === 'CHARGING' ? ChargingState.Charging : ChargingState.NotCharging);
      this.battery.setSourceState('connected');
    } else this.battery?.setSourceState('unavailable');

    if (typeof reading.battery.overheated === 'boolean') {
      if (!this.overheated) {
        this.overheated = new ProblemSensor('Sobrecalentamiento de batería', { nativeId: `${this.profileId}:overheated` });
        this.overheated.setDetected(reading.battery.overheated);
        this.overheated.setSourceState('connected'); await this.camera.addSensor(this.overheated);
      }
      if (this.closed) return;
      this.overheated.setDetected(reading.battery.overheated); this.overheated.setSourceState('connected');
    } else this.overheated?.setSourceState('unavailable');

    for (const key of Object.keys(labels) as ControlKey[]) {
      const value = reading.controls[key];
      if (!exposeControls || typeof value !== 'boolean') { this.controls.get(key)?.setSourceState('unavailable'); continue; }
      let control = this.controls.get(key);
      if (!control) {
        control = key === 'whiteLight'
          ? new TapoLight(labels[key], `${this.profileId}:${key}`, this.write)
          : new TapoSwitch(labels[key], `${this.profileId}:${key}`, key, this.write);
        await control.sync(value); control.setSourceState('connected');
        if (key === 'whiteLight') await this.camera.addSensor(control as TapoLight);
        else await this.camera.addSensor(control as TapoSwitch);
        this.controls.set(key, control);
      }
      if (this.closed) return;
      await control.sync(value); control.setSourceState('connected');
    }
    this.lastReading = reading.observedAt;
  }
  get observedAt(): number | undefined { return this.lastReading; }
  unavailable(): void {
    this.battery?.setSourceState('unavailable');
    this.overheated?.setSourceState('unavailable');
    for (const control of this.controls.values()) control.setSourceState('unavailable');
  }
  async stop(): Promise<void> {
    this.closed = true; this.unavailable();
    const sensors = [...this.controls.values(), ...(this.battery ? [this.battery] : []), ...(this.overheated ? [this.overheated] : [])];
    await Promise.allSettled(sensors.map(sensor => this.camera.removeSensor(sensor.id)));
    this.controls.clear(); this.battery = undefined; this.overheated = undefined;
  }
}

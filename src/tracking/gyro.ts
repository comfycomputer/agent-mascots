import type { GyroState } from '../types.js';
import { createTiltFilter } from './tilt.js';

/**
 * The device has one orientation and the page has one permission, so this state
 * is shared by every mascot, with a single `deviceorientation` listener that
 * exists only while at least one of them is connected, visible and permitted.
 */

export interface GyroClient {
  /** Connected, visible and asking for gyro. */
  live: boolean;
  onState(state: GyroState): void;
  onTilt(): void;
}

interface PermissionApi {
  requestPermission?: () => Promise<string>;
}

export const tilt = createTiltFilter();
export const gyroClients = new Set<GyroClient>();

/**
 * Null until there is an answer. `granted` is provisional where no permission is
 * needed: a device with no sensor only shows itself once the listener hears it.
 */
let state: GyroState | null = null;
let asking: Promise<GyroState> | null = null;
let listening = false;

const permissionApi = (): PermissionApi | undefined =>
  typeof DeviceOrientationEvent === 'undefined'
    ? undefined
    : (DeviceOrientationEvent as unknown as PermissionApi);

export const gyroState = (): GyroState | null => state;

/** True when only a user gesture can settle the permission, which means iOS. */
export const gyroNeedsGesture = (): boolean => !state && !!permissionApi()?.requestPermission;

function screenAngle(): number {
  return screen.orientation?.angle ?? 0;
}

function onOrientation(event: Event): void {
  const { beta, gamma } = event as DeviceOrientationEvent;
  if (beta == null || gamma == null) {
    // Browsers without sensors fire one event of nulls, which the spec defines as
    // "can never provide orientation". After a real reading it is only a dropout.
    if (!tilt.ready) settle('unsupported');
    return;
  }
  if (!tilt.sample(beta, gamma, screenAngle(), performance.now())) return;
  for (const client of gyroClients) if (client.live) client.onTilt();
}

/** Match the listener to the clients. Call after changing any `live`. */
export function refreshGyro(): void {
  const want = state === 'granted' && [...gyroClients].some((client) => client.live);
  if (want === listening) return;
  listening = want;
  if (want) {
    // A new session may be held differently, so it gets a new resting angle.
    tilt.reset();
    window.addEventListener('deviceorientation', onOrientation);
  } else {
    window.removeEventListener('deviceorientation', onOrientation);
  }
}

function settle(next: GyroState): GyroState {
  state = next;
  refreshGyro();
  for (const client of gyroClients) client.onState(next);
  return next;
}

/** Runs up to `requestPermission` synchronously: iOS needs it inside the user gesture. */
async function ask(): Promise<GyroState> {
  const api = permissionApi();
  if (!api?.requestPermission) {
    // Answer after this tick, so a listener added straight after `append()` hears it.
    await Promise.resolve();
    return settle(api ? 'granted' : 'unsupported');
  }
  try {
    return settle((await api.requestPermission()) === 'granted' ? 'granted' : 'denied');
  } catch {
    // iOS rejects a request made outside a gesture. Nothing has been decided, so
    // this caller hears `denied` but the next tap may still ask.
    return 'denied';
  }
}

/** Idempotent: one request at a time, and an answer is never asked for again. */
export function requestGyro(): Promise<GyroState> {
  if (state) return Promise.resolve(state);
  return (asking ??= ask().finally(() => {
    asking = null;
  }));
}

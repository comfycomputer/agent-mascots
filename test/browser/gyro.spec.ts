import { expect, type Page, test } from '@playwright/test';
import { eyeOffset, probeListeners, type SensorMode, settled, stubSensors } from './sensors.js';

/*
 * Everything here runs against the stub in sensors.ts. No test touches a real
 * sensor or a real iOS permission prompt.
 */

const HARNESS = '/test/browser/harness.html';
const CENTRE = { x: 0, y: 0 };

async function load(page: Page, mode: SensorMode): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubSensors(page, mode);
  await probeListeners(page);
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  await page.addStyleTag({ content: 'body { margin: 0 } agent-mascot { position: fixed; left: 300px; top: 200px }' });
  await page.evaluate(() => {
    const log: { id: string; state: string }[] = [];
    Object.assign(window, { log });
    document.addEventListener('mascot-gyro', (event) => {
      log.push({ id: (event.target as Element).id, state: (event as CustomEvent).detail.state });
    });
  });
}

async function add(page: Page, attributes: Record<string, string> = {}, id = 'm'): Promise<void> {
  await page.evaluate(
    ([attrs, name]) => {
      const el = document.createElement('agent-mascot');
      el.id = name as string;
      el.setAttribute('size', '100');
      for (const [key, value] of Object.entries(attrs as Record<string, string>)) el.setAttribute(key, value);
      document.body.append(el);
    },
    [attributes, id] as const,
  );
  await settled(page);
}

/**
 * A pad left of the mascot to track. Chromium sends the page a pointermove at (0, 0)
 * just after load, which rightly counts as pointer input for `track="window"`; a pad
 * away from that corner means the only pointer input is what the test sends.
 */
async function addTrackedPad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pad = document.createElement('div');
    pad.id = 'pad';
    pad.style.cssText = 'position:fixed;left:0;top:100px;width:250px;height:400px';
    document.body.append(pad);
  });
  await add(page, { gyro: '', track: '#pad' });
}

const events = (page: Page) => page.evaluate(() => (window as unknown as { log: { id: string; state: string }[] }).log);
const eventStates = (page: Page) => events(page).then((log) => log.map(({ state }) => state));
const orientationListeners = (page: Page) => page.evaluate(() => window.listeners.count(window, 'deviceorientation'));
const requests = (page: Page) => page.evaluate(() => window.sensors.requests);
const enable = (page: Page, id = 'm') =>
  page.evaluate((name) => (document.getElementById(name) as HTMLElementTagNameMap['agent-mascot']).enableGyro(), id);

test.describe('without DeviceOrientationEvent', () => {
  test.beforeEach(({ page }) => load(page, 'absent'));

  test('reports unsupported and holds no listener', async ({ page }) => {
    await add(page, { gyro: '' });
    expect(await enable(page)).toBe('unsupported');
    expect(await eventStates(page)).toEqual(['unsupported']);
    expect(await orientationListeners(page)).toBe(0);
  });
});

test.describe('where no permission is needed', () => {
  test.beforeEach(({ page }) => load(page, 'plain'));

  test('starts immediately with the attribute', async ({ page }) => {
    await add(page, { gyro: '' });
    expect(await eventStates(page)).toEqual(['granted']);
    expect(await orientationListeners(page)).toBe(1);
  });

  test('a listener added straight after append hears the first event', async ({ page }) => {
    const states = await page.evaluate(async () => {
      const seen: string[] = [];
      const el = document.createElement('agent-mascot');
      el.setAttribute('gyro', '');
      document.body.append(el);
      el.addEventListener('mascot-gyro', (event) => seen.push(event.detail.state));
      await new Promise((resolve) => setTimeout(resolve, 20));
      return seen;
    });
    expect(states).toEqual(['granted']);
  });

  test('stays off without the attribute', async ({ page }) => {
    await add(page);
    expect(await eventStates(page)).toEqual([]);
    expect(await orientationListeners(page)).toBe(0);
  });

  test('a sensor-less device that fires nulls becomes unsupported', async ({ page }) => {
    await add(page, { gyro: '' });
    await page.evaluate(() => window.sensors.emit(null, null));
    expect(await eventStates(page)).toEqual(['granted', 'unsupported']);
    expect(await orientationListeners(page)).toBe(0);
    expect(await enable(page)).toBe('unsupported');
  });

  test('a dropout after real readings changes nothing', async ({ page }) => {
    await add(page, { gyro: '' });
    await page.evaluate(() => {
      window.sensors.settle(45, 0);
      window.sensors.emit(null, null);
    });
    expect(await eventStates(page)).toEqual(['granted']);
    expect(await orientationListeners(page)).toBe(1);
  });

  test('one listener serves every mascot and lives only while one is visible', async ({ page }) => {
    await page.addStyleTag({
      content: `
        body { height: 6000px }
        agent-mascot { position: absolute; left: 300px }
        #a { top: 0 }
        #b { top: 3000px }
      `,
    });
    await add(page, { gyro: '' }, 'a');
    await add(page, { gyro: '' }, 'b');
    const scrollTo = (y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
    expect(await orientationListeners(page)).toBe(1);

    await scrollTo(1500);
    await expect.poll(() => orientationListeners(page)).toBe(0);

    await scrollTo(3000);
    await expect.poll(() => orientationListeners(page)).toBe(1);

    await page.evaluate(() => document.getElementById('b')?.remove());
    await expect.poll(() => orientationListeners(page)).toBe(0);

    await scrollTo(0);
    await expect.poll(() => orientationListeners(page)).toBe(1);
  });

  test('removing the attribute stops it, setting it again resumes', async ({ page }) => {
    await add(page, { gyro: '' });
    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).gyro = false;
    });
    expect(await orientationListeners(page)).toBe(0);
    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).gyro = true;
    });
    expect(await orientationListeners(page)).toBe(1);
    expect(await eventStates(page)).toEqual(['granted']);
  });

  test('reconnecting restarts the listener', async ({ page }) => {
    await add(page, { gyro: '' });
    await page.evaluate(() => document.querySelector('#m')?.remove());
    expect(await orientationListeners(page)).toBe(0);
    await page.evaluate(() => {
      const el = document.createElement('agent-mascot');
      el.setAttribute('gyro', '');
      document.body.append(el);
    });
    await expect.poll(() => orientationListeners(page)).toBe(1);
  });

  test('takes the resting angle from the first readings', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => window.sensors.settle(63, -14));
    await page.evaluate(() => window.sensors.hold(63, -14));
    expect(await eyeOffset(page)).toEqual(CENTRE);
  });

  test('ignores readings until calibrated', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => window.sensors.emit(10, 40));
    expect(await eyeOffset(page)).toEqual(CENTRE);
  });

  test('moves the eyes towards the lowered edge, smoothly', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => window.sensors.settle(45, 0));
    const first = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      window.sensors.emit(45, 25);
      await new Promise((resolve) => setTimeout(resolve, 20));
      window.sensors.emit(45, 25);
    }).then(() => eyeOffset(page));
    await page.evaluate(() => window.sensors.hold(45, 25));
    const held = await eyeOffset(page);
    expect(held.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(held.x);
  });

  test('calibrates afresh when it comes back on screen', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, 25));
    expect((await eyeOffset(page)).x).toBeGreaterThan(0);

    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElement).style.top = '5000px';
    });
    await expect.poll(() => orientationListeners(page)).toBe(0);
    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElement).style.top = '200px';
    });
    await expect.poll(() => orientationListeners(page)).toBe(1);

    await page.evaluate(() => window.sensors.settle(45, 25));
    await page.evaluate(() => window.sensors.hold(45, 25));
    expect(await eyeOffset(page)).toEqual(CENTRE);
  });

  test('turns device axes into screen axes and recalibrates on rotation', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => {
      window.sensors.rotate(90);
      window.sensors.settle(20, 0);
    });
    // At 90 degrees the top of the device points left, so raising it lowers the right edge.
    await page.evaluate(() => window.sensors.hold(40, 0));
    const landscape = await eyeOffset(page);
    expect(landscape.x).toBeGreaterThan(0);
    expect(Math.abs(landscape.y)).toBeLessThan(landscape.x / 4);

    await page.evaluate(() => {
      window.sensors.rotate(270);
      window.sensors.settle(40, 0);
    });
    await page.evaluate(() => window.sensors.hold(40, 0));
    expect(await eyeOffset(page)).toEqual(CENTRE);
    await page.evaluate(() => window.sensors.hold(60, 0));
    expect((await eyeOffset(page)).x).toBeLessThan(0);
  });

  test('ranks lookAt, then the pointer, then gyro after two idle seconds', async ({ page }) => {
    await addTrackedPad(page);
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, 25));
    expect((await eyeOffset(page)).x).toBeGreaterThan(0);

    // The pointer takes over at once, even with the device tilted the other way.
    await page.mouse.move(10, 250);
    await page.mouse.move(5, 250);
    await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);

    // lookAt beats both.
    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).lookAt(350, 0);
    });
    const looking = await eyeOffset(page);
    expect(looking.y).toBeLessThan(0);
    await page.evaluate(() => {
      window.sensors.emit(45, 25);
      (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).lookAway();
    });

    // Still the pointer: it moved under two seconds ago.
    await page.mouse.move(4, 250);
    await page.evaluate(() => window.sensors.hold(45, 25, 1000));
    expect((await eyeOffset(page)).x).toBeLessThan(0);

    // Parked for two seconds, and gyro takes over.
    await page.evaluate(() => window.sensors.hold(45, 25, 1300));
    expect((await eyeOffset(page)).x).toBeGreaterThan(0);
  });

  test('after the pointer leaves, the wander has the eyes until the idle time is up', async ({ page }) => {
    await addTrackedPad(page);
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.mouse.move(10, 250);
    await page.mouse.move(5, 250);
    await page.mouse.move(700, 500);
    await page.evaluate(() => window.sensors.hold(45, 25, 400));
    expect(await eyeOffset(page)).toEqual(CENTRE);
  });

  test('hands a stopped loop over to gyro with no further sensor events', async ({ page }) => {
    await addTrackedPad(page);
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, 25));
    await page.mouse.move(10, 250);
    await page.mouse.move(5, 250);
    await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);
    await page.waitForTimeout(2200);
    expect((await eyeOffset(page)).x).toBeGreaterThan(0);
  });

  test('gyro with no pointer works on a mascot tracking nothing', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, -25));
    expect((await eyeOffset(page)).x).toBeLessThan(0);
  });

  test('springs towards the tilt when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await add(page, { gyro: '', track: 'none', glance: '0' });
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, 25, 800));
    await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
  });
});

test.describe('with iOS-style permission', () => {
  test.beforeEach(({ page }) => load(page, 'ios'));

  test('does nothing until the mascot is tapped, then asks once', async ({ page }) => {
    await add(page, { gyro: '' });
    expect(await requests(page)).toBe(0);
    expect(await orientationListeners(page)).toBe(0);
    expect(await eventStates(page)).toEqual([]);

    await page.click('#m');
    await expect.poll(() => eventStates(page)).toEqual(['granted']);
    expect(await requests(page)).toBe(1);
    expect(await orientationListeners(page)).toBe(1);

    await page.click('#m');
    await settled(page);
    expect(await requests(page)).toBe(1);
    expect(await page.evaluate(() => window.listeners.count(document.querySelector('#m') as Element, 'click'))).toBe(1);
    expect(await eventStates(page)).toEqual(['granted']);
  });

  test('the tap still pokes', async ({ page }) => {
    await add(page, { gyro: '' });
    await page.evaluate(() => {
      document.addEventListener('mascot-poke', () => Object.assign(window, { poked: true }));
    });
    await page.click('#m');
    expect(await page.evaluate(() => 'poked' in window)).toBe(true);
  });

  test('tilt reaches the eyes after the grant', async ({ page }) => {
    await add(page, { gyro: '', track: 'none' });
    await page.click('#m');
    await expect.poll(() => orientationListeners(page)).toBe(1);
    await page.evaluate(() => window.sensors.settle(45, 0));
    await page.evaluate(() => window.sensors.hold(45, 25));
    expect((await eyeOffset(page)).x).toBeGreaterThan(0);
  });

  test('a denial is final and is not asked again', async ({ page }) => {
    await page.evaluate(() => {
      window.sensors.answer = 'denied';
    });
    await add(page, { gyro: '' });
    await page.click('#m');
    await expect.poll(() => eventStates(page)).toEqual(['denied']);
    await page.click('#m');
    expect(await enable(page)).toBe('denied');
    expect(await requests(page)).toBe(1);
    expect(await orientationListeners(page)).toBe(0);
    expect(await eventStates(page)).toEqual(['denied']);
  });

  test('a request outside a gesture says denied but leaves the tap to ask', async ({ page }) => {
    await add(page, { gyro: '' });
    expect(await enable(page)).toBe('denied');
    expect(await eventStates(page)).toEqual(['denied']);

    await page.click('#m');
    await expect.poll(() => eventStates(page)).toEqual(['denied', 'granted']);
    expect(await requests(page)).toBe(2);
    expect(await orientationListeners(page)).toBe(1);
  });

  test('enableGyro works from a consumer click handler, with no attribute', async ({ page }) => {
    await add(page);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.textContent = 'motion';
      button.addEventListener('click', () => {
        void (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'])
          .enableGyro()
          .then((state) => Object.assign(window, { answer: state }));
      });
      document.body.append(button);
    });
    await page.click('button');
    await expect.poll(() => page.evaluate(() => (window as unknown as { answer?: string }).answer)).toBe('granted');
    expect(await page.evaluate(() => (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).gyro)).toBe(true);
    expect(await orientationListeners(page)).toBe(1);

    // Reflected, so the property turns it back off.
    await page.evaluate(() => {
      (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).gyro = false;
    });
    expect(await orientationListeners(page)).toBe(0);
  });

  test('enableGyro is idempotent', async ({ page }) => {
    await add(page);
    await page.evaluate(() => {
      const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
      const results: Promise<string>[] = [];
      el.addEventListener('click', () => {
        results.push(el.enableGyro(), el.enableGyro());
        void Promise.all(results).then((states) => Object.assign(window, { states }));
      });
    });
    await page.click('#m');
    await expect.poll(() => page.evaluate(() => (window as unknown as { states?: string[] }).states)).toEqual(['granted', 'granted']);
    expect(await enable(page)).toBe('granted');
    expect(await enable(page)).toBe('granted');
    expect(await requests(page)).toBe(1);
    expect(await eventStates(page)).toEqual(['granted']);
  });

  test('the answer reaches every mascot, and a tap on any of them asks', async ({ page }) => {
    await add(page, { gyro: '' }, 'a');
    await add(page, { gyro: '' }, 'b');
    await page.click('#b');
    await expect.poll(() => events(page).then((log) => log.length)).toBe(2);
    expect((await events(page)).map(({ id }) => id).toSorted()).toEqual(['a', 'b']);
    expect(await requests(page)).toBe(1);
    expect(await orientationListeners(page)).toBe(1);
    expect(await page.evaluate(() => window.listeners.count(document.getElementById('a') as Element, 'click'))).toBe(1);
  });

  test('a mascot added after the grant starts immediately', async ({ page }) => {
    await add(page, { gyro: '' }, 'a');
    await page.click('#a');
    await expect.poll(() => eventStates(page)).toEqual(['granted']);
    await add(page, { gyro: '' }, 'b');
    await expect.poll(() => eventStates(page)).toEqual(['granted', 'granted']);
    expect(await requests(page)).toBe(1);
  });

  test('removing the mascot drops the waiting tap listener', async ({ page }) => {
    await add(page, { gyro: '' });
    const held = await page.evaluate(() => {
      const el = document.querySelector('#m') as HTMLElement;
      const before = window.listeners.count(el, 'click');
      el.remove();
      return { before, after: window.listeners.count(el, 'click') };
    });
    expect(held.after).toBe(held.before - 2);
  });
});

test('runs against the real engine without throwing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  const state = await page.evaluate(async () => {
    const el = document.createElement('agent-mascot');
    el.setAttribute('gyro', '');
    document.body.append(el);
    return el.enableGyro();
  });
  expect(['granted', 'unsupported']).toContain(state);
  expect(errors).toEqual([]);
});

test('a sensor-less desktop browser ends up unsupported where the engine says so', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium fires the all-null event in this environment');
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  const states = await page.evaluate(async () => {
    const seen: string[] = [];
    document.addEventListener('mascot-gyro', (event) => seen.push((event as CustomEvent).detail.state));
    const el = document.createElement('agent-mascot');
    el.setAttribute('gyro', '');
    document.body.append(el);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return seen;
  });
  expect(states).toEqual(['granted', 'unsupported']);
});

// Not imported by the app: this file exists for the type checker.
import { useRef, type ComponentProps } from 'react';
import type { AgentMascot } from 'agent-mascots';

export function Valid() {
  const ref = useRef<AgentMascot>(null);
  return (
    <agent-mascot
      ref={ref}
      className="mascot"
      style={{ width: 80 }}
      shape="my-registered-shape"
      material="glass"
      color="var(--brand)"
      body-width="1.2"
      eye-shape="dot"
      eyeSpacing={1.1}
      accessories="ears arms"
      detail="simple"
      shadow="none"
      onClick={(event) => event.currentTarget.poke()}
      onmascot-gyro={(event) => console.log(event.detail.state)}
    />
  );
}

export const props: ComponentProps<'agent-mascot'> = { mood: 'listening', 'track-reach': 3 };

export const invalid = [
  // @ts-expect-error not a mood
  <agent-mascot mood="angry" />,
  // @ts-expect-error not a material
  <agent-mascot material="wood" />,
  // @ts-expect-error not an option
  <agent-mascot moood="idle" />,
  // @ts-expect-error not an eye shape, under its attribute name
  <agent-mascot eye-shape="hexagon" />,
  // @ts-expect-error gyro is a boolean
  <agent-mascot gyro="yes" />,
  // @ts-expect-error trackElement takes an element
  <agent-mascot trackElement="#hero" />,
  // @ts-expect-error events get a CustomEvent
  <agent-mascot onmascot-gyro={(event: MouseEvent) => event.clientX} />,
];

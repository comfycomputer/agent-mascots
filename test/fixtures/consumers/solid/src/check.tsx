import 'agent-mascots/jsx';
import type { AgentMascot } from 'agent-mascots';

export function Valid(props: { target: Element }) {
  let mascot: AgentMascot | undefined;
  return (
    <agent-mascot
      ref={mascot}
      class="mascot"
      shape="my-registered-shape"
      body-width="1.2"
      eyeSpacing={1.1}
      mood="listening"
      prop:trackElement={props.target}
      on:mascot-gyro={(event) => console.log(event.detail.state)}
      onClick={() => mascot?.poke()}
    />
  );
}

export const invalid = [
  // @ts-expect-error not a mood
  <agent-mascot mood="angry" />,
  // @ts-expect-error not a material
  <agent-mascot material="wood" />,
  // @ts-expect-error not an option
  <agent-mascot moood="idle" />,
  // @ts-expect-error not an eye shape, under its attribute name
  <agent-mascot eye-shape="hexagon" />,
  // @ts-expect-error events get a CustomEvent
  <agent-mascot on:mascot-gyro={(event: MouseEvent) => event.clientX} />,
];

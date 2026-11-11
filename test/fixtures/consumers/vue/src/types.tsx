// Not imported by the app: this file exists for the type checker.
export const valid = (
  <agent-mascot
    class="mascot"
    shape="my-registered-shape"
    body-width="1.2"
    eyeSpacing={1.1}
    mood="listening"
    onClick={() => undefined}
    onMascotGyro={(event) => console.log(event.detail.state)}
  />
);

export const invalid = [
  // @ts-expect-error not a mood
  <agent-mascot mood="angry" />,
  // @ts-expect-error not a material
  <agent-mascot material="wood" />,
  // @ts-expect-error gyro is a boolean
  <agent-mascot gyro="yes" />,
];

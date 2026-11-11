<!-- Not imported by the app: this file exists for the type checker. -->
<template>
  <!-- @vue-expect-error not a mood -->
  <agent-mascot mood="angry" />
  <!-- @vue-expect-error not a material -->
  <agent-mascot material="wood" />
  <!-- @vue-expect-error not an eye shape, under its attribute name -->
  <agent-mascot eye-shape="hexagon" />
  <!-- @vue-expect-error events get a CustomEvent -->
  <agent-mascot @mascot-gyro="(event: MouseEvent) => event.clientX" />
</template>

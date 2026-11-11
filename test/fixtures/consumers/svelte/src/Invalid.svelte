<!-- Each element must produce one error. The runner counts them: Svelte has no expect-error. -->
<script lang="ts"></script>

<agent-mascot mood="angry"></agent-mascot>
<agent-mascot material="wood"></agent-mascot>
<agent-mascot eye-shape="hexagon"></agent-mascot>
<agent-mascot onmascot-gyro={(event: MouseEvent) => event.clientX}></agent-mascot>

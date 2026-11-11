<!-- A fader with an exact value beside it. Both are real inputs, so keys and typing work. -->
<script lang="ts">
  interface Props {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    /** Where the default sits, marked on the rail. */
    rest: number;
    /** Every change, as it happens. */
    oninput: (value: number) => void;
    /** The end of a change: a released fader, or a value typed in. */
    onchange?: () => void;
  }

  let { label, min, max, step, value, rest, oninput, onchange }: Props = $props();

  const tidy = (number: number) => String(Math.round(number * 1000) / 1000);
  const share = (number: number) => `${((Math.min(max, Math.max(min, number)) - min) / (max - min)) * 100}%`;
  const clamp = (number: number) => Math.min(max, Math.max(min, number));

  /** What is being typed, which is left alone until the field lets go. */
  let draft = $state<string | null>(null);
</script>

<div class="scrub">
  <span class="scrub__rail">
    <span class="scrub__fill" style:width={share(value)}></span>
    <span class="scrub__tick" style:left={share(rest)}></span>
    <input type="range" {min} {max} {step} {value} aria-label={label} oninput={(event) => oninput(Number(tidy(Number(event.currentTarget.value))))} onchange={() => onchange?.()} />
  </span>
  <input
    class="scrub__value"
    type="number"
    {min}
    {max}
    {step}
    value={draft ?? tidy(value)}
    aria-label="{label}, exact value"
    oninput={(event) => {
      draft = event.currentTarget.value;
      const number = Number(draft);
      if (draft !== '' && Number.isFinite(number)) oninput(Number(tidy(clamp(number))));
    }}
    onchange={() => {
      draft = null;
      onchange?.();
    }}
  />
</div>

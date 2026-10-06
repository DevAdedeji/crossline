<script setup lang="ts">
import { DEFAULT_TOUCH_PREFERENCES } from '~/game/touchPreferences'
const preferences = useTouchPreferences()
</script>
<template>
  <fieldset class="touch-settings">
    <legend>Touch controls</legend>
    <label
      >Size <output>{{ preferences.size }}%</output
      ><input
        v-model.number="preferences.size"
        aria-label="Touch control size"
        type="range"
        min="85"
        max="120"
        step="5"
    /></label>
    <label
      >Opacity <output>{{ preferences.opacity }}%</output
      ><input
        v-model.number="preferences.opacity"
        aria-label="Touch control opacity"
        type="range"
        min="35"
        max="100"
        step="5"
    /></label>
    <button type="button" data-ui-action @click="preferences = { ...DEFAULT_TOUCH_PREFERENCES }">
      Reset controls
    </button>
  </fieldset>
</template>
<style scoped>
.touch-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
  margin: 20px 0 8px;
  border-top: 1px solid var(--cl-line);
  padding-top: 14px;
  text-align: left;
}
legend {
  font-size: 13px;
  font-weight: 700;
  padding-right: 12px;
  color: var(--cl-text);
}
label {
  font-size: 12px;
  color: var(--cl-muted);
}
output {
  float: right;
  color: var(--cl-accent);
  font-variant-numeric: tabular-nums;
}
input {
  display: block;
  width: 100%;
  height: 28px;
  accent-color: var(--cl-accent);
  cursor: pointer;
  touch-action: pan-x;
}
button {
  justify-self: start;
  grid-column: 1/-1;
  font-size: 11px;
  color: var(--cl-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 5px 0;
}
</style>

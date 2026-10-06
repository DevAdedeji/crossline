<script setup lang="ts">
import { authClient } from '~/game/account'
import { prepareEntry, takeEntry } from '~/game/entry'
const emit = defineEmits<{ signedIn: []; close: [] }>()
const panel = ref<HTMLElement>(),
  signup = ref(false),
  username = ref(''),
  email = ref(''),
  password = ref(''),
  busy = ref(false),
  error = ref(''),
  local = ref(false),
  available = ref(false)
let frame = 0,
  previous: boolean[] = [],
  usePad = false
const input = () => (usePad ? 'pad' : navigator.maxTouchPoints > 0 ? 'touch' : 'mouse')
function toggleSignup() {
  signup.value = !signup.value
  error.value = ''
  password.value = ''
}
async function cleanup() {
  if (document.pointerLockElement) document.exitPointerLock()
  const entry = takeEntry()
  await entry?.audio.close()
}
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await prepareEntry(input())
    const result = signup.value
      ? await authClient.signUp.email({
          username: username.value.trim().toLowerCase(),
          name: username.value.trim().toLowerCase(),
          email: email.value.trim(),
          password: password.value,
        })
      : await authClient.signIn.email({ email: email.value.trim(), password: password.value })
    if (result.error)
      throw new Error(
        result.error.status === 429
          ? 'Too many attempts. Wait a minute and retry.'
          : 'Unable to continue. Check your email and password.',
      )
    password.value = ''
    emit('signedIn')
  } catch (e) {
    await cleanup()
    error.value = e instanceof Error ? e.message : 'Unable to sign in.'
  } finally {
    busy.value = false
  }
}
function focusTrap(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const elements = Array.from(
    panel.value?.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input:not(:disabled),button:not(:disabled)',
    ) ?? [],
  )
  const first = elements[0],
    last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
function pad() {
  const controller = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected),
    pressed = controller?.buttons.map((b) => b.pressed) ?? []
  const edge = (i: number) => pressed[i] && !previous[i]
  if (document.hasFocus() && controller) {
    const elements = Array.from(
      panel.value?.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        'input:not(:disabled),button:not(:disabled)',
      ) ?? [],
    )
    if (edge(12) || edge(13)) {
      usePad = true
      const current = elements.indexOf(document.activeElement as HTMLInputElement),
        next = (current + (edge(13) ? 1 : -1) + elements.length) % elements.length
      elements[next]?.focus()
    }
    if (edge(0)) {
      usePad = true
      const active = document.activeElement as HTMLElement
      if (active?.tagName === 'BUTTON') active.click()
      else active?.focus()
    }
    if (edge(1) && !busy.value) emit('close')
  }
  previous = pressed
  frame = requestAnimationFrame(pad)
}
onMounted(async () => {
  frame = requestAnimationFrame(pad)
  try {
    const status = await $fetch<{ local: boolean; available: boolean }>('/api/auth/status')
    local.value = status.local
    available.value = status.available
    await nextTick()
    panel.value?.querySelector<HTMLInputElement>('input')?.focus()
  } catch {
    error.value = 'Online accounts are not configured yet. Campaign is available.'
  }
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
<template>
  <section
    class="account-gate"
    role="dialog"
    aria-modal="true"
    aria-label="Online account"
    @keydown="focusTrap"
    @keydown.esc.stop.prevent="!busy && emit('close')"
  >
    <div ref="panel" class="account-panel">
      <div class="account-top">
        <strong>CROSSLINE / ONLINE</strong
        ><button :disabled="busy" aria-label="Close account form" @click="emit('close')">✕</button>
      </div>
      <h1>{{ signup ? 'Create your account.' : 'Welcome back.' }}</h1>
      <p v-if="local" class="local-note">LOCAL DEVELOPMENT · Accounts stay on this computer.</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <form @submit.prevent="submit">
        <label v-if="signup"
          >Username<input
            v-model="username"
            name="username"
            aria-label="Username"
            autocomplete="username"
            minlength="3"
            maxlength="16"
            pattern="[A-Za-z0-9_]{3,16}"
            required
            :disabled="busy || !available"
          /><small>3–16 letters, numbers or underscores</small></label
        >
        <label
          >Email<input
            v-model="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            maxlength="254"
            :disabled="busy || !available"
        /></label>
        <label
          >Password<input
            v-model="password"
            name="password"
            aria-label="Password"
            type="password"
            :autocomplete="signup ? 'new-password' : 'current-password'"
            minlength="10"
            maxlength="128"
            required
            :disabled="busy || !available"
          /><small v-if="signup">At least 10 characters</small></label
        >
        <button class="primary" type="submit" :disabled="busy || !available">
          {{ busy ? 'PLEASE WAIT…' : signup ? 'CREATE ACCOUNT & PLAY' : 'LOG IN & PLAY' }}
        </button>
        <button type="button" :disabled="busy" @click="toggleSignup">
          {{ signup ? 'Already have an account? Log in' : 'New here? Create an account' }}
        </button>
      </form>
    </div>
  </section>
</template>
<style scoped>
.account-gate {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  overflow: auto;
  background: #091216ef;
  padding: 16px;
  touch-action: pan-y;
  color: #edf1ef;
}
.account-panel {
  width: min(430px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  background: #152126;
  border-top: 3px solid #ffb15c;
  padding: 24px;
}
.account-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 0.16em;
}
.account-top button {
  width: auto;
  padding: 8px;
}
h1 {
  font-size: 27px;
  font-weight: 900;
  margin: 16px 0;
}
p {
  font-size: 12px;
  line-height: 1.5;
  margin: 12px 0;
}
.local-note {
  color: #ffbf7c;
}
label {
  display: block;
  font-size: 12px;
  margin: 12px 0;
}
input {
  display: block;
  width: 100%;
  min-height: 42px;
  background: #091318;
  border: 1px solid #ffffff50;
  padding: 10px;
  margin-top: 5px;
  font-size: 16px;
  color: white;
}
small {
  font-size: 10px;
  color: #afbcba;
}
button {
  width: 100%;
  min-height: 40px;
  padding: 10px;
  font-size: 12px;
}
button.primary {
  margin-top: 10px;
  background: #ffb15c;
  color: #152126;
  font-weight: 900;
}
button:disabled,
input:disabled {
  opacity: 0.5;
}
button:focus-visible,
input:focus {
  outline: 2px solid #ffb15c;
  outline-offset: 2px;
}
[role='alert'] {
  color: #ffb8a4;
}
@media (max-height: 500px) and (orientation: landscape) {
  .account-panel {
    width: min(620px, 100%);
    padding: 12px 20px;
  }
  .account-top button {
    min-height: 26px;
    padding: 4px;
  }
  h1 {
    font-size: 22px;
    margin: 6px 0;
  }
  form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  label {
    margin: 4px 0;
  }
  .local-note {
    font-size: 10px;
    margin: 8px 0;
  }
  form button:last-child {
    grid-column: 1/-1;
  }
  button.primary {
    align-self: center;
    margin-top: 16px;
  }
}
</style>

import { DEFAULT_TOUCH_PREFERENCES, touchPreferences } from '~/game/touchPreferences'

export function useTouchPreferences() {
  const preferences = useState('touch-preferences', () => ({ ...DEFAULT_TOUCH_PREFERENCES }))
  onMounted(() => {
    try {
      preferences.value = touchPreferences(
        JSON.parse(localStorage.getItem('crossline.touch') ?? 'null'),
      )
    } catch {
      /* Keep defaults when storage is unavailable. */
    }
  })
  watch(
    preferences,
    (value) => {
      try {
        localStorage.setItem('crossline.touch', JSON.stringify(touchPreferences(value)))
      } catch {
        /* Settings still apply for this session. */
      }
    },
    { deep: true },
  )
  return preferences
}

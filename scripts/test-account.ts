/** Synthetic local test users only. No mail is sent and no production credentials are used. */
export const TEST_PASSWORD = 'Synthetic-Test-Only-2026!'
export async function createTestAccount(base: string, username: string) {
  username = username.toLowerCase()
  const email = `${username}@example.test`
  const headers = { 'content-type': 'application/json', origin: base }
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username, name: username, email, password: TEST_PASSWORD }),
  })
  if (!signup.ok) throw new Error(`Test signup failed: ${signup.status}`)
  const cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  const session = (await (
    await fetch(`${base}/api/auth/get-session`, { headers: { cookie, origin: base } })
  ).json()) as { user: { id: string; username: string } }
  if (!session?.user?.id) throw new Error('Signup test session missing')
  return {
    id: session.user.id,
    username: session.user.username,
    cookie,
    async token() {
      const response = await fetch(`${base}/api/auth/one-time-token/generate`, {
        headers: { cookie, origin: base },
      })
      if (!response.ok) throw new Error(`Test ticket failed: ${response.status}`)
      return ((await response.json()) as { token: string }).token
    },
    async logout() {
      return fetch(`${base}/api/auth/sign-out`, {
        method: 'POST',
        headers: { ...headers, cookie },
        body: '{}',
      })
    },
  }
}

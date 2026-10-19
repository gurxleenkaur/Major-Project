const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string

const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string

const SCOPES = ['user-read-private']

const VERIFIER_KEY = 'spotify_code_verifier'
const TOKEN_KEY = 'spotify_access_token'
const EXPIRY_KEY = 'spotify_token_expiry'

function randomString(length: number): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  const values = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(values)
    .map((value) => characters[value % characters.length])
    .join('')
}

async function createChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)

  const bytes = new Uint8Array(digest)

  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function loginWithSpotify(): Promise<void> {
  if (!CLIENT_ID || !REDIRECT_URI) {
    throw new Error('Spotify Client ID or redirect URI is missing from .env')
  }

  const verifier = randomString(64)
  const challenge = await createChallenge(verifier)

  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
    state: randomString(32),
  })

  const state = params.get('state')

  if (state) {
    sessionStorage.setItem('spotify_oauth_state', state)
  }

  window.location.href =
    `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function completeSpotifyLogin(): Promise<void> {
  const params = new URLSearchParams(window.location.search)

  const code = params.get('code')
  const returnedState = params.get('state')
  const savedState = sessionStorage.getItem('spotify_oauth_state')

  if (params.has('error')) {
    throw new Error(params.get('error') || 'Spotify authorization failed')
  }

  if (!code) {
    throw new Error('Spotify authorization code was not returned')
  }

  if (!returnedState || returnedState !== savedState) {
    throw new Error('Spotify authorization state did not match')
  }

  const verifier = sessionStorage.getItem(VERIFIER_KEY)

  if (!verifier) {
    throw new Error('Spotify login session expired. Please try again.')
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error_description || 'Unable to obtain Spotify token')
  }

  sessionStorage.setItem(TOKEN_KEY, data.access_token)

  sessionStorage.setItem(
    EXPIRY_KEY,
    String(Date.now() + data.expires_in * 1000),
  )

  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem('spotify_oauth_state')

  window.history.replaceState({}, document.title, '/callback')
}

export function getSpotifyToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) || 0)

  if (!token || Date.now() >= expiry) {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EXPIRY_KEY)
    return null
  }

  return token
}

export function logoutSpotify(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(EXPIRY_KEY)
}
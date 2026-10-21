const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ||
  'http://127.0.0.1:5173/callback';

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'user-read-recently-played',
].join(' ');

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  artists: {
    id: string;
    name: string;
  }[];
  album: {
    name: string;
    images: {
      url: string;
      width?: number;
      height?: number;
    }[];
  };
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
};

export type SpotifyRecentlyPlayedTrack = {
  track: SpotifyTrack;
  played_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SearchResponse = {
  tracks?: {
    items: SpotifyTrack[];
  };
};

type RecentlyPlayedResponse = {
  items?: SpotifyRecentlyPlayedTrack[];
};

type QueueResponse = {
  currently_playing?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
};

// --------------------------------------------------
// DUPLICATE-REQUEST PROTECTION
// --------------------------------------------------

// Prevents simultaneous queue requests for the same URI
// within this browser tab.
const tracksBeingQueued = new Set<string>();

// --------------------------------------------------
// AUTHENTICATION HELPERS
// --------------------------------------------------

function randomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(
    values,
    (value) => chars[value % chars.length],
  ).join('');
}

async function createChallenge(
  verifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );

  return btoa(
    String.fromCharCode(...new Uint8Array(digest)),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// --------------------------------------------------
// SPOTIFY LOGIN
// --------------------------------------------------

export async function loginWithSpotify(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error(
      'Spotify Client ID is missing. Check your frontend .env file.',
    );
  }

  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = await createChallenge(verifier);

  sessionStorage.setItem('spotify_code_verifier', verifier);
  sessionStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  });

  window.location.assign(
    `${AUTH_ENDPOINT}?${params.toString()}`,
  );
}

// --------------------------------------------------
// SPOTIFY CALLBACK
// --------------------------------------------------

export async function handleSpotifyCallback(): Promise<boolean> {
  const url = new URL(window.location.href);

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  if (!code) {
    return false;
  }

  const expectedState = sessionStorage.getItem(
    'spotify_auth_state',
  );

  const verifier = sessionStorage.getItem(
    'spotify_code_verifier',
  );

  if (
    !expectedState ||
    !returnedState ||
    returnedState !== expectedState
  ) {
    throw new Error(
      'Spotify authentication state did not match. Please try again.',
    );
  }

  if (!verifier) {
    throw new Error(
      'Your Spotify login session expired. Please try again.',
    );
  }

  if (!CLIENT_ID) {
    throw new Error('Spotify Client ID is missing.');
  }

  const response = await fetch(TOKEN_ENDPOINT, {
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
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `Spotify token exchange failed (${response.status}): ${errorBody}`,
    );
  }

  const tokens = (await response.json()) as TokenResponse;

  sessionStorage.setItem(
    'spotify_access_token',
    tokens.access_token,
  );

  sessionStorage.setItem(
    'spotify_token_expires_at',
    String(Date.now() + tokens.expires_in * 1000),
  );

  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem('spotify_auth_state');

  window.history.replaceState(
    {},
    document.title,
    '/',
  );

  return true;
}

// --------------------------------------------------
// ACCESS TOKEN
// --------------------------------------------------

export function getSpotifyAccessToken(): string | null {
  const token = sessionStorage.getItem(
    'spotify_access_token',
  );

  const expiresAt = Number(
    sessionStorage.getItem('spotify_token_expires_at'),
  );

  if (
    !token ||
    !expiresAt ||
    Date.now() >= expiresAt
  ) {
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_token_expires_at');

    return null;
  }

  return token;
}

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

export function logoutSpotify(): void {
  [
    'spotify_access_token',
    'spotify_token_expires_at',
    'spotify_code_verifier',
    'spotify_auth_state',
  ].forEach((key) => {
    sessionStorage.removeItem(key);
  });

  tracksBeingQueued.clear();
}

// --------------------------------------------------
// COMMON SPOTIFY API REQUEST
// --------------------------------------------------

async function spotifyRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getSpotifyAccessToken();

  if (!token) {
    throw new Error(
      'Your Spotify session has expired. Please reconnect.',
    );
  }

  const headers = new Headers(init.headers);

  headers.set('Authorization', `Bearer ${token}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  // Read the response body only once.
  const responseText = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      logoutSpotify();

      throw new Error(
        'Your Spotify session has expired. Please reconnect.',
      );
    }

    if (response.status === 403) {
      throw new Error(
        'Spotify refused this request. Check your account eligibility, playback permissions, and player status.',
      );
    }

    if (response.status === 404) {
      throw new Error(
        'Spotify could not find an active playback device. Wait for the StudySpark player to connect, then try again.',
      );
    }

    if (response.status === 429) {
      throw new Error(
        'Spotify is receiving too many requests. Wait a moment and try again.',
      );
    }

    throw new Error(
      `Spotify API error ${response.status} for ${endpoint}: ${
        responseText || response.statusText || 'No response body'
      }`,
    );
  }

  // Successful playback commands frequently return HTTP 204.
  if (
    response.status === 204 ||
    !responseText.trim()
  ) {
    return undefined as T;
  }

  const method = (init.method ?? 'GET').toUpperCase();

  // Our playback commands expect no return value.
  // Do not attempt to parse their successful plain-text responses.
  if (
    ['POST', 'PUT', 'DELETE'].includes(method) &&
    !responseText.trim().startsWith('{') &&
    !responseText.trim().startsWith('[')
  ) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      `Spotify returned an unexpected response for ${endpoint}. HTTP status: ${response.status}.`,
    );
  }
}

// --------------------------------------------------
// GET A TRACK
// --------------------------------------------------

export async function getSpotifyTrack(
  trackId: string,
): Promise<SpotifyTrack> {
  return spotifyRequest<SpotifyTrack>(
    `/tracks/${encodeURIComponent(trackId)}`,
  );
}

// --------------------------------------------------
// SEARCH SPOTIFY TRACKS
// --------------------------------------------------

export async function searchSpotifyTracks(
  query: string,
): Promise<SpotifyTrack[]> {
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    type: 'track',
    limit: '10',
  });

  const data = await spotifyRequest<SearchResponse>(
    `/search?${params.toString()}`,
  );

  return data.tracks?.items ?? [];
}

// --------------------------------------------------
// RECENTLY PLAYED TRACKS
// --------------------------------------------------

export async function getRecentlyPlayedTracks(
  limit = 10,
): Promise<SpotifyRecentlyPlayedTrack[]> {
  const safeLimit = Math.max(
    1,
    Math.min(50, Math.floor(limit)),
  );

  const params = new URLSearchParams({
    limit: String(safeLimit),
  });

  const data =
    await spotifyRequest<RecentlyPlayedResponse>(
      `/me/player/recently-played?${params.toString()}`,
    );

  return data.items ?? [];
}

// --------------------------------------------------
// GET SPOTIFY QUEUE
// --------------------------------------------------

export async function getSpotifyQueue(): Promise<SpotifyTrack[]> {
  const data = await spotifyRequest<QueueResponse>(
    '/me/player/queue',
  );

  return data.queue ?? [];
}

// --------------------------------------------------
// ACTIVATE THE STUDYSPARK PLAYBACK DEVICE
// --------------------------------------------------

export async function activateSpotifyDevice(
  deviceId: string,
): Promise<void> {
  if (!deviceId) {
    throw new Error(
      'Spotify player is not ready. Wait for the player to initialize.',
    );
  }

  await spotifyRequest<void>('/me/player', {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });
}

// --------------------------------------------------
// ADD TRACK TO SPOTIFY QUEUE
// --------------------------------------------------

export async function addSpotifyTrackToQueue(
  uri: string,
  deviceId?: string,
): Promise<void> {
  if (!uri.startsWith('spotify:track:')) {
    throw new Error('Invalid Spotify track URI.');
  }

  if (tracksBeingQueued.has(uri)) {
    return;
  }

  tracksBeingQueued.add(uri);

  try {
    // Check the current Spotify queue before adding.
    const data = await spotifyRequest<QueueResponse>(
      '/me/player/queue',
    );

    // Do not add the currently playing track.
    if (data.currently_playing?.uri === uri) {
      return;
    }

    // Do not add a track already in the queue.
    if (data.queue?.some((track) => track.uri === uri)) {
      return;
    }

    const params = new URLSearchParams({ uri });

    if (deviceId) {
      params.set('device_id', deviceId);
    }

    await spotifyRequest(
      `/me/player/queue?${params.toString()}`,
      {
        method: 'POST',
      },
    );
  } finally {
    tracksBeingQueued.delete(uri);
  }
}

// --------------------------------------------------
// START PLAYING A TRACK
// --------------------------------------------------

export async function startSpotifyTrack(
  uri: string,
  deviceId: string,
): Promise<void> {
  if (!uri || !uri.startsWith('spotify:track:')) {
    throw new Error('Invalid Spotify track URI.');
  }

  if (!deviceId) {
    throw new Error(
      'No Spotify playback device is available. Wait for the StudySpark player to connect.',
    );
  }

  await spotifyRequest<void>(
    `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        uris: [uri],
      }),
    },
  );
}

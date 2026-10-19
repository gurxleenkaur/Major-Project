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
  'user-modify-playback-state',
  'user-read-recently-played',
].join(' ');

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
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return btoa(
    String.fromCharCode(...new Uint8Array(digest)),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

export async function handleSpotifyCallback(): Promise<boolean> {
  const currentUrl = new URL(window.location.href);

  const code = currentUrl.searchParams.get('code');
  const returnedState = currentUrl.searchParams.get('state');
  const error = currentUrl.searchParams.get('error');

  if (error) {
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  if (!code) {
    return false;
  }

  const expectedState = sessionStorage.getItem('spotify_auth_state');
  const verifier = sessionStorage.getItem('spotify_code_verifier');

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
    const errorText = await response.text();

    throw new Error(
      `Spotify token exchange failed (${response.status}): ${errorText}`,
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

  window.history.replaceState({}, document.title, '/');

  return true;
}

export function getSpotifyAccessToken(): string | null {
  const token = sessionStorage.getItem('spotify_access_token');

  const expiresAt = Number(
    sessionStorage.getItem('spotify_token_expires_at'),
  );

  if (!token || !expiresAt || Date.now() >= expiresAt) {
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_token_expires_at');

    return null;
  }

  return token;
}

export function logoutSpotify(): void {
  sessionStorage.removeItem('spotify_access_token');
  sessionStorage.removeItem('spotify_token_expires_at');
  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem('spotify_auth_state');
}

async function spotifyRequest<T>(endpoint: string): Promise<T> {
  const token = getSpotifyAccessToken();

  if (!token) {
    throw new Error(
      'Your Spotify session has expired. Please connect again.',
    );
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();

    if (response.status === 401) {
      logoutSpotify();

      throw new Error(
        'Your Spotify session has expired. Please connect again.',
      );
    }

    if (response.status === 403) {
      throw new Error(
        'Spotify did not allow this request. Check your account permissions.',
      );
    }

    throw new Error(
      `Spotify request failed (${response.status}): ${errorBody}`,
    );
  }

  return (await response.json()) as T;
}

export async function getSpotifyTrack(
  trackId: string,
): Promise<SpotifyTrack> {
  return spotifyRequest<SpotifyTrack>(
    `/tracks/${encodeURIComponent(trackId)}`,
  );
}

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

/**
 * Retrieves the current user's recently played Spotify tracks.
 *
 * This reads listening history; it does not start playback.
 */
export async function getRecentlyPlayedTracks(
  limit = 10,
): Promise<SpotifyRecentlyPlayedTrack[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

  const params = new URLSearchParams({
    limit: String(safeLimit),
  });

  const data = await spotifyRequest<RecentlyPlayedResponse>(
    `/me/player/recently-played?${params.toString()}`,
  );

  return data.items ?? [];
}
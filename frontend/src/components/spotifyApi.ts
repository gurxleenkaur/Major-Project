import { getSpotifyToken } from './spotifyAuth'

export type SpotifySong = {
  id: string
  title: string
  artist: string
  albumImage: string | null
  spotifyUrl: string
  previewUrl: string | null
}

export async function searchSpotifySongs(
  query: string,
): Promise<SpotifySong[]> {
  const token = getSpotifyToken()

  if (!token) {
    throw new Error('Connect your Spotify account before searching.')
  }

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: '20',
  })

  const response = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))

    throw new Error(
      error.error?.message || `Spotify search failed (${response.status})`,
    )
  }

  const data = await response.json()

  return (data.tracks?.items || []).map((track: any) => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist: any) => artist.name).join(', '),
    albumImage: track.album.images?.[0]?.url || null,
    spotifyUrl: track.external_urls.spotify,
    previewUrl: track.preview_url || null,
  }))
}
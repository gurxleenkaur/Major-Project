export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

export async function searchITunesTracks(
  term: string,
): Promise<ITunesTrack[]> {
  if (!term.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    term: term.trim(),
    entity: 'song',
    country: 'IN',
    limit: '25',
  });

  const response = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Unable to fetch iTunes tracks.');
  }

  const data = await response.json();

  return (data.results ?? []) as ITunesTrack[];
}
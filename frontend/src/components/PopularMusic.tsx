import { useEffect, useMemo, useState } from 'react';
import './PopularMusic.css';

import SpotifyWebPlayback from './SpotifyWebPlayback';

import {
  getSpotifyAccessToken,
  getRecentlyPlayedTracks,
  loginWithSpotify,
  logoutSpotify,
  searchSpotifyTracks,
  type SpotifyTrack,
  type SpotifyRecentlyPlayedTrack,
} from '../services/spotify';

import {
  searchITunesTracks,
  type ITunesTrack,
} from '../services/itunes';

const categories = [
  'All',
  'Hindi',
  'Punjabi',
  'Energetic',
  'Chill',
  'Romantic',
  'Bollywood',
  'Instrumental',
  'Pop',
  'Classical',
  'Focus',
  'Trending',
];

const categorySearchTerms: Record<string, string> = {
  All: 'popular songs',
  Hindi: 'Hindi songs',
  Punjabi: 'Punjabi songs',
  Energetic: 'energetic music',
  Chill: 'chill music',
  Romantic: 'romantic songs',
  Bollywood: 'Bollywood songs',
  Instrumental: 'instrumental music',
  Pop: 'pop hits',
  Classical: 'classical music',
  Focus: 'study music',
  Trending: 'popular songs',
};

type ITunesSong = {
  source: 'itunes';
  id: string;
  title: string;
  artist: string;
  category: string;
  emoji: string;
  imageUrl: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

type SpotifySong = {
  source: 'spotify';
  id: string;
  title: string;
  artist: string;
  category: string;
  emoji: string;
  spotifyUri: string;
  imageUrl: string;
  playedAt?: string;
};

type SelectedSong = ITunesSong | SpotifySong;

function convertITunesTrack(
  track: ITunesTrack,
  category: string,
): ITunesSong {
  return {
    source: 'itunes',
    id: String(track.trackId),
    title: track.trackName,
    artist: track.artistName,
    category,
    emoji: '🎵',
    imageUrl: track.artworkUrl100
      ? track.artworkUrl100.replace('100x100bb', '600x600bb')
      : '',
    previewUrl: track.previewUrl,
    trackViewUrl: track.trackViewUrl,
  };
}

function convertSpotifyTrack(track: SpotifyTrack): SpotifySong {
  return {
    source: 'spotify',
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(', '),
    category: 'Spotify',
    emoji: '🎵',
    spotifyUri: track.uri,
    imageUrl: track.album?.images?.[0]?.url ?? '',
  };
}

function convertRecentlyPlayedTrack(
  item: SpotifyRecentlyPlayedTrack,
): SpotifySong {
  return {
    ...convertSpotifyTrack(item.track),
    category: 'Recently Played',
    playedAt: item.played_at,
  };
}

function formatPlayedAt(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `Played ${date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
}

export default function PopularMusic() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Keep this selection separate from the search query.
  // Typing or searching must not clear the currently selected track.
  const [selectedSong, setSelectedSong] =
    useState<SelectedSong | null>(null);

  const [connected, setConnected] = useState(
    () => Boolean(getSpotifyAccessToken()),
  );

  const [itunesResults, setItunesResults] = useState<ITunesSong[]>([]);
  const [spotifyResults, setSpotifyResults] = useState<SpotifySong[]>([]);

  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifySong[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [musicError, setMusicError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [failedImages, setFailedImages] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setConnected(Boolean(getSpotifyAccessToken()));
  }, []);

  // Load Spotify listening history after connection.
  useEffect(() => {
    if (!connected || !getSpotifyAccessToken()) {
      setRecentlyPlayed([]);
      setHistoryError('');
      setIsLoadingHistory(false);
      return;
    }

    let cancelled = false;

    async function loadRecentlyPlayed() {
      setIsLoadingHistory(true);
      setHistoryError('');

      try {
        const items = await getRecentlyPlayedTracks(10);

        if (cancelled) return;

        setRecentlyPlayed(
          items.map(convertRecentlyPlayedTrack),
        );
      } catch (error) {
        if (cancelled) return;

        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Unable to load recently played tracks.',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadRecentlyPlayed();

    return () => {
      cancelled = true;
    };
  }, [connected]);

// Load category recommendations from Spotify or iTunes.
useEffect(() => {
  if (search.trim()) return;

  let cancelled = false;

  async function loadRecommendations() {
    setIsSearching(true);
    setMusicError("");

    try {
      const term =
        categorySearchTerms[activeCategory] ?? "popular songs";

      if (connected) {
        // Spotify-connected users receive Spotify tracks.
        const tracks = await searchSpotifyTracks(term);

        if (cancelled) return;

        setSpotifyResults(tracks.map(convertSpotifyTrack));
      } else {
        // Users without Spotify receive iTunes results.
        const tracks = await searchITunesTracks(term);

        if (cancelled) return;

        setItunesResults(
          tracks.map((track) =>
            convertITunesTrack(track, activeCategory),
          ),
        );
      }
    } catch (error) {
      if (!cancelled) {
        setMusicError(
          error instanceof Error
            ? error.message
            : "Unable to load music recommendations.",
        );
      }
    } finally {
      if (!cancelled) {
        setIsSearching(false);
      }
    }
  }

  void loadRecommendations();

  return () => {
    cancelled = true;
  };
}, [connected, activeCategory, search]);

  const visibleSongs = useMemo(() => {
    const results = connected ? spotifyResults : itunesResults;
    const query = search.trim().toLowerCase();

    if (!query) return results;

    return results.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query),
    );
  }, [connected, spotifyResults, itunesResults, search]);

  async function handleSpotifyLogin() {
    try {
      setMusicError('');
      await loginWithSpotify();
    } catch (error) {
      setMusicError(
        error instanceof Error
          ? error.message
          : 'Could not connect to Spotify.',
      );
    }
  }

  async function handleSearch() {
    const query = search.trim();

    if (!query) {
      setMusicError('Enter a song title or artist to search.');
      return;
    }

    setIsSearching(true);
    setMusicError('');

    // Do NOT clear selectedSong here.
    // The existing player should continue showing the selected track.

    try {
      if (connected) {
        if (!getSpotifyAccessToken()) {
          setConnected(false);
          setMusicError(
            'Your Spotify session expired. Please reconnect.',
          );
          return;
        }

        const tracks = await searchSpotifyTracks(query);

        setSpotifyResults(tracks.map(convertSpotifyTrack));

        if (tracks.length === 0) {
          setMusicError('No Spotify tracks found.');
        }
      } else {
        const tracks = await searchITunesTracks(query);

        setItunesResults(
          tracks.map((track) =>
            convertITunesTrack(track, 'Search'),
          ),
        );

        if (tracks.length === 0) {
          setMusicError('No iTunes tracks found.');
        }
      }
    } catch (error) {
      setMusicError(
        error instanceof Error
          ? error.message
          : 'Music search failed.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  function handleClearSearch() {
    setSearch('');
    setSpotifyResults([]);
    setMusicError('');
    setActiveCategory('All');
    setFailedImages(new Set());

    // Preserve selectedSong so the player remains visible.
  }

  function handleDisconnect() {
    logoutSpotify();

    setConnected(false);
    setSpotifyResults([]);
    setRecentlyPlayed([]);
    setSelectedSong(null);
    setSearch('');
    setMusicError('');
    setHistoryError('');
    setFailedImages(new Set());
    setActiveCategory('All');
  }

  function handleImageError(imageKey: string) {
    setFailedImages((previous) => {
      const next = new Set(previous);
      next.add(imageKey);
      return next;
    });
  }

  function selectSong(song: SelectedSong) {
    setSelectedSong(song);
    setMusicError('');
  }

  function renderSongCard(song: SelectedSong, imageKey: string) {
    const selected =
      selectedSong?.source === song.source &&
      selectedSong.id === song.id;

    const showImage =
      Boolean(song.imageUrl) && !failedImages.has(imageKey);

    return (
      <button
        key={imageKey}
        type="button"
        className={`music-card ${selected ? 'selected' : ''}`}
        onClick={() => selectSong(song)}
        aria-label={`Select ${song.title} by ${song.artist}`}
      >
        <div className="music-cover">
          {showImage ? (
            <img
              src={song.imageUrl}
              alt={`${song.title} album cover`}
              loading="lazy"
              onError={() => handleImageError(imageKey)}
            />
          ) : (
            <div className="music-cover-placeholder">
              {song.emoji}
            </div>
          )}

          <span className="music-card-category">
            {song.emoji} {song.category}
          </span>
        </div>

        <div className="music-card-info">
          <div className="music-card-text">
            <h4>{song.title}</h4>
            <p>{song.artist}</p>

            {song.source === 'spotify' && song.playedAt && (
              <small>{formatPlayedAt(song.playedAt)}</small>
            )}
          </div>

          <span className="music-play-icon" aria-hidden="true">
            {selected ? '♫' : '▶'}
          </span>
        </div>
      </button>
    );
  }

  const selectedSpotifySong =
    selectedSong?.source === 'spotify' ? selectedSong : null;

  return (
    <section className="popular-music">
      <header className="music-heading">
        <div>
          <span className="music-eyebrow">YOUR SOUNDTRACK</span>

          <h2>
            Popular <span>Music</span>
          </h2>

          <p>Find your rhythm. Focus on what matters.</p>

          <div className="spotify-connect-area">
            <button
              type="button"
              className="spotify-connect-button"
              onClick={
                connected ? handleDisconnect : handleSpotifyLogin
              }
            >
              {connected
                ? '✓ Spotify Connected · Disconnect'
                : 'Connect Spotify'}
            </button>

            <span className="spotify-connected-label">
              {connected
                ? 'Search Spotify and revisit your listening history.'
                : 'Explore available music previews without logging in.'}
            </span>
          </div>
        </div>

        <div className="music-heading-icon" aria-hidden="true">
          🎵
        </div>
      </header>

      <div className="music-search">
        <span aria-hidden="true">⌕</span>

        <input
          type="text"
          placeholder="Search songs, artists, or categories..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setMusicError('');
            setSpotifyResults([]);

            // Do NOT clear selectedSong here.
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSearch();
            }
          }}
          aria-label="Search songs and artists"
        />

        {search && (
          <button
            type="button"
            className="clear-search"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        <button
          type="button"
          className="spotify-search-button"
          onClick={() => void handleSearch()}
          disabled={isSearching}
        >
          {isSearching
            ? 'Searching...'
            : connected
              ? 'Search Spotify'
              : 'Search iTunes'}
        </button>
      </div>

      {musicError && (
        <p className="spotify-error" role="alert">
          {musicError}
        </p>
      )}

      <div className="music-categories" aria-label="Music categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`music-category ${
              activeCategory === category ? 'active' : ''
            }`}
            onClick={() => {
              setActiveCategory(category);
              setSearch('');
              setSpotifyResults([]);
              setMusicError('');
              setFailedImages(new Set());

              // Keep the current selected song while browsing.
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="music-section-title">
        <div>
          <h3>
            {search.trim()
              ? 'Search Results'
              : activeCategory === 'All'
                ? 'Popular Tracks'
                : `${activeCategory} Music`}
          </h3>

          <p>
            {isSearching
              ? 'Finding your music...'
              : `${visibleSongs.length} ${
                  visibleSongs.length === 1 ? 'song' : 'songs'
                } found`}
          </p>
        </div>

        <span className="spotify-label">
          <span className="spotify-dot" />
          {connected ? 'Spotify' : 'iTunes'}
        </span>
      </div>

      {isSearching ? (
        <div className="music-empty">
          <span>🎵</span>
          <h3>Finding your music</h3>
          <p>Searching the music catalogue...</p>
        </div>
      ) : visibleSongs.length > 0 ? (
        <div className="music-grid">
          {visibleSongs.map((song) =>
            renderSongCard(song, `${song.source}-${song.id}`),
          )}
        </div>
      ) : (
        <div className="music-empty">
          <span>🎧</span>
          <h3>No songs found</h3>
          <p>Try another search or category.</p>

          {search && (
            <button type="button" onClick={handleClearSearch}>
              Show recommendations
            </button>
          )}
        </div>
      )}

      {/* The player stays mounted and visible while browsing. */}
      {connected && (
        <div className="spotify-player-container" style={{ marginTop: '24px' }}>
          <SpotifyWebPlayback
            accessToken={getSpotifyAccessToken() ?? ''}
            trackUri={selectedSpotifySong?.spotifyUri}
          />
        </div>
      )}

      {/* Recently played history from the user's Spotify account. */}
      {connected && (
        <section className="recently-played-section">
          <div className="music-section-title" style={{ marginTop: '32px' }}>
            <div>
              <h3>Recently Played</h3>
              <p>Your recent Spotify listening history</p>
            </div>

            <span className="spotify-label">
              <span className="spotify-dot" />
              Spotify
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="music-empty">
              <span>🎧</span>
              <h3>Loading your listening history</h3>
              <p>Fetching your recently played tracks...</p>
            </div>
          ) : historyError ? (
            <div className="music-empty">
              <span>🎵</span>
              <h3>Listening history unavailable</h3>
              <p>{historyError}</p>
              <p>
                If you recently added the permission, disconnect and
                reconnect Spotify to authorize it.
              </p>
            </div>
          ) : recentlyPlayed.length > 0 ? (
            <div className="music-grid">
              {recentlyPlayed.map((song, index) =>
                renderSongCard(
                  song,
                  `recent-${song.id}-${index}`,
                ),
              )}
            </div>
          ) : (
            <div className="music-empty">
              <span>🎧</span>
              <h3>No recent tracks found</h3>
              <p>
                Your Spotify account has no recent tracks available
                to show, or Spotify returned an empty history.
              </p>
            </div>
          )}
        </section>
      )}

      {/* iTunes users get a preview player for their selected track. */}
      {!connected && selectedSong?.source === 'itunes' && (
        <div className="music-player-panel">
          <div className="player-panel-heading">
            <div>
              <span className="music-eyebrow">SELECTED TRACK</span>
              <h3>{selectedSong.title}</h3>
              <p>{selectedSong.artist}</p>
            </div>

            <button
              type="button"
              className="close-player"
              onClick={() => setSelectedSong(null)}
              aria-label="Close music player"
            >
              ×
            </button>
          </div>

          {selectedSong.previewUrl ? (
            <div>
              <audio
                key={selectedSong.previewUrl}
                controls
                preload="none"
                src={selectedSong.previewUrl}
                style={{ width: '100%' }}
              />

              <p className="music-footer">
                Preview provided courtesy of iTunes.
              </p>

              {selectedSong.trackViewUrl && (
                <a
                  href={selectedSong.trackViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="spotify-search-button"
                  style={{
                    display: 'inline-flex',
                    marginTop: '12px',
                    textDecoration: 'none',
                  }}
                >
                  View on Apple Music/iTunes ↗
                </a>
              )}
            </div>
          ) : (
            <div className="music-empty">
              <h3>Preview unavailable</h3>
              <p>This song does not have an available preview.</p>

              {selectedSong.trackViewUrl && (
                <a
                  href={selectedSong.trackViewUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Apple Music/iTunes ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {!connected && (
        <p className="music-footer">
          Music previews courtesy of iTunes. Availability varies by track.
          Follow Apple's attribution and store-link requirements.
        </p>
      )}

      <p className="music-footer">
        🎶 A little music can make a study session feel better.
      </p>
    </section>
  );
}
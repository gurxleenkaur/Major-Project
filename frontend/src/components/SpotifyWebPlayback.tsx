import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import './SpotifyWebPlayback.css';

import {
  addSpotifyTrackToQueue,
  getSpotifyQueue,
  startSpotifyTrack,
} from '../services/spotify';

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ name: string }>;
  album?: {
    images?: Array<{ url: string }>;
  };
}

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack | null;
    next_tracks?: SpotifyTrack[];
    previous_tracks?: SpotifyTrack[];
  };
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;

  addListener(
    event: string,
    callback: (data: any) => void,
  ): boolean;

  getCurrentState(): Promise<SpotifyPlayerState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  seek(position: number): Promise<void>;
  activateElement(): Promise<void>;
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume: number;
        getOAuthToken: (
          callback: (token: string) => void,
        ) => void;
      }) => SpotifyPlayer;
    };

    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface Props {
  accessToken: string;
  trackUri?: string;

  onTrackEnded?: (
    currentTrack: SpotifyTrack,
  ) => Promise<string | null>;

  onDeviceReady?: (
    deviceId: string | null,
  ) => void;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

// Desired number of upcoming songs.
const TARGET_QUEUE_SIZE = 5;

// Replenish when the queue contains fewer than this many songs.
const MIN_QUEUE_SIZE = 5;

// Avoid excessive attempts when recommendations cannot be found.
const MAX_RECOMMENDATION_ATTEMPTS = 15;

// --------------------------------------------------
// QUEUE HELPERS
// --------------------------------------------------

// Remove duplicate tracks from the list.
function uniqueTracks(
  tracks: SpotifyTrack[],
): SpotifyTrack[] {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    if (!track.uri || seen.has(track.uri)) {
      return false;
    }

    seen.add(track.uri);
    return true;
  });
}

// Remove the currently playing track from Up Next.
function filterUpcomingTracks(
  tracks: SpotifyTrack[],
  currentTrackUri?: string | null,
): SpotifyTrack[] {
  const unique = uniqueTracks(tracks);

  if (!currentTrackUri) {
    return unique;
  }

  return unique.filter(
    (track) => track.uri !== currentTrackUri,
  );
}

export default function SpotifyWebPlayback({
  accessToken,
  trackUri,
  onTrackEnded,
  onDeviceReady,
}: Props) {
  const playerRef = useRef<SpotifyPlayer | null>(null);

  const tokenRef = useRef(accessToken);
  const deviceIdRef = useRef<string | null>(null);

  const previousTrackUriRef =
    useRef<string | null | undefined>(null);

  const isSeekingRef = useRef(false);

  const lastKnownTrackRef =
    useRef<SpotifyTrack | null>(null);

  const onTrackEndedRef = useRef(onTrackEnded);
  const onDeviceReadyRef = useRef(onDeviceReady);

  const volumeRef = useRef(70);

  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(70);

  const [currentTrack, setCurrentTrack] =
    useState<SpotifyTrack | null>(null);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const [message, setMessage] = useState(
    'Loading Spotify player...',
  );

  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [showQueue, setShowQueue] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);

  // Prevent simultaneous automatic replenishment.
  const replenishingRef = useRef(false);

  // Prevent repeatedly processing the same playback track.
  const replenishedTracksRef = useRef<Set<string>>(
    new Set(),
  );

  // Prevent overlapping additions for the same URI.
  const addingUrisRef = useRef<Set<string>>(new Set());

  // Prevent concurrent queue refreshes.
  const queueRefreshInFlightRef = useRef(false);

  // Keep refs synchronized with the latest props and state.
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  useEffect(() => {
    onDeviceReadyRef.current = onDeviceReady;
  }, [onDeviceReady]);

  // --------------------------------------------------
  // REFRESH QUEUE
  // --------------------------------------------------

 const refreshQueue = useCallback(async () => {
  if (!tokenRef.current) {
    setQueue([]);
    return;
  }

  if (queueRefreshInFlightRef.current) {
    return;
  }

  queueRefreshInFlightRef.current = true;
  setQueueLoading(true);

  try {
    const tracks = await getSpotifyQueue();

    // Get the latest playback state from Spotify.
    const player = playerRef.current;
    const state = await player?.getCurrentState();

    const playingTrack =
      state?.track_window.current_track ??
      lastKnownTrackRef.current;

    if (playingTrack) {
      lastKnownTrackRef.current = playingTrack;
      setCurrentTrack(playingTrack);
    }

    // Remove duplicate tracks and the currently playing song.
    const upcomingTracks = filterUpcomingTracks(
      tracks,
      playingTrack?.uri ?? null,
    );

    setQueue(upcomingTracks);
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : 'Could not load Spotify queue.',
    );
  } finally {
    queueRefreshInFlightRef.current = false;
    setQueueLoading(false);
  }
}, []);

  // Listen for queue updates originating elsewhere in StudySpark.
  useEffect(() => {
  let timer: number | undefined;

  const refresh = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }

    // Let Spotify update its native queue before fetching it.
    timer = window.setTimeout(() => {
      void refreshQueue();
    }, 500);
  };

  window.addEventListener(
    'studyspark:spotify-queue-updated',
    refresh,
  );

  return () => {
    window.removeEventListener(
      'studyspark:spotify-queue-updated',
      refresh,
    );

    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
  };
}, [refreshQueue]);

  // --------------------------------------------------
  // AUTOMATIC QUEUE REPLENISHMENT
  // --------------------------------------------------

  const replenishQueue = useCallback(
    async (track: SpotifyTrack) => {
      if (
        replenishingRef.current ||
        !deviceIdRef.current ||
        !tokenRef.current ||
        !track.uri
      ) {
        return;
      }

      if (replenishedTracksRef.current.has(track.uri)) {
        return;
      }

      replenishingRef.current = true;
      replenishedTracksRef.current.add(track.uri);

      try {
        const deviceId = deviceIdRef.current;

        if (!deviceId) {
          return;
        }

        // Read Spotify's actual upcoming queue.
        let nativeQueue = filterUpcomingTracks(
  await getSpotifyQueue(),
  track.uri,
);

setQueue(nativeQueue);

        // No replenishment is needed if the queue is full.
        if (nativeQueue.length >= MIN_QUEUE_SIZE) {
          return;
        }

        const queuedUris = new Set(
          nativeQueue.map((queuedTrack) => queuedTrack.uri),
        );

        // Keep asking for recommendations until the queue
        // reaches its target or suitable recommendations run out.
        let attempts = 0;

        while (
          nativeQueue.length < TARGET_QUEUE_SIZE &&
          attempts < MAX_RECOMMENDATION_ATTEMPTS
        ) {
          attempts++;

          const recommendation =
            await onTrackEndedRef.current?.(track);

          if (!recommendation) {
            break;
          }

          // Never queue the currently playing track.
          if (
            recommendation === track.uri ||
            recommendation === `spotify:track:${track.id}`
          ) {
            continue;
          }

          // Never queue the same URI twice.
          if (queuedUris.has(recommendation)) {
            continue;
          }

          // Avoid simultaneous additions for the same URI.
          if (addingUrisRef.current.has(recommendation)) {
            continue;
          }

          addingUrisRef.current.add(recommendation);

          try {
            await addSpotifyTrackToQueue(
              recommendation,
              deviceId,
            );
          } finally {
            addingUrisRef.current.delete(recommendation);
          }

          // Read the queue again because Spotify, not the
          // React component, owns the actual queue.
          nativeQueue = filterUpcomingTracks(
  await getSpotifyQueue(),
  lastKnownTrackRef.current?.uri ?? track.uri,
);

setQueue(nativeQueue);

          // Rebuild the set from the latest native queue.
          queuedUris.clear();

          for (const queuedTrack of nativeQueue) {
            queuedUris.add(queuedTrack.uri);
          }

          // If Spotify did not add the requested track,
          // avoid retrying that same recommendation indefinitely.
          if (!queuedUris.has(recommendation)) {
            queuedUris.add(recommendation);
          }
        }

        setQueue(nativeQueue);

        window.dispatchEvent(
          new CustomEvent('studyspark:spotify-queue-updated'),
        );

        if (nativeQueue.length >= TARGET_QUEUE_SIZE) {
          setMessage('Upcoming queue is ready.');
        } else if (nativeQueue.length > 0) {
          setMessage(
            `Queue updated: ${nativeQueue.length} upcoming songs.`,
          );
        } else {
          setMessage(
            'No suitable recommendations were found.',
          );
        }
      } catch (error) {
        // Allow a later attempt if the operation failed.
        replenishedTracksRef.current.delete(track.uri);

        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not replenish the Spotify queue.',
        );
      } finally {
        replenishingRef.current = false;
      }
    },
    [],
  );

  // --------------------------------------------------
  // PLAY A SIMILAR TRACK IF THE QUEUE IS EMPTY
  // --------------------------------------------------

  const playSimilar = useCallback(
    async (track: SpotifyTrack) => {
      try {
        setMessage(
          'Queue is empty — finding a similar song...',
        );

        const uri =
          await onTrackEndedRef.current?.(track);

        const deviceId = deviceIdRef.current;

        if (!uri || !deviceId) {
          setMessage(
            'Queue is empty and no similar song was found.',
          );
          return;
        }

        if (uri === track.uri) {
          setMessage(
            'No different recommendation was found.',
          );
          return;
        }

        await startSpotifyTrack(uri, deviceId);

        previousTrackUriRef.current = uri;

        setMessage('Playing a similar song.');
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not play a similar song.',
        );
      }
    },
    [],
  );

  // --------------------------------------------------
  // INITIALIZE SPOTIFY WEB PLAYBACK SDK
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let player: SpotifyPlayer | null = null;
    let timeoutId: number | undefined;

    if (!accessToken) {
      setReady(false);
      setMessage(
        'Spotify token missing. Please reconnect.',
      );

      onDeviceReadyRef.current?.(null);

      return;
    }

    setReady(false);
    setMessage('Loading Spotify Web Playback SDK...');

    const oldReadyCallback =
      window.onSpotifyWebPlaybackSDKReady;

    const initialize = () => {
      if (
        cancelled ||
        !window.Spotify?.Player ||
        player
      ) {
        return;
      }

      player = new window.Spotify.Player({
        name: 'StudySpark Music',
        volume: volumeRef.current / 100,
        getOAuthToken: (callback) => {
          callback(tokenRef.current);
        },
      });

      playerRef.current = player;

      player.addListener(
        'ready',
        (data: { device_id: string }) => {
          if (cancelled) return;

          deviceIdRef.current = data.device_id;

          onDeviceReadyRef.current?.(data.device_id);

          setReady(true);
          setMessage('Spotify player ready.');

          void refreshQueue();
        },
      );

      player.addListener(
        'not_ready',
        (data: { device_id: string }) => {
          if (cancelled) return;

          if (deviceIdRef.current === data.device_id) {
            deviceIdRef.current = null;
            onDeviceReadyRef.current?.(null);
          }

          setReady(false);

          setMessage(
            'Spotify playback device went offline.',
          );
        },
      );

      for (const event of [
        'initialization_error',
        'authentication_error',
        'account_error',
        'playback_error',
      ]) {
        player.addListener(
          event,
          (data: { message: string }) => {
            if (!cancelled) {
              setMessage(
                `${event.replace(/_/g, ' ')}: ${data.message}`,
              );
            }
          },
        );
      }

      player.addListener(
        'autoplay_failed',
        () => {
          if (!cancelled) {
            setMessage(
              'Press Play to allow browser playback.',
            );
          }
        },
      );

      // ----------------------------------------------
      // PLAYBACK STATE CHANGES
      // ----------------------------------------------

      player.addListener(
        'player_state_changed',
        (state: SpotifyPlayerState | null) => {
          if (cancelled) return;

          if (!state) {
            setPaused(true);
            return;
          }

          const track = state.track_window.current_track;

          if (track) {
            lastKnownTrackRef.current = track;

            // Reset replenishment eligibility when a new
            // track becomes the current track.
            if (
              previousTrackUriRef.current !== track.uri
            ) {
              previousTrackUriRef.current = track.uri;

              replenishedTracksRef.current.delete(track.uri);
            }
          }

          setCurrentTrack(track);
          setPaused(state.paused);
          setDuration(state.duration);

          if (!isSeekingRef.current) {
            setPosition(state.position);
          }

          // Replenish near the end of the current track.
          if (
            track &&
            !state.paused &&
            state.duration > 0 &&
            state.position >= state.duration - 5000
          ) {
            void replenishQueue(track);
          }
        },
      );

      setMessage('Connecting to Spotify device...');

      void player
        .connect()
        .then((success) => {
          if (!cancelled && !success) {
            setMessage(
              'Spotify could not connect. Check your browser and account.',
            );
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Spotify connection failed.',
            );
          }
        });
    };

    if (window.Spotify?.Player) {
      initialize();
    } else {
      let script =
        document.querySelector<HTMLScriptElement>(
          `script[src="${SDK_URL}"]`,
        );

      window.onSpotifyWebPlaybackSDKReady = () => {
        oldReadyCallback?.();
        initialize();
      };

      if (!script) {
        script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;

        script.onerror = () => {
          if (!cancelled) {
            setMessage(
              'Could not load the Spotify SDK.',
            );
          }
        };

        document.body.appendChild(script);
      }

      timeoutId = window.setTimeout(() => {
        if (!cancelled && !playerRef.current) {
          setMessage(
            'Spotify SDK did not initialize. Refresh and try again.',
          );
        }
      }, 15000);
    }

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      if (playerRef.current === player) {
        playerRef.current = null;
      }

      player?.disconnect();

      deviceIdRef.current = null;
      onDeviceReadyRef.current?.(null);
    };

    // The player instance is created once per token session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // --------------------------------------------------
  // POLL CURRENT PLAYBACK POSITION
  // --------------------------------------------------

  useEffect(() => {
    if (!ready || paused || !playerRef.current) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const state =
          await playerRef.current?.getCurrentState();

        if (!cancelled && state) {
          const track = state.track_window.current_track;

          if (track) {
            lastKnownTrackRef.current = track;
          }

          setCurrentTrack(track);
          setPaused(state.paused);
          setDuration(state.duration);

          if (!isSeekingRef.current) {
            setPosition(state.position);
          }
        }
      } catch {
        // Retry on the next poll.
      }

      if (!cancelled) {
        timer = window.setTimeout(poll, 1000);
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [ready, paused]);

  // --------------------------------------------------
  // PLAY A SELECTED SPOTIFY TRACK
  // --------------------------------------------------

  useEffect(() => {
    if (
      !trackUri ||
      !ready ||
      !deviceIdRef.current ||
      !accessToken ||
      previousTrackUriRef.current === trackUri
    ) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const player = playerRef.current;
        const deviceId = deviceIdRef.current;

        if (!player || !deviceId) {
          throw new Error(
            'Spotify device is not ready.',
          );
        }

        await player.activateElement();

        const response = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uris: [trackUri],
            }),
          },
        );

        if (!response.ok) {
          const body = await response.text();

          throw new Error(
            `Could not play track (${response.status}): ${body}`,
          );
        }

        if (cancelled) return;

        previousTrackUriRef.current = trackUri;

        // Allow the selected track to trigger replenishment.
        if (trackUri) {
  replenishedTracksRef.current.delete(trackUri);
}

        setMessage('Playing selected song.');

        void refreshQueue();
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load selected song.',
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    trackUri,
    accessToken,
    refreshQueue,
  ]);

  // --------------------------------------------------
  // PLAYER CONTROLS
  // --------------------------------------------------

  async function togglePlayback() {
    const player = playerRef.current;

    if (!player) {
      setMessage('Spotify player is not ready yet.');
      return;
    }

    try {
      await player.activateElement();
      await player.togglePlay();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not change playback.',
      );
    }
  }

  async function previousTrack() {
    const player = playerRef.current;

    if (!player || !ready) {
      setMessage('Spotify player is not ready yet.');
      return;
    }

    try {
      await player.previousTrack();

      setMessage('Playing previous track.');

      window.setTimeout(
        () => void refreshQueue(),
        700,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not play previous track.',
      );
    }
  }

  async function nextTrack() {
    const player = playerRef.current;

    const current =
      currentTrack ?? lastKnownTrackRef.current;

    if (!player || !ready) {
      setMessage('Spotify player is not ready yet.');
      return;
    }

    try {
      setMessage('Checking Spotify queue...');

      const nativeQueue = filterUpcomingTracks(
  await getSpotifyQueue(),
  currentTrack?.uri ??
    lastKnownTrackRef.current?.uri ??
    null,
);

setQueue(nativeQueue);

      if (nativeQueue.length > 0) {
        await player.nextTrack();

        setMessage('Skipping to next queued song.');
      } else if (current) {
        await playSimilar(current);
      } else {
        await player.nextTrack();

        setMessage('Skipped to next track.');
      }

      window.setTimeout(
        () => void refreshQueue(),
        900,
      );
    } catch (error) {
      try {
        await player.nextTrack();

        setMessage(
          'Skipped using Spotify player controls.',
        );
      } catch (fallbackError) {
        setMessage(
          fallbackError instanceof Error
            ? fallbackError.message
            : error instanceof Error
              ? error.message
              : 'Could not play next track.',
        );
      }
    }
  }

  async function changeVolume(value: number) {
    const nextVolume = Math.max(
      0,
      Math.min(100, value),
    );

    setVolume(nextVolume);
    volumeRef.current = nextVolume;

    try {
      await playerRef.current?.setVolume(
        nextVolume / 100,
      );
    } catch {
      setMessage('Could not change volume.');
    }
  }

  async function seekTo(value: number) {
    const nextPosition = Math.max(
      0,
      Math.min(duration, value),
    );

    isSeekingRef.current = true;
    setPosition(nextPosition);

    try {
      await playerRef.current?.seek(nextPosition);
    } catch {
      setMessage('Could not seek within this track.');
    } finally {
      isSeekingRef.current = false;
    }
  }

  function time(ms: number): string {
    const total = Math.floor(Math.max(0, ms) / 1000);

    return `${Math.floor(total / 60)}:${String(
      total % 60,
    ).padStart(2, '0')}`;
  }

  // --------------------------------------------------
  // PLAYER UI
  // --------------------------------------------------

  return (
    <section className="spotify-web-player">
      <div className="spotify-player-heading">
        <div>
          <span className="spotify-player-label">
            STUDYSPARK MUSIC
          </span>

          <h3>Spotify Player</h3>
        </div>

        <span
          className={`spotify-status ${
            ready ? 'ready' : ''
          }`}
        >
          {ready ? 'Connected' : 'Connecting'}
        </span>
      </div>

      <div className="spotify-current-track">
        {currentTrack?.album?.images?.[0]?.url ? (
          <img
            className="spotify-track-cover"
            src={currentTrack.album.images[0].url}
            alt={`${currentTrack.name} album cover`}
          />
        ) : (
          <div
            className="spotify-track-cover spotify-cover-placeholder"
            aria-hidden="true"
          >
            ♪
          </div>
        )}

        <div className="spotify-track-details">
          <strong title={currentTrack?.name ?? undefined}>
            {currentTrack?.name ?? 'Choose a song'}
          </strong>

          <span>
            {currentTrack?.artists
              ?.map((artist) => artist.name)
              .join(', ') ??
              'Select a Spotify track to begin'}
          </span>

          {currentTrack && (
            <span className="spotify-playing-indicator">
              {paused ? 'Paused' : 'Now playing'}
            </span>
          )}
        </div>
      </div>

      <div className="spotify-progress">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={1000}
          value={Math.min(position, duration || 0)}
          onChange={(event) => {
            isSeekingRef.current = true;
            setPosition(Number(event.target.value));
          }}
          onPointerUp={(event) =>
            void seekTo(Number(event.currentTarget.value))
          }
          onKeyUp={(event) => {
            if (
              event.key.startsWith('Arrow') ||
              event.key === 'Home' ||
              event.key === 'End'
            ) {
              void seekTo(Number(event.currentTarget.value));
            }
          }}
          onBlur={(event) => {
            if (isSeekingRef.current) {
              void seekTo(Number(event.currentTarget.value));
            }
          }}
          disabled={!ready || duration === 0}
          aria-label="Track progress"
        />

        <div className="spotify-time">
          <span>{time(position)}</span>
          <span>{time(duration)}</span>
        </div>
      </div>

      <div className="spotify-main-controls">
        <button
          type="button"
          onClick={() => void previousTrack()}
          disabled={!ready}
          aria-label="Previous track"
        >
          |◀
        </button>

        <button
          type="button"
          className="spotify-play-button"
          onClick={() => void togglePlayback()}
          disabled={!ready}
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? '▶' : 'Ⅱ'}
        </button>

        <button
          type="button"
          onClick={() => void nextTrack()}
          disabled={!ready}
          aria-label="Next track"
        >
          ▶|
        </button>
      </div>

      <div className="spotify-volume-control">
        <span aria-hidden="true">
          {volume === 0
            ? '🔇'
            : volume < 50
              ? '🔉'
              : '🔊'}
        </span>

        <label htmlFor="spotify-volume">
          Volume
        </label>

        <input
          id="spotify-volume"
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(event) =>
            void changeVolume(Number(event.target.value))
          }
          disabled={!ready}
        />

        <span className="spotify-volume-value">
          {volume}%
        </span>
      </div>

      <div className="spotify-queue-heading">
        <strong>Up next ({queue.length})</strong>

        <button
          type="button"
          onClick={() =>
            setShowQueue((value) => !value)
          }
        >
          {showQueue ? 'Hide queue' : 'View queue'}
        </button>

        <button
          type="button"
          onClick={() => void refreshQueue()}
          disabled={queueLoading}
        >
          {queueLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {showQueue && (
        <div className="spotify-queue-list">
          {queueLoading && queue.length === 0 ? (
            <p>Loading queue…</p>
          ) : queue.length > 0 ? (
            queue.map((track) => (
              <div
                className="spotify-queue-item"
                key={track.uri}
              >
                {track.album?.images?.[0]?.url && (
                  <img
                    src={track.album.images[0].url}
                    alt={`${track.name} album cover`}
                  />
                )}

                <div>
                  <strong>{track.name}</strong>

                  <span>
                    {track.artists
                      ?.map((artist) => artist.name)
                      .join(', ')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p>
              Your Spotify queue is empty. Add a song using
              + Queue.
            </p>
          )}
        </div>
      )}

      <p className="spotify-player-message" role="status">
        {message}
      </p>
    </section>
  );
}
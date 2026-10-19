import { useEffect, useRef, useState } from 'react';
import './SpotifyWebPlayback.css';

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
        getOAuthToken: (callback: (token: string) => void) => void;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface Props {
  accessToken: string;
  trackUri?: string;
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export default function SpotifyWebPlayback({
  accessToken,
  trackUri,
}: Props) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef = useRef(accessToken);
  const deviceIdRef = useRef<string | null>(null);
  const requestNumberRef = useRef(0);
  const previousTrackUriRef = useRef<string | null | undefined>(null);
  const isSeekingRef = useRef(false);

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

  // Keep the most recent token available to the SDK.
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  // Initialize Spotify once per access-token session.
  // Track changes do not recreate the player.
  useEffect(() => {
    let cancelled = false;
    let player: SpotifyPlayer | null = null;
    let timeoutId: number | undefined;

    if (!accessToken) {
      setReady(false);
      setMessage('Spotify token missing. Please reconnect.');
      return;
    }

    setReady(false);
    setMessage('Loading Spotify Web Playback SDK...');

    const previousCallback =
      window.onSpotifyWebPlaybackSDKReady;

    const initializePlayer = () => {
      if (cancelled || !window.Spotify?.Player || player) {
        return;
      }

      player = new window.Spotify.Player({
        name: 'StudySpark Music',
        volume: volume / 100,
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
          setReady(true);
          setMessage('Spotify player ready.');
        },
      );

      player.addListener(
        'not_ready',
        (data: { device_id: string }) => {
          if (cancelled) return;

          if (deviceIdRef.current === data.device_id) {
            deviceIdRef.current = null;
          }

          setReady(false);
          setMessage(
            'Spotify playback device went offline. Waiting for reconnection...',
          );
        },
      );

      player.addListener(
        'initialization_error',
        (data: { message: string }) => {
          if (!cancelled) {
            setMessage(
              `Player initialization error: ${data.message}`,
            );
          }
        },
      );

      player.addListener(
        'authentication_error',
        (data: { message: string }) => {
          if (!cancelled) {
            setMessage(
              `Spotify authentication error: ${data.message}`,
            );
          }
        },
      );

      player.addListener(
        'account_error',
        (data: { message: string }) => {
          if (!cancelled) {
            setMessage(
              `Spotify account error: ${data.message}`,
            );
          }
        },
      );

      player.addListener(
        'playback_error',
        (data: { message: string }) => {
          if (!cancelled) {
            setMessage(`Playback error: ${data.message}`);
          }
        },
      );

      player.addListener('autoplay_failed', () => {
        if (!cancelled) {
          setMessage(
            'Playback was blocked. Press Play to continue.',
          );
        }
      });

      // Spotify sends updates when playback state changes.
      // The timer effect below fills in the seconds between updates.
      player.addListener(
        'player_state_changed',
        (state: SpotifyPlayerState | null) => {
          if (cancelled) return;

          if (!state) {
            setPaused(true);
            setPosition(0);
            setDuration(0);
            setCurrentTrack(null);
            return;
          }

          setPaused(state.paused);
          setDuration(state.duration);
          setCurrentTrack(state.track_window.current_track);

          if (!isSeekingRef.current) {
            setPosition(state.position);
          }
        },
      );

      setMessage('Connecting to Spotify device...');

      void player
        .connect()
        .then((success) => {
          if (cancelled) return;

          if (!success) {
            setMessage(
              'Spotify could not connect. Check your account and browser.',
            );
          }
        })
        .catch((error: unknown) => {
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
      initializePlayer();
    } else {
      const script = document.querySelector<HTMLScriptElement>(
        `script[src="${SDK_URL}"]`,
      );

      window.onSpotifyWebPlaybackSDKReady = () => {
        previousCallback?.();
        initializePlayer();
      };

      if (!script) {
        const newScript = document.createElement('script');
        newScript.src = SDK_URL;
        newScript.async = true;

        newScript.onerror = () => {
          if (!cancelled) {
            setMessage('Could not load the Spotify SDK.');
          }
        };

        document.body.appendChild(newScript);
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

      // Invalidate playback requests still in progress.
      requestNumberRef.current += 1;

      if (playerRef.current === player) {
        playerRef.current = null;
      }

      player?.disconnect();
      deviceIdRef.current = null;

      if (
        window.onSpotifyWebPlaybackSDKReady &&
        window.onSpotifyWebPlaybackSDKReady !== previousCallback
      ) {
        window.onSpotifyWebPlaybackSDKReady = previousCallback;
      }
    };

    // Intentionally initialize only for the access-token session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Keep the displayed timer synchronized with Spotify's actual
  // playback position. Spotify's state-change event is not a
  // once-per-second timer, so poll the current state while playing.
  useEffect(() => {
    if (!ready || paused || !playerRef.current) {
      return;
    }

    let cancelled = false;
    let timerId: number | undefined;

    const syncPlaybackPosition = async () => {
      const player = playerRef.current;

      if (!player || cancelled) return;

      try {
        const state = await player.getCurrentState();

        if (cancelled || !state) return;

        setPaused(state.paused);
        setDuration(state.duration);
        setCurrentTrack(state.track_window.current_track);

        if (!isSeekingRef.current) {
          setPosition(state.position);
        }
      } catch {
        // Ignore a temporary state-read failure.
        // The next tick or Spotify event can restore synchronization.
      }

      if (!cancelled) {
        timerId = window.setTimeout(
          syncPlaybackPosition,
          1000,
        );
      }
    };

    void syncPlaybackPosition();

    return () => {
      cancelled = true;

      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [ready, paused]);

  // Load the selected track on the existing player.
  useEffect(() => {
    if (!trackUri || !ready || !deviceIdRef.current || !accessToken) {
      return;
    }

    if (previousTrackUriRef.current === trackUri) {
      return;
    }

    const requestNumber = ++requestNumberRef.current;
    let cancelled = false;

    async function loadTrack() {
      try {
        const player = playerRef.current;
        const deviceId = deviceIdRef.current;

        if (!player || !deviceId) {
          throw new Error('Spotify device is not ready.');
        }

        setMessage('Loading selected song...');

        await player.activateElement();

        if (
          cancelled ||
          requestNumber !== requestNumberRef.current
        ) {
          return;
        }

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
          const errorText = await response.text();

          throw new Error(
            `Could not play track (${response.status}): ${errorText}`,
          );
        }

        if (
          cancelled ||
          requestNumber !== requestNumberRef.current
        ) {
          return;
        }

        previousTrackUriRef.current = trackUri;
        setMessage('Track sent to Spotify player.');
      } catch (error) {
        if (
          !cancelled &&
          requestNumber === requestNumberRef.current
        ) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load the selected song.',
          );
        }
      }
    }

    void loadTrack();

    return () => {
      cancelled = true;
    };
  }, [ready, trackUri, accessToken]);

  async function changeVolume(value: number) {
    const nextValue = Math.max(0, Math.min(100, value));

    setVolume(nextValue);

    try {
      await playerRef.current?.setVolume(nextValue / 100);
    } catch {
      setMessage('Could not change volume.');
    }
  }

  async function togglePlayback() {
    const player = playerRef.current;

    if (!player || !currentTrack) {
      setMessage('Select a song and wait for it to load first.');
      return;
    }

    try {
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

    if (!player || !currentTrack) return;

    try {
      await player.previousTrack();
    } catch {
      setMessage('Could not play the previous track.');
    }
  }

  async function nextTrack() {
    const player = playerRef.current;

    if (!player || !currentTrack) return;

    try {
      await player.nextTrack();
    } catch {
      setMessage('Could not play the next track.');
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

  function formatTime(milliseconds: number) {
    const safeMilliseconds = Math.max(
      0,
      Number.isFinite(milliseconds) ? milliseconds : 0,
    );

    const seconds = Math.floor(safeMilliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

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
          className={`spotify-status ${ready ? 'ready' : ''}`}
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
              .join(', ') ?? 'Select a Spotify track to begin'}
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
          onPointerUp={(event) => {
            void seekTo(Number(event.currentTarget.value));
          }}
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
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="spotify-main-controls">
        <button
          type="button"
          onClick={() => void previousTrack()}
          disabled={!ready || !currentTrack}
          aria-label="Previous track"
        >
          |◀
        </button>

        <button
          type="button"
          className="spotify-play-button"
          onClick={() => void togglePlayback()}
          disabled={!ready || !currentTrack}
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? '▶' : 'Ⅱ'}
        </button>

        <button
          type="button"
          onClick={() => void nextTrack()}
          disabled={!ready || !currentTrack}
          aria-label="Next track"
        >
          ▶|
        </button>
      </div>

      <div className="spotify-volume-control">
        <span aria-hidden="true">
          {volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
        </span>

        <label htmlFor="spotify-volume">Volume</label>

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

      <p className="spotify-player-message" role="status">
        {message}
      </p>
    </section>
  );
}
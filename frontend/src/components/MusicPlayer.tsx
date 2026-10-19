import { useEffect, useRef, useState } from 'react';
import './MusicPlayer.css';

type SoundCategory = 'Nature' | 'Focus' | 'Ambience';

type GeneratedSound = 'white' | 'pink' | 'brown' | 'wind' | 'drone';

interface AmbientSound {
  id: string;
  title: string;
  description: string;
  category: SoundCategory;
  emoji: string;
  type: 'file' | 'generated';
  audioUrl?: string;
  generatedType?: GeneratedSound;
}

interface ActiveNoise {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const sounds: AmbientSound[] = [
  // REAL AUDIO FILES
  {
    id: 'cafe',
    title: 'Café ambience',
    description: 'Soft background chatter',
    category: 'Ambience',
    emoji: '☕',
    type: 'file',
    audioUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Cafe_ambiance.ogg',
  },
  {
    id: 'rain',
    title: 'Gentle rain',
    description: 'Steady rainfall',
    category: 'Nature',
    emoji: '🌧️',
    type: 'file',
    audioUrl: '/audio/gentle-rain.mp3',
  },
  {
    id: 'ocean',
    title: 'Ocean waves',
    description: 'Relaxing rolling waves',
    category: 'Nature',
    emoji: '🌊',
    type: 'file',
    audioUrl: '/audio/ocean-hush.mp3',
  },
  {
    id: 'forest',
    title: 'Forest ambience',
    description: 'Birds and a peaceful forest',
    category: 'Nature',
    emoji: '🌲',
    type: 'file',
    audioUrl: '/audio/forest-ambience.mp3',
  },
  {
    id: 'fireplace',
    title: 'Cozy fireplace',
    description: 'Gentle crackling fire',
    category: 'Ambience',
    emoji: '🔥',
    type: 'file',
    audioUrl: '/audio/fireplace.mp3',
  },
  {
    id: 'stream',
    title: 'Flowing stream',
    description: 'A gentle flowing-water recording',
    category: 'Nature',
    emoji: '💧',
    type: 'file',
    audioUrl: '/audio/flowing-stream.mp3',
  },
  {
    id: 'birds',
    title: 'Morning birds',
    description: 'Birdsong in the morning',
    category: 'Nature',
    emoji: '🐦',
    type: 'file',
    audioUrl: '/audio/morning-birds.mp3',
  },

  // GENERATED IN THE BROWSER
  {
    id: 'white-noise',
    title: 'White noise',
    description: 'Even, neutral background noise',
    category: 'Focus',
    emoji: '〰️',
    type: 'generated',
    generatedType: 'white',
  },
  {
    id: 'pink-noise',
    title: 'Soft pink noise',
    description: 'A softer noise texture',
    category: 'Focus',
    emoji: '🎧',
    type: 'generated',
    generatedType: 'pink',
  },
  {
    id: 'brown-noise',
    title: 'Brown noise',
    description: 'Deep, low-frequency noise',
    category: 'Focus',
    emoji: '🌀',
    type: 'generated',
    generatedType: 'brown',
  },
  {
    id: 'wind',
    title: 'Gentle wind',
    description: 'Soft, wind-like ambience',
    category: 'Nature',
    emoji: '🍃',
    type: 'generated',
    generatedType: 'wind',
  },
  {
    id: 'deep-focus',
    title: 'Deep focus',
    description: 'A quiet ambient tone',
    category: 'Focus',
    emoji: '🧠',
    type: 'generated',
    generatedType: 'drone',
  },
];

const filters = ['All sounds', 'Nature', 'Focus', 'Ambience'] as const;

type Filter = (typeof filters)[number];

const AudioContextClass =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext
    : undefined;

function createNoise(
  context: AudioContext,
  kind: GeneratedSound,
  volume: number,
): ActiveNoise {
  const bufferLength = Math.floor(context.sampleRate * 4);

  const buffer = context.createBuffer(
    1,
    bufferLength,
    context.sampleRate,
  );

  const data = buffer.getChannelData(0);

  let lastOut = 0;
  let brownOut = 0;

  for (let i = 0; i < bufferLength; i += 1) {
    const white = Math.random() * 2 - 1;

    if (kind === 'white') {
      data[i] = white * 0.25;
    } else if (kind === 'brown') {
      brownOut = (brownOut + 0.02 * white) / 1.02;
      data[i] = brownOut * 4;
    } else {
      // Pink noise approximation.
      lastOut = 0.97 * lastOut + 0.03 * white;
      data[i] = (lastOut + white * 0.25) * 0.5;
    }
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const gain = context.createGain();

  // Keep the sound audible at ordinary volume settings.
  gain.gain.value = volume * 0.7;

  if (kind === 'wind') {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;

    // Slowly vary the filter to create a gentle wind-like effect.
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 250;

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    lfo.start();
    source.start();

    // Stop the wind modulation when the source is stopped.
    source.addEventListener(
      'ended',
      () => {
        lfo.stop();
        lfo.disconnect();
        lfoGain.disconnect();
        filter.disconnect();
      },
      { once: true },
    );

    return { source, gain };
  }

  source.connect(gain);
  gain.connect(context.destination);
  source.start();

  return { source, gain };
}

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<ActiveNoise | null>(null);

  const [selectedSound, setSelectedSound] =
    useState<AmbientSound>(sounds[0]);

  const [activeFilter, setActiveFilter] =
    useState<Filter>('All sounds');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [message, setMessage] = useState('');

  const filteredSounds =
    activeFilter === 'All sounds'
      ? sounds
      : sounds.filter((sound) => sound.category === activeFilter);

  function stopGeneratedSound() {
    const active = noiseRef.current;

    if (!active) return;

    try {
      active.source.stop();
    } catch {
      // It may already have stopped.
    }

    active.source.disconnect();
    active.gain.disconnect();
    noiseRef.current = null;
  }

  function stopCurrentSound() {
    audioRef.current?.pause();
    stopGeneratedSound();
    setIsPlaying(false);
  }

  async function playSound(sound: AmbientSound) {
    const audio = audioRef.current;

    if (!audio) return;

    setMessage('');

    // Clicking the currently playing sound pauses it.
    if (selectedSound.id === sound.id && isPlaying) {
      if (sound.type === 'file') {
        audio.pause();
      } else if (contextRef.current) {
        await contextRef.current.suspend();
      }

      setIsPlaying(false);
      return;
    }

    stopCurrentSound();

    setSelectedSound(sound);
    setCurrentTime(0);
    setDuration(0);

    if (sound.type === 'file') {
      if (!sound.audioUrl) {
        setMessage('This sound does not have an audio file.');
        return;
      }

      try {
        audio.src = sound.audioUrl;
        audio.load();
        audio.volume = volume;

        await audio.play();

        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setMessage(
          `Could not play ${sound.title}. Make sure ${sound.audioUrl} exists in your public folder.`,
        );
      }

      return;
    }

    try {
      if (!AudioContextClass) {
        setMessage('Your browser does not support generated sounds.');
        return;
      }

      if (!contextRef.current) {
        contextRef.current = new AudioContextClass();
      }

      const context = contextRef.current;

      if (context.state === 'suspended') {
        await context.resume();
      }

      if (sound.generatedType === 'drone') {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  // A soft, audible ambient tone.
  oscillator.type = 'sine';
  oscillator.frequency.value = 174;

  gain.gain.value = volume * 0.12;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();

  // Store the oscillator as the source so stopGeneratedSound()
  // can stop it using the same cleanup mechanism.
  noiseRef.current = {
    source: oscillator as unknown as AudioBufferSourceNode,
    gain,
  };
} else {
  noiseRef.current = createNoise(
    context,
    sound.generatedType ?? 'pink',
    volume,
  );
}

setIsPlaying(true);

      setIsPlaying(true);
    } catch {
      stopGeneratedSound();
      setIsPlaying(false);
      setMessage('The generated sound could not start. Please try again.');
    }
  }

  async function togglePlayback() {
    await playSound(selectedSound);
  }

  function playAdjacentSound(direction: -1 | 1) {
    const index = filteredSounds.findIndex(
      (sound) => sound.id === selectedSound.id,
    );

    const nextIndex =
      index === -1
        ? 0
        : (index + direction + filteredSounds.length) %
          filteredSounds.length;

    const nextSound = filteredSounds[nextIndex];

    if (nextSound) {
      void playSound(nextSound);
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current;

    if (
      selectedSound.type !== 'file' ||
      !audio ||
      !Number.isFinite(audio.duration)
    ) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function formatTime(time: number) {
    if (!Number.isFinite(time) || time < 0) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime || 0);

    const updateDuration = () => {
      setDuration(
        Number.isFinite(audio.duration) ? audio.duration : 0,
      );
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsPlaying(false);
      setMessage('The audio file could not be loaded.');
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (noiseRef.current) {
  noiseRef.current.gain.gain.value =
    volume *
    (selectedSound.generatedType === 'drone' ? 0.12 : 0.7);
}
  }, [volume, selectedSound]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();

      try {
        noiseRef.current?.source.stop();
      } catch {
        // Already stopped.
      }

      noiseRef.current = null;

      if (contextRef.current) {
        void contextRef.current.close();
      }
    };
  }, []);

  const isFile = selectedSound.type === 'file';

  return (
    <main className="study-player">
      <audio ref={audioRef} preload="metadata" />

      <header className="study-player__heading">
        <div>
          <p className="study-player__eyebrow">YOUR FOCUS SPACE</p>
          <h2>Study sounds</h2>
          <p className="study-player__description">
            Find your calm. Settle in. Get things done.
          </p>
        </div>

        <div className="study-player__status">
          <span
            className={`study-player__pulse ${
              isPlaying ? 'is-playing' : ''
            }`}
          />
          {isPlaying ? 'Now playing' : 'Ready when you are'}
        </div>
      </header>

      <div className="study-player__layout">
        <div className="study-player__library">
          <nav
            className="study-player__filters"
            aria-label="Sound categories"
          >
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`study-player__filter ${
                  activeFilter === filter ? 'is-active' : ''
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </nav>

          <div className="study-player__tracks">
            {filteredSounds.map((sound) => {
              const selected = selectedSound.id === sound.id;

              return (
                <article
                  key={sound.id}
                  className={`study-track ${
                    selected ? 'is-current' : ''
                  }`}
                >
                  <div
                    className={`study-track__art study-track__art--${sound.id}`}
                  >
                    <span>{sound.emoji}</span>
                  </div>

                  <div className="study-track__text">
                    <span className="study-track__title">
                      {sound.title}
                    </span>
                    <span className="study-track__subtitle">
                      {sound.description}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="study-track__action"
                    onClick={() => void playSound(sound)}
                    aria-label={
                      selected && isPlaying
                        ? `Pause ${sound.title}`
                        : `Play ${sound.title}`
                    }
                    title={
                      selected && isPlaying ? 'Pause sound' : 'Play sound'
                    }
                  >
                    {selected && isPlaying ? 'Ⅱ' : '▶'}
                  </button>
                </article>
              );
            })}
          </div>

          <p className="study-player__note">
            Choose a recording or a browser-generated focus sound.
          </p>
        </div>

        <section className="study-now">
          <div
            className={`study-now__cover study-now__cover--${selectedSound.id}`}
          >
            <div className="study-now__rings" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>

            <span>{selectedSound.emoji}</span>
          </div>

          <p className="study-now__label">NOW SELECTED</p>
          <h3>{selectedSound.title}</h3>
          <p className="study-now__subtitle">
            {selectedSound.description}
          </p>

          <div className="study-now__progress">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) =>
                seekTo(Number(event.target.value))
              }
              style={
                {
                  '--progress': `${
                    duration ? (currentTime / duration) * 100 : 0
                  }%`,
                } as React.CSSProperties
              }
              aria-label="Sound progress"
              disabled={!isFile || !duration}
            />

            <div className="study-now__times">
              <span>{isFile ? formatTime(currentTime) : '∞'}</span>
              <span>
                {isFile ? formatTime(duration) : 'Ambient loop'}
              </span>
            </div>
          </div>

          <div className="study-now__controls">
            <button
              type="button"
              onClick={() => playAdjacentSound(-1)}
              aria-label="Previous sound"
            >
              |◀
            </button>

            <button
              type="button"
              className="study-now__play"
              onClick={() => void togglePlayback()}
              aria-label={isPlaying ? 'Pause sound' : 'Play sound'}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>

            <button
              type="button"
              onClick={() => playAdjacentSound(1)}
              aria-label="Next sound"
            >
              ▶|
            </button>
          </div>

          <div className="study-now__volume">
            <span aria-hidden="true">🔉</span>

            <label className="visually-hidden" htmlFor="study-volume">
              Volume
            </label>

            <input
              id="study-volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) =>
                setVolume(Number(event.target.value))
              }
              style={
                {
                  '--progress': `${volume * 100}%`,
                } as React.CSSProperties
              }
            />

            <span aria-hidden="true">🔊</span>
            <span className="study-now__volume-value">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {message && (
            <p className="study-player__message" role="status">
              {message}
            </p>
          )}

          <p className="study-player__credit">
            {isFile
              ? 'Ambient recording · StudySpark'
              : 'Generated in your browser · StudySpark'}
          </p>
        </section>
      </div>
    </main>
  );
}
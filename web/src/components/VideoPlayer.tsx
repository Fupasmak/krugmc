'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './VideoPlayer.module.css';
import { PixelIcon } from './PixelIcon';

/**
 * Плеер в стиле сайта поверх обычного <video>.
 * Сторонних библиотек нет: нужен только набор простых контролов.
 *
 * Клавиши: пробел и K это пауза, стрелки перемотка и громкость,
 * M это звук, F полный экран.
 */

const RATES = [1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  onSizeKnown,
}: {
  src: string;
  poster?: string | null;
  autoPlay?: boolean;
  /** Размеры файла: нужны, чтобы дозаполнить старые записи в базе */
  onSizeKnown?: (width: number, height: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [panelHidden, setPanelHidden] = useState(false);

  const showPanel = useCallback(() => {
    setPanelHidden(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setPanelHidden(true);
    }, 2500);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
    showPanel();
  }, [showPanel]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
      showPanel();
    },
    [showPanel],
  );

  const changeVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.min(1, Math.max(0, value));
      video.volume = next;
      video.muted = next === 0;
      setVolume(next);
      setMuted(next === 0);
      showPanel();
    },
    [showPanel],
  );

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.requestFullscreen?.();
  }, []);

  // Клавиши работают, когда плеер в фокусе или развёрнут
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const active = wrap.contains(document.activeElement) || document.fullscreenElement === wrap;
      if (!active) return;

      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          event.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          seekBy(5);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          seekBy(-5);
          break;
        case 'ArrowUp':
          event.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case 'm':
        case 'M': {
          const video = videoRef.current;
          if (video) {
            video.muted = !video.muted;
            setMuted(video.muted);
          }
          break;
        }
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle, seekBy, changeVolume, toggleFullscreen, volume]);

  function onSeek(event: React.MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    video.currentTime = ratio * video.duration;
    showPanel();
  }

  function cycleRate() {
    const video = videoRef.current;
    if (!video) return;
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    video.playbackRate = next;
    setRate(next);
    showPanel();
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      className={styles.player}
      ref={wrapRef}
      tabIndex={0}
      onMouseMove={showPanel}
      onTouchStart={showPanel}
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        poster={poster ?? undefined}
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          showPanel();
        }}
        onPause={() => {
          setPlaying(false);
          setPanelHidden(false);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onProgress={(event) => {
          const video = event.currentTarget;
          if (video.buffered.length > 0) {
            setBuffered(video.buffered.end(video.buffered.length - 1));
          }
        }}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration);
          setVolume(video.volume);
          setMuted(video.muted);
          if (video.videoWidth && video.videoHeight) {
            onSizeKnown?.(video.videoWidth, video.videoHeight);
          }
        }}
      />

      {!playing && (
        <button type="button" className={styles.bigPlay} onClick={toggle} aria-label="Смотреть">
          <span className={styles.bigPlayInner}>
            <PixelIcon name="play" size={22} />
          </span>
        </button>
      )}

      <div className={`${styles.panel} ${panelHidden ? styles.panelHidden : ''}`}>
        <div className={styles.track} onClick={onSeek} role="presentation">
          <div className={styles.trackLine}>
            <span className={styles.buffer} style={{ width: `${bufferPercent}%` }} />
            <span className={styles.progress} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.knob} style={{ left: `${progress}%` }} />
        </div>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={toggle}
            aria-label={playing ? 'Пауза' : 'Играть'}
          >
            <PixelIcon name={playing ? 'pause' : 'play'} size={14} />
          </button>

          <span className={styles.time}>
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <span className={styles.spacer} />

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.muted = !video.muted;
              setMuted(video.muted);
            }}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          >
            <PixelIcon name={muted || volume === 0 ? 'mute' : 'sound'} size={14} />
          </button>

          <input
            className={styles.volume}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            aria-label="Громкость"
          />

          <button type="button" className={styles.rate} onClick={cycleRate} aria-label="Скорость">
            {rate}x
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={toggleFullscreen}
            aria-label="Во весь экран"
          >
            <PixelIcon name="expand" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

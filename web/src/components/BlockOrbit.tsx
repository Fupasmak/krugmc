'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from './BlockOrbit.module.css';
import { Logo } from './Logo';

/**
 * Круг из 3D-блоков для hero: квадраты, выстроенные в круг.
 *
 * Слои разнесены: орбита крутит строй, обратное вращение держит блоки
 * ровно, дрейф качает каждый блок вокруг своей точки. Скрипт нужен
 * только бедроку, который отвечает на клик.
 */

type Block = {
  src: string;
  alt: string;
  /** цвет свечения под блок */
  glow: string;
  /** доля общей амплитуды дрейфа по горизонтали и вертикали */
  driftX: number;
  driftY: number;
  driftDuration: number;
  /** сдвиг фазы, чтобы блоки не качались синхронно */
  driftPhase: number;
  speaks?: boolean;
};

const BLOCKS: Block[] = [
  {
    src: '/blocks/3d/moss.png',
    alt: 'Блок мха',
    glow: 'rgba(124, 255, 90, 0.4)',
    driftX: 0.9,
    driftY: 0.5,
    driftDuration: 6.4,
    driftPhase: 0.0,
  },
  {
    src: '/blocks/3d/diamond_ore.png',
    alt: 'Алмазная руда',
    glow: 'rgba(122, 226, 240, 0.4)',
    driftX: 0.6,
    driftY: 0.8,
    driftDuration: 7.6,
    driftPhase: 1.5,
  },
  {
    src: '/blocks/3d/oak_log.png',
    alt: 'Дубовое бревно',
    glow: 'rgba(196, 148, 86, 0.35)',
    driftX: 1.0,
    driftY: 0.4,
    driftDuration: 5.4,
    driftPhase: 3.1,
  },
  {
    src: '/blocks/3d/command_block.png',
    alt: 'Командный блок',
    glow: 'rgba(233, 150, 86, 0.38)',
    driftX: 0.5,
    driftY: 0.7,
    driftDuration: 8.0,
    driftPhase: 4.4,
  },
  {
    src: '/blocks/3d/deepslate_diamond_ore.png',
    alt: 'Алмазная руда в глубинном сланце',
    glow: 'rgba(122, 226, 240, 0.3)',
    driftX: 0.8,
    driftY: 0.9,
    driftDuration: 6.0,
    driftPhase: 2.2,
  },
  {
    src: '/blocks/3d/oak_leaves.png',
    alt: 'Дубовая листва',
    glow: 'rgba(110, 200, 80, 0.38)',
    driftX: 1.0,
    driftY: 0.6,
    driftDuration: 7.0,
    driftPhase: 5.3,
  },
  {
    src: '/blocks/3d/slime.png',
    alt: 'Блок слизи',
    glow: 'rgba(140, 230, 120, 0.42)',
    driftX: 0.7,
    driftY: 1.0,
    driftDuration: 5.8,
    driftPhase: 0.9,
  },
  {
    src: '/blocks/3d/bedrock.png',
    alt: 'Коренная порода',
    glow: 'rgba(150, 150, 160, 0.35)',
    driftX: 0.6,
    driftY: 0.5,
    driftDuration: 7.4,
    driftPhase: 3.8,
    speaks: true,
  },
];

const BUBBLE_MS = 3600;

export function BlockOrbit({ duration = 48, phrase }: { duration?: number; phrase: string }) {
  const [saying, setSaying] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function speak(text: string) {
    if (timer.current) window.clearTimeout(timer.current);

    if (saying) {
      setSaying(null);
      return;
    }

    setSaying(text);
    setJumping(true);
    window.setTimeout(() => setJumping(false), 650);
    timer.current = window.setTimeout(() => setSaying(null), BUBBLE_MS);
  }

  return (
    <div
      className={styles.stage}
      style={{ '--orbit-duration': `${duration}s` } as React.CSSProperties}
    >
      <span className={styles.glow} aria-hidden="true" />

      <div className={styles.ring} aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            className={styles.dot}
            style={
              {
                '--angle': `${(360 / 28) * index}deg`,
                '--dot-delay': `${(index % 7) * 0.42}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.orbit}>
        {BLOCKS.map((block, index) => {
          const popStyle = {
            '--pop-delay': `${index * 0.09}s`,
            '--glow-duration': `${8 + index}s`,
            '--glow-delay': `${index * 0.6}s`,
          } as React.CSSProperties;

          const image = (
            <Image
              className={styles.block}
              src={block.src}
              alt={block.alt}
              width={84}
              height={84}
              sizes="84px"
              priority={index < 4}
              style={{ '--block-glow': block.glow } as React.CSSProperties}
            />
          );

          return (
            <div
              key={block.src}
              className={styles.slot}
              style={
                {
                  '--angle': `${(360 / BLOCKS.length) * index}deg`,
                } as React.CSSProperties
              }
            >
              <div className={styles.counter}>
                <div className={styles.level}>
                  <div
                    className={styles.drift}
                    style={
                      {
                        '--drift-x': block.driftX,
                        '--drift-y': block.driftY,
                        '--drift-duration': `${block.driftDuration}s`,
                        '--drift-delay': `-${block.driftPhase}s`,
                      } as React.CSSProperties
                    }
                  >
                    <div className={styles.appear} style={popStyle}>
                      <div
                        className={`${styles.press} ${
                          block.speaks && jumping ? styles.jumping : ''
                        }`}
                      >
                        {block.speaks ? (
                          <button
                            type="button"
                            className={`${styles.hit} ${styles.clickable}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => speak(phrase)}
                            aria-label="Спросить у коренной породы"
                          >
                            {image}
                            {saying && <span className={styles.bubble}>{saying}</span>}
                          </button>
                        ) : (
                          <div className={styles.hit}>{image}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.center}>
        <Logo className={styles.centerLogo} size={64} />
      </div>
    </div>
  );
}

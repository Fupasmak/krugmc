import styles from './FloatingBlocks.module.css';

type BlockSpec = {
  texture: string;
  size: number;
  left: string;
  top: string;
  delay: number;
  duration: number;
  opacity: number;
};

/**
 * Фоновая композиция из левитирующих кубов.
 * Текстуры: свои, из public/textures (сгенерированы scripts/generate-assets.mjs).
 */
const DEFAULT_BLOCKS: BlockSpec[] = [
  { texture: 'emerald.png', size: 72, left: '3%', top: '5%', delay: 0, duration: 9, opacity: 0.6 },
  { texture: 'moss.webp', size: 44, left: '17%', top: '29%', delay: 1.4, duration: 11, opacity: 0.4 },
  { texture: 'deepslate_iron_ore.png', size: 96, left: '79%', top: '9%', delay: 0.8, duration: 12, opacity: 0.45 },
  { texture: 'mossy_cobblestone.png', size: 56, left: '88%', top: '45%', delay: 2.2, duration: 10, opacity: 0.35 },
  { texture: 'sand.png', size: 38, left: '69%', top: '71%', delay: 1.1, duration: 13, opacity: 0.3 },
  { texture: 'tnt.png', size: 48, left: '7%', top: '77%', delay: 2.8, duration: 10.5, opacity: 0.28 },
  { texture: 'diamond.png', size: 34, left: '40%', top: '87%', delay: 0.4, duration: 12.5, opacity: 0.3 },
  { texture: 'warped_wart.png', size: 64, left: '53%', top: '17%', delay: 3.2, duration: 14, opacity: 0.22 },
];

function Cube({ texture, size }: { texture: string; size: number }) {
  const half = size / 2;
  const image = `url(/blocks/${texture})`;

  return (
    <div className={styles.cube} style={{ width: size, height: size }}>
      <span
        className={`${styles.face} ${styles.top}`}
        style={{
          backgroundImage: image,
          transform: `rotateX(90deg) translateZ(${half}px)`,
        }}
      />
      <span
        className={`${styles.face} ${styles.left}`}
        style={{
          backgroundImage: image,
          transform: `rotateY(-90deg) translateZ(${half}px)`,
        }}
      />
      <span
        className={`${styles.face} ${styles.right}`}
        style={{ backgroundImage: image, transform: `translateZ(${half}px)` }}
      />
    </div>
  );
}

export function FloatingBlocks({ blocks = DEFAULT_BLOCKS }: { blocks?: BlockSpec[] }) {
  return (
    <div className={styles.layer} aria-hidden="true">
      {blocks.map((block, index) => (
        <div
          key={`${block.texture}-${index}`}
          className={styles.block}
          style={{
            left: block.left,
            top: block.top,
            opacity: block.opacity,
            animationDelay: `${block.delay}s`,
            animationDuration: `${block.duration}s`,
            perspective: 600,
          }}
        >
          <Cube texture={block.texture} size={block.size} />
        </div>
      ))}
    </div>
  );
}

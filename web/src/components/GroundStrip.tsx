import styles from './GroundStrip.module.css';

/** Полоса земли под hero: текстура земли со слоем мха сверху. */
export function GroundStrip() {
  return (
    <div className={styles.strip} aria-hidden="true">
      <span className={styles.top} />
      <span className={styles.fade} />
    </div>
  );
}

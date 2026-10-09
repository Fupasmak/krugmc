import styles from './StatusPanel.module.css';

/**
 * Статус проекта. Раньше здесь была капсула со светящейся точкой, теперь
 * это окно в духе игрового интерфейса: подпись, состояние и пояснение.
 * Курсор после состояния мигает, как в терминале, и замирает при
 * включённой настройке уменьшения движения.
 */
export function StatusPanel({
  status,
  note,
  label = 'Статус проекта',
  wide = false,
}: {
  status: string;
  note?: string;
  label?: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.panel} ${wide ? styles.wide : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {status}
        <span className="caret" aria-hidden="true" />
      </span>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

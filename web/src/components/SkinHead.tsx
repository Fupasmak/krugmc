/**
 * Квадратная голова скина: лицо + второй слой, вырезанные сервером.
 * Масштаб пиксельный, сглаживания нет.
 */
export function SkinHead({
  name,
  size = 32,
  title,
  className,
}: {
  /** ник или uuid игрока */
  name: string | null | undefined;
  size?: number;
  title?: string;
  className?: string;
}) {
  const source = `/api/head/${encodeURIComponent(name ?? 'default')}.png?size=${size >= 64 ? 128 : 64}`;

  return (
    <img
      src={source}
      width={size}
      height={size}
      alt={title ?? (name ? `Голова скина ${name}` : 'Голова скина')}
      title={title}
      className={`pixelated ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        border: '2px solid var(--edge-dark)',
        boxShadow: 'inset 2px 2px 0 0 rgba(255,255,255,0.15)',
        background: 'var(--surface-sunken)',
        flexShrink: 0,
      }}
      loading="lazy"
      decoding="async"
    />
  );
}

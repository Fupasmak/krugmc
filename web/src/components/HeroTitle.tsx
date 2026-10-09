import styles from './HeroTitle.module.css';
import { stripMarkup } from '@/lib/markup';

/**
 * Заголовок первого экрана. Буквы проявляются по очереди, будто их
 * набирают в терминале, в конце остаётся мигающий курсор.
 * Текст берётся из настроек: перенос строки делит строки,
 * *звёздочки* красят слово в зелёный.
 */

const STEP_MS = 26;

type Part = { text: string; accent: boolean };

function parseLine(line: string): Part[] {
  const parts: Part[] = [];
  const regex = /\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index), accent: false });
    parts.push({ text: match[1], accent: true });
    last = match.index + match[0].length;
  }

  if (last < line.length) parts.push({ text: line.slice(last), accent: false });
  return parts;
}

export function HeroTitle({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  let index = 0;

  const rendered = lines.map((line, lineIndex) => {
    const isLast = lineIndex === lines.length - 1;

    const content = parseLine(line).map((part, partIndex) => (
      <span key={partIndex} className={part.accent ? styles.accentWord : undefined}>
        {part.text.split(/(\s+)/).filter(Boolean).map((chunk, chunkIndex) => {
          const letters = [...chunk].map((char, charIndex) => {
            const delay = index * STEP_MS;
            index += 1;
            return (
              <span
                key={charIndex}
                className={styles.char}
                style={{ '--char-delay': `${delay}ms` } as React.CSSProperties}
              >
                {char}
              </span>
            );
          });

          return /^\s+$/.test(chunk) ? (
            letters
          ) : (
            <span key={chunkIndex} className={styles.word}>
              {letters}
            </span>
          );
        })}
      </span>
    ));

    return (
      <span className={styles.line} key={lineIndex}>
        {content}
        {isLast && (
          <span
            className={styles.caret}
            style={{ '--caret-delay': `${index * STEP_MS}ms` } as React.CSSProperties}
          />
        )}
      </span>
    );
  });

  return (
    <h1 className={styles.title}>
      <span className="visually-hidden">{stripMarkup(text)}</span>
      <span aria-hidden="true">{rendered}</span>
    </h1>
  );
}

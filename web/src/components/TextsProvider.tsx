'use client';

import { createContext, useCallback, useContext } from 'react';
import { defaultTexts, fillText, type SiteTexts } from '@/lib/site-texts';
import { renderMarkup } from '@/lib/markup';

const TextsContext = createContext<SiteTexts>(defaultTexts());

export function TextsProvider({ texts, children }: { texts: SiteTexts; children: React.ReactNode }) {
  return <TextsContext.Provider value={texts}>{children}</TextsContext.Provider>;
}

/** Текст из настроек для клиентских компонентов: t('ключ', { имя: значение }). */
export function useTexts() {
  const texts = useContext(TextsContext);
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = texts[key] ?? key;
      return vars ? fillText(value, vars) : value;
    },
    [texts],
  );
}

/** Текст с мини-разметкой для клиентских компонентов. */
export function TextMarkup({
  value,
  as: Tag = 'span',
  className,
}: {
  value: string;
  as?: 'span' | 'p' | 'div';
  className?: string;
}) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMarkup(value) }} />;
}

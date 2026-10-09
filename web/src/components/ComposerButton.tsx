'use client';

import { BlockButton } from './BlockButton';
import { useTexts } from './TextsProvider';
import { PixelIcon } from './PixelIcon';

/** Кнопка «добавить завоз». Одна из немногих блочных кнопок сайта. */
export function ComposerButton() {
  const t = useTexts();
  return (
    <BlockButton
      href="/posts/new"
      variant="gold"
      square
      title={t('nav.newPost')}
      aria-label={t('nav.newPost')}
    >
      <PixelIcon name="plus" size={16} />
    </BlockButton>
  );
}

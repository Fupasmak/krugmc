/**
 * Разбор ссылок на видео. Поддерживаются YouTube (основной вариант) и VK.
 * Ничего не грузим со сторонних сайтов на этапе рендера: только строим
 * адрес для iframe и обложку.
 */

export type VideoEmbed = {
  provider: 'youtube' | 'vk' | 'unknown';
  id: string | null;
  embedUrl: string | null;
  thumbnail: string | null;
  url: string;
};

export function parseVideoUrl(raw: string): VideoEmbed {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { provider: 'unknown', id: null, embedUrl: null, thumbnail: null, url: raw };
  }

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return youtube(id, raw);
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return youtube(url.searchParams.get('v') ?? '', raw);
    const shorts = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
    if (shorts) return youtube(shorts[1], raw);
  }

  if (host === 'vk.com' || host === 'vkvideo.ru') {
    const match = url.pathname.match(/video(-?\d+)_(\d+)/) ?? [];
    const oid = match[1] ?? url.searchParams.get('oid');
    const vid = match[2] ?? url.searchParams.get('id');
    if (oid && vid) {
      return {
        provider: 'vk',
        id: `${oid}_${vid}`,
        embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2`,
        thumbnail: null,
        url: raw,
      };
    }
  }

  return { provider: 'unknown', id: null, embedUrl: null, thumbnail: null, url: raw };
}

function youtube(id: string, raw: string): VideoEmbed {
  if (!/^[\w-]{6,20}$/.test(id)) {
    return { provider: 'unknown', id: null, embedUrl: null, thumbnail: null, url: raw };
  }
  return {
    provider: 'youtube',
    id,
    // nocookie-домен: не ставит рекламные куки до клика по плееру
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: raw,
  };
}

export function isSupportedVideoUrl(raw: string): boolean {
  return parseVideoUrl(raw).provider !== 'unknown';
}

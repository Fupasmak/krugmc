import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Onest, Press_Start_2P } from 'next/font/google';
import '@/styles/global.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { publicEnv } from '@/lib/env';
import { getTexts } from '@/server/texts';
import { TextsProvider } from '@/components/TextsProvider';

// Пиксельный шрифт заголовков и кнопок, файл лежит в public/fonts.
const pixel = localFont({
  src: '../../public/fonts/minecraft-rus.ttf',
  variable: '--font-krug-pixel',
  display: 'swap',
  fallback: ['Courier New', 'monospace'],
});

// Основной текст: длинные абзацы пиксельным шрифтом не набираем.
const body = Onest({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-krug-body',
  display: 'swap',
});

// Аркадный шрифт для коротких служебных подписей: кикеры, бейджи, счётчики.
const arcade = Press_Start_2P({
  subsets: ['cyrillic', 'latin'],
  weight: '400',
  variable: '--font-krug-arcade',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  const title = texts['site.title'];
  const description = texts['site.description'];

  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: title, template: '%s · KRUG' },
    description,
    applicationName: 'KRUG',
    openGraph: {
      type: 'website',
      siteName: 'KRUG',
      locale: 'ru_RU',
      title,
      description,
      url: publicEnv.siteUrl,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'KRUG' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
    icons: {
      icon: [
        { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon.png', sizes: '64x64', type: 'image/png' },
        { url: '/logo.svg', type: 'image/svg+xml' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b0f0c',
  colorScheme: 'dark',
};

const CLIENT_TEXT_PREFIXES = [
  'login.',
  'me.channel.',
  'me.logout',
  'nav.',
  'post.',
  'postForm.',
  'tag.',
  'votes.',
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const texts = await getTexts();
  const clientTexts = Object.fromEntries(
    Object.entries(texts).filter(([key]) =>
      CLIENT_TEXT_PREFIXES.some((prefix) => key.startsWith(prefix)),
    ),
  );

  return (
    <html lang="ru" className={`${pixel.variable} ${body.variable} ${arcade.variable}`}>
      <head>
        {/* Заголовочный шрифт нужен сразу: без preload первый экран мигает */}
        <link
          rel="preload"
          href="/fonts/science-gothic-cyrillic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/science-gothic-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <TextsProvider texts={clientTexts}>
          <a href="#main" className="visually-hidden">
            Перейти к содержимому
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </TextsProvider>
      </body>
    </html>
  );
}

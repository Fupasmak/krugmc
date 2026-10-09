import { PointsTabs } from './PointsTabs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Баллы',
  robots: { index: false, follow: false },
};

export default function PointsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="section-title">
        <h2>Баллы</h2>
      </div>
      <PointsTabs />
      {children}
    </>
  );
}

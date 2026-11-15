import { GalleryView } from '@/components/gallery/GalleryView';

export const dynamic = 'force-dynamic';

export default function GalleryPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-5 text-[22px] font-semibold">画廊</h1>
      <GalleryView />
    </div>
  );
}

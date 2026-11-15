'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { PlaceRow } from '@/lib/types';

interface MapState {
  loaded: boolean;
  error: string | null;
}

/**
 * 人生地图：Leaflet + OSM（免费无 Key）。
 * - 有坐标的地点打点；无坐标的地点列在右侧列表，点击可跳详情。
 * - 地图库失败时整体降级为地点列表（PRD：地图组件可替换，不强制付费服务）。
 */
export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import('leaflet').Map | null>(null);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [state, setState] = useState<MapState>({ loaded: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ items: PlaceRow[] }>('/api/places?page=1&page_size=100');
        if (cancelled) return;
        setPlaces(data.items);
        const withCoords = data.items.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number');
        if (withCoords.length > 0) {
          const L = await import('leaflet');
          if (cancelled) return;
          const center: [number, number] =
            withCoords.length === 1
              ? [withCoords[0].latitude!, withCoords[0].longitude!]
              : [35, 105]; // 中国默认视野
          const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: true }).setView(center, withCoords.length === 1 ? 12 : 4);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
          const bounds: [number, number][] = [];
          for (const p of withCoords) {
            const icon = L.divIcon({
              className: '',
              html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#777D66;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><div style="transform:rotate(45deg);width:6px;height:6px;border-radius:50%;background:#fff"></div></div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 26],
            });
            const marker = L.marker([p.latitude!, p.longitude!], { icon }).addTo(map);
            const line = [p.name, p.city, p.country].filter(Boolean).join(' · ');
            marker.bindPopup(`<div style="font-size:13px;min-width:120px"><b>${p.name}</b><br>${line}</div>`);
            bounds.push([p.latitude!, p.longitude!]);
          }
          if (withCoords.length > 1) {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
          }
          mapInstance.current = map;
        }
        setState({ loaded: true, error: null });
      } catch (err) {
        if (!cancelled) setState({ loaded: true, error: err instanceof Error ? err.message : '地图加载失败' });
      }
    })();
    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  const withCoords = places.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number');

  return (
    <div className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          地图加载失败：{state.error}。下方地点列表仍可使用。
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden !p-0">
          <div ref={mapRef} className="h-[380px] w-full bg-accent-soft/50 sm:h-[480px]" />
          {!state.loaded && (
            <div className="flex h-[380px] items-center justify-center text-sm text-muted sm:h-[480px]">地图加载中…</div>
          )}
          {state.loaded && !state.error && withCoords.length === 0 && (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted">
              地点还没有经纬度，先去地点详情补充坐标吧
            </div>
          )}
        </div>
        <div className="card h-fit">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MapPin size={15} className="text-accent" /> 全部地点（{places.length}）
          </h2>
          {places.length === 0 ? (
            <p className="text-sm text-muted">还没有地点档案。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/places/${p.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent-soft/60"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        typeof p.latitude === 'number' ? 'bg-accent' : 'bg-border'
                      }`}
                      title={typeof p.latitude === 'number' ? '已定位' : '未填写坐标'}
                    />
                    <span className="truncate">{p.name}</span>
                    <span className="truncate text-xs text-muted">{[p.city, p.country].filter(Boolean).join(' · ')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            有经纬度的地点显示在地图上；未填写的地点可进入详情页补充坐标。
          </p>
        </div>
      </div>
    </div>
  );
}

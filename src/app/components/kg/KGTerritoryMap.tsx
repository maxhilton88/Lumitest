/**
 * KGTerritoryMap.tsx — Premium minimalist territory map for kindergartens
 *
 * Uses vanilla Leaflet (not react-leaflet) for React 19 compatibility.
 * Uses leaflet.markercluster for 10K+ marker performance.
 * Renders all KGs as clustered nodes on a greyscale map.
 * Territory circles (3km radius) only appear at zoom >= 10.
 *
 * Color coding:
 *   - Dark grey (#6B7280)  = unclaimed
 *   - Blue (#3B82F6)       = claimed
 *   - Red (#EF4444)        = territory locked (active/founder tier)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Lock, Unlock, Shield, MapPin, Loader2, AlertTriangle, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface MapNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  city: string;
  postcode: string;
  status: string;
  plan_tier: string;
  has_owner: boolean;
  territory: 'unclaimed' | 'claimed' | 'locked';
  claim_code?: string | null;
}

interface KGTerritoryMapProps {
  mode: 'embed' | 'dashboard';
  highlightKgId?: string;
  onLockTerritory?: (kgId: string) => void;
  className?: string;
}

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

const COLORS: Record<string, { fill: string; stroke: string }> = {
  unclaimed: { fill: '#6B7280', stroke: '#4B5563' },
  claimed:   { fill: '#3B82F6', stroke: '#2563EB' },
  locked:    { fill: '#EF4444', stroke: '#DC2626' },
};

const MALAYSIA_CENTER: [number, number] = [4.2105, 108.9758];
const DEFAULT_ZOOM = 6;
const TERRITORY_RADIUS = 3000;
const CIRCLE_ZOOM_THRESHOLD = 10;

// Inject Leaflet + MarkerCluster CSS from CDN once
function useLeafletCSS() {
  useEffect(() => {
    const sheets = [
      { id: 'leaflet-css-cdn', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' },
      { id: 'leaflet-mc-css', href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css' },
      { id: 'leaflet-mc-default-css', href: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css' },
    ];
    sheets.forEach(({ id, href }) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }, []);
}

// Create a small colored dot DivIcon for a node
function createDotIcon(territory: string, isHighlight: boolean): L.DivIcon {
  const colors = COLORS[territory] || COLORS.unclaimed;
  const size = isHighlight ? 16 : 10;
  const border = isHighlight ? `2.5px solid #000` : `1.5px solid ${colors.stroke}`;
  return L.divIcon({
    className: 'kg-dot-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colors.fill};border:${border};box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function KGTerritoryMap({ mode, highlightKgId, onLockTerritory, className = '' }: KGTerritoryMapProps) {
  useLeafletCSS();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const circleLayerRef = useRef<L.LayerGroup | null>(null);
  const nodesRef = useRef<MapNode[]>([]);

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stats = {
    total: nodes.length,
    unclaimed: nodes.filter(n => n.territory === 'unclaimed').length,
    claimed: nodes.filter(n => n.territory === 'claimed').length,
    locked: nodes.filter(n => n.territory === 'locked').length,
  };

  const highlightNode = nodes.find(n => n.id === highlightKgId);

  // Keep a ref in sync for the zoom handler
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const fetchMapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}/kg-db/map-data`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load map data');
      }
      setNodes(data.nodes || []);
      if (data.notice) setNotice(data.notice);
    } catch (err: any) {
      console.error('[KG-MAP] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Render circles only for nodes in viewport when zoom >= threshold
  const updateCircles = useCallback((map: L.Map, circleLayer: L.LayerGroup) => {
    circleLayer.clearLayers();
    const zoom = map.getZoom();
    if (zoom < CIRCLE_ZOOM_THRESHOLD) return;

    const bounds = map.getBounds();
    const visibleNodes = nodesRef.current.filter(n => bounds.contains([n.lat, n.lng]));

    // Cap at 200 circles to stay smooth even at edge zoom levels
    const toRender = visibleNodes.slice(0, 200);
    toRender.forEach(node => {
      const colors = COLORS[node.territory] || COLORS.unclaimed;
      const isHl = node.id === highlightKgId;
      L.circle([node.lat, node.lng], {
        radius: TERRITORY_RADIUS,
        fillColor: colors.fill,
        fillOpacity: isHl ? 0.15 : 0.06,
        color: colors.stroke,
        weight: isHl ? 1.5 : 0.5,
        opacity: isHl ? 0.4 : 0.2,
        dashArray: node.territory === 'locked' ? undefined : '4 4',
      }).addTo(circleLayer);
    });
  }, [highlightKgId]);

  // Initialize Leaflet map
  useEffect(() => {
    if (loading || error || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: highlightNode ? [highlightNode.lat, highlightNode.lng] : MALAYSIA_CENTER,
      zoom: highlightNode ? 13 : DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // CartoDB Positron grey tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png').addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { opacity: 0.4 }).addTo(map);

    // Circle layer (below clusters, added first)
    const circleLayer = L.layerGroup().addTo(map);
    circleLayerRef.current = circleLayer;

    // Cluster group with custom styling
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = 36;
        let bgColor = '#6B7280';
        let fontSize = '12px';
        if (count >= 1000) {
          size = 52;
          bgColor = '#1F2937';
          fontSize = '13px';
        } else if (count >= 100) {
          size = 44;
          bgColor = '#374151';
          fontSize = '12px';
        } else if (count >= 10) {
          size = 38;
          bgColor = '#4B5563';
        }
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${bgColor};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:${fontSize};font-weight:600;font-family:inherit;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            border:2px solid rgba(255,255,255,0.3);
          ">${count >= 1000 ? Math.round(count / 1000) + 'K' : count}</div>`,
          className: 'kg-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Update circles on zoom/pan
    map.on('zoomend moveend', () => {
      updateCircles(map, circleLayer);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
      circleLayerRef.current = null;
    };
  }, [loading, error]);

  // Render nodes into cluster group when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    const circleLayer = circleLayerRef.current;
    if (!map || !clusterGroup) return;

    clusterGroup.clearLayers();

    const markers: L.Marker[] = [];

    nodes.forEach(node => {
      const isHl = node.id === highlightKgId;
      const icon = createDotIcon(node.territory, isHl);

      const marker = L.marker([node.lat, node.lng], { icon });

      // Build popup HTML
      const colors = COLORS[node.territory] || COLORS.unclaimed;
      const territoryIcon = node.territory === 'locked'
        ? '<span style="color:#EF4444">&#x1F512;</span>'
        : node.territory === 'claimed'
          ? '<span style="color:#3B82F6">&#x1F6E1;</span>'
          : '<span style="color:#9CA3AF">&#x1F513;</span>';

      let popupHtml = `
        <div style="min-width:180px;font-family:inherit;">
          <div style="padding:8px 12px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${colors.fill};display:inline-block;flex-shrink:0;"></span>
            <strong style="font-size:13px;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${node.name}</strong>
          </div>
          <div style="padding:8px 12px;">
            ${node.city ? `<div style="font-size:11px;color:#6B7280;margin-bottom:4px;">&#x1F4CD; ${node.city}${node.state ? ', ' + node.state : ''}</div>` : ''}
            <div style="font-size:11px;color:#6B7280;">
              ${territoryIcon} <span style="text-transform:capitalize;">${node.territory}</span>
              ${node.territory === 'locked' ? '<span style="font-size:10px;color:#EF4444;margin-left:4px;font-weight:500;">3km secured</span>' : ''}
            </div>
          </div>`;

      if (mode === 'dashboard' && node.territory === 'unclaimed') {
        popupHtml += `<div style="padding:6px 12px;border-top:1px solid #f3f4f6;font-size:10px;color:#9CA3AF;">Available for claiming</div>`;
      }

      // Claim button for unclaimed KGs (works in both modes)
      if (node.territory === 'unclaimed' && node.claim_code) {
        popupHtml += `<div style="padding:8px 12px;border-top:1px solid #f3f4f6;">
          <a id="claim-btn-${node.id}" href="/kg-signup?code=${encodeURIComponent(node.claim_code)}" style="width:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 12px;background:#059669;color:#fff;font-size:11px;font-weight:500;border-radius:6px;border:none;cursor:pointer;text-decoration:none;">
            &#x2705; Claim This Kindergarten
          </a>
        </div>`;
      }

      if (mode === 'dashboard' && node.id === highlightKgId && node.territory === 'claimed' && onLockTerritory) {
        popupHtml += `<div style="padding:8px 12px;border-top:1px solid #f3f4f6;">
          <button id="lock-btn-${node.id}" style="width:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 12px;background:#000;color:#fff;font-size:11px;font-weight:500;border-radius:6px;border:none;cursor:pointer;">
            &#x1F512; Lock Territory
          </button>
        </div>`;
      }

      popupHtml += '</div>';

      const popup = L.popup({ closeButton: false, className: 'kg-map-popup', offset: [0, -4] })
        .setContent(popupHtml);

      marker.bindPopup(popup);

      // Add click handler for lock button after popup opens
      if (mode === 'dashboard' && node.id === highlightKgId && node.territory === 'claimed' && onLockTerritory) {
        marker.on('popupopen', () => {
          const btn = document.getElementById(`lock-btn-${node.id}`);
          if (btn) {
            btn.onclick = () => onLockTerritory(node.id);
          }
        });
      }

      markers.push(marker);
    });

    clusterGroup.addLayers(markers);

    // Initial circle render
    if (circleLayer) {
      updateCircles(map, circleLayer);
    }

    // Fly to highlighted node
    if (highlightNode) {
      setTimeout(() => {
        map.flyTo([highlightNode.lat, highlightNode.lng], 13, { duration: 1.5 });
      }, 500);
    }
  }, [nodes, highlightKgId, mode, onLockTerritory]);

  // Map control handlers
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (highlightNode) {
      map.flyTo([highlightNode.lat, highlightNode.lng], 13, { duration: 1.2 });
    } else {
      map.flyTo(MALAYSIA_CENTER, DEFAULT_ZOOM, { duration: 1.2 });
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 ${className}`} style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500 font-medium tracking-wide">Loading territory map...</span>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 ${className}`} style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertTriangle className="w-6 h-6 text-gray-400" />
          <span className="text-sm text-gray-500">{error}</span>
          <button onClick={fetchMapData} className="text-xs text-gray-600 underline hover:text-gray-800">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Notice banner */}
      {notice && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
          {notice}
        </div>
      )}

      {/* Legend bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
            <span className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">Unclaimed</span>
            <span className="text-[11px] text-gray-400 ml-0.5">{stats.unclaimed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">Claimed</span>
            <span className="text-[11px] text-gray-400 ml-0.5">{stats.claimed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">Locked</span>
            <span className="text-[11px] text-gray-400 ml-0.5">{stats.locked}</span>
          </div>
        </div>
        <span className="text-[11px] text-gray-400">{stats.total} kindergartens</span>
      </div>

      {/* Map */}
      <div className="relative flex-1" style={{ minHeight: 500 }}>
        <div ref={mapContainerRef} style={{ height: '100%', minHeight: 500, background: '#f0f0f0' }} />

        {/* Custom map controls */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5">
          <button onClick={handleZoomIn} className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
            <ZoomIn className="w-4 h-4 text-gray-700" />
          </button>
          <button onClick={handleZoomOut} className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
            <ZoomOut className="w-4 h-4 text-gray-700" />
          </button>
          <button onClick={handleRecenter} className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm" title="Recenter">
            <Crosshair className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {/* Popup & cluster styling */}
        <style>{`
          .kg-map-popup .leaflet-popup-content-wrapper {
            border-radius: 10px;
            padding: 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
            border: 1px solid rgba(0,0,0,0.06);
          }
          .kg-map-popup .leaflet-popup-content {
            margin: 0;
          }
          .kg-map-popup .leaflet-popup-tip {
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
          .leaflet-container {
            font-family: inherit;
          }
          .kg-dot-icon {
            background: transparent !important;
            border: none !important;
          }
          .kg-cluster-icon {
            background: transparent !important;
            border: none !important;
          }
          .marker-cluster {
            background: transparent !important;
          }
          .marker-cluster div {
            background: transparent !important;
          }
        `}</style>
      </div>
    </div>
  );
}
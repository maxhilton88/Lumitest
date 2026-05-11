/**
 * KGFindPage — Dedicated "Find My Listing" map search page
 *
 * Route: /kg-find
 *
 * Full-screen map with a search bar that filters KGs by name, postcode,
 * phone, address, city, or state. Users find their KG on the map, click
 * the pin, and claim it via the popup link.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import L from 'leaflet';
import 'leaflet.markercluster';
import {
  Search, X, ArrowLeft, Building2, MapPin, Loader2,
  AlertTriangle, ZoomIn, ZoomOut, Crosshair, KeyRound, Plus,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface MapNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  city: string;
  postcode: string;
  address?: string;
  phone?: string;
  status: string;
  plan_tier: string;
  has_owner: boolean;
  territory: 'unclaimed' | 'claimed' | 'locked';
  claim_code?: string | null;
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

// Inject Leaflet CSS
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

export function KGFindPage() {
  const navigate = useNavigate();
  useLeafletCSS();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const circleLayerRef = useRef<L.LayerGroup | null>(null);
  const nodesRef = useRef<MapNode[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return nodes
      .filter(n => {
        return (
          n.name.toLowerCase().includes(q) ||
          n.postcode?.toLowerCase().includes(q) ||
          n.city?.toLowerCase().includes(q) ||
          n.state?.toLowerCase().includes(q) ||
          (n.address && n.address.toLowerCase().includes(q)) ||
          (n.phone && n.phone.includes(q))
        );
      })
      .slice(0, 20); // Cap at 20 results
  }, [searchQuery, nodes]);

  const showDropdown = searchFocused && searchQuery.trim().length >= 2;

  // Fetch map data
  const fetchMapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/kg-db/map-data`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load map data');
      }
      setNodes(data.nodes || []);
    } catch (err: any) {
      console.error('[KG-FIND] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Keep ref in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Render circles at high zoom
  const updateCircles = useCallback((map: L.Map, circleLayer: L.LayerGroup) => {
    circleLayer.clearLayers();
    const zoom = map.getZoom();
    if (zoom < CIRCLE_ZOOM_THRESHOLD) return;

    const bounds = map.getBounds();
    const visibleNodes = nodesRef.current.filter(n => bounds.contains([n.lat, n.lng]));
    visibleNodes.slice(0, 200).forEach(node => {
      const colors = COLORS[node.territory] || COLORS.unclaimed;
      L.circle([node.lat, node.lng], {
        radius: TERRITORY_RADIUS,
        fillColor: colors.fill,
        fillOpacity: 0.06,
        color: colors.stroke,
        weight: 1,
        opacity: 0.3,
      }).addTo(circleLayer);
    });
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || nodes.length === 0 || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MALAYSIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = 28;
        let bg = '#d1d5db';
        if (count > 100) { size = 40; bg = '#9ca3af'; }
        else if (count > 20) { size = 34; bg = '#b0b5bb'; }
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,0.15);border:2px solid rgba(255,255,255,0.8);">${count}</div>`,
          className: 'kg-cluster-icon',
          iconSize: [size, size],
        });
      },
    });

    const markersMap = new Map<string, L.Marker>();

    nodes.forEach(node => {
      const marker = L.marker([node.lat, node.lng], {
        icon: createDotIcon(node.territory, false),
      });

      // Build popup
      const statusLabel = node.territory === 'locked' ? 'Territory Locked'
        : node.territory === 'claimed' ? 'Claimed'
        : 'Unclaimed';
      const statusColor = node.territory === 'locked' ? '#EF4444'
        : node.territory === 'claimed' ? '#3B82F6'
        : '#6B7280';

      let popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:200px;max-width:260px;">
          <div style="padding:10px 12px;">
            <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:2px;">${node.name}</div>
            <div style="font-size:11px;color:#9ca3af;">
              ${[node.city, node.state, node.postcode].filter(Boolean).join(', ')}
            </div>
            <div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:500;background:${statusColor}15;color:${statusColor};">
              <span style="width:5px;height:5px;border-radius:50%;background:${statusColor};"></span>
              ${statusLabel}
            </div>
          </div>`;

      if (node.territory === 'unclaimed' && node.claim_code) {
        popupHtml += `<div style="padding:8px 12px;border-top:1px solid #f3f4f6;">
          <a href="/kg-signup?code=${encodeURIComponent(node.claim_code)}" style="width:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 12px;background:#059669;color:#fff;font-size:11px;font-weight:500;border-radius:6px;border:none;cursor:pointer;text-decoration:none;">
            &#x2705; Claim This Kindergarten
          </a>
        </div>`;
      }
      popupHtml += `</div>`;

      marker.bindPopup(popupHtml, {
        closeButton: true,
        className: 'kg-popup-minimal',
      });

      clusterGroup.addLayer(marker);
      markersMap.set(node.id, marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    markersMapRef.current = markersMap;

    const circleLayer = L.layerGroup().addTo(map);
    circleLayerRef.current = circleLayer;

    map.on('moveend zoomend', () => updateCircles(map, circleLayer));

    mapInstanceRef.current = map;

    // Add custom styles
    const style = document.createElement('style');
    style.textContent = `
      .kg-dot-icon { background: transparent !important; border: none !important; }
      .kg-cluster-icon { background: transparent !important; border: none !important; }
      .kg-popup-minimal .leaflet-popup-content-wrapper {
        border-radius: 12px; padding: 0; overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      .kg-popup-minimal .leaflet-popup-content { margin: 0; }
      .kg-popup-minimal .leaflet-popup-tip { display: none; }
    `;
    document.head.appendChild(style);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [nodes, updateCircles]);

  // Fly to a search result
  const flyToNode = (node: MapNode) => {
    setSearchQuery(node.name);
    setSearchFocused(false);

    const map = mapInstanceRef.current;
    const marker = markersMapRef.current.get(node.id);
    if (map && marker) {
      map.flyTo([node.lat, node.lng], 14, { duration: 0.8 });
      setTimeout(() => {
        // Spiderfy if needed, then open popup
        if (clusterGroupRef.current) {
          clusterGroupRef.current.zoomToShowLayer(marker, () => {
            marker.openPopup();
          });
        } else {
          marker.openPopup();
        }
      }, 900);
    }
  };

  const resetCenter = () => {
    mapInstanceRef.current?.flyTo(MALAYSIA_CENTER, DEFAULT_ZOOM, { duration: 0.5 });
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* ─── TOP BAR ─── */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white z-[1000] relative">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate('/kinderpartner')}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Search bar */}
          <div className="flex-1 relative max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search by name, postcode, city, or address..."
                className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder:text-gray-300"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[1001] max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map(node => {
                    const statusColor = node.territory === 'locked' ? 'bg-red-500'
                      : node.territory === 'claimed' ? 'bg-blue-500'
                      : 'bg-gray-400';
                    return (
                      <button
                        key={node.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => flyToNode(node)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-b-0"
                      >
                        <div className={`w-2 h-2 rounded-full ${statusColor} mt-1.5 flex-shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{node.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {[node.city, node.state, node.postcode].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        {node.territory === 'unclaimed' && (
                          <span className="ml-auto text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                            Claimable
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-400 mb-1">No kindergartens found</p>
                    <p className="text-xs text-gray-300">Try a different name, postcode, or city</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alt actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => navigate('/kg-signup')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              title="I have a claim code"
            >
              <KeyRound className="w-3 h-3" />
              <span className="hidden md:inline">Enter Code</span>
            </button>
            <button
              onClick={() => navigate('/kg-register')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              title="Register new kindergarten"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden md:inline">Register</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──�� MAP ─── */}
      <div className="flex-1 relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Loading kindergartens...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
            <div className="text-center px-6">
              <AlertTriangle className="w-6 h-6 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">Failed to load map data</p>
              <p className="text-xs text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchMapData}
                className="px-4 py-2 text-xs font-medium bg-gray-950 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Map container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map controls */}
        <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-1.5">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={resetCenter}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm mt-1"
          >
            <Crosshair className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>

        {/* Stats badge */}
        {!loading && nodes.length > 0 && (
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">{nodes.length.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400">kindergartens</span>
                </div>
                <div className="w-px h-3 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span className="text-[10px] text-gray-400">{nodes.filter(n => n.territory === 'unclaimed').length}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-gray-400">{nodes.filter(n => n.territory === 'claimed').length}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] text-gray-400">{nodes.filter(n => n.territory === 'locked').length}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom bar with alt links */}
        <div className="sm:hidden absolute bottom-4 left-4 right-14 z-10">
          <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 p-2 shadow-sm flex gap-1.5">
            <button
              onClick={() => navigate('/kg-signup')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <KeyRound className="w-3 h-3" />
              Enter Code
            </button>
            <div className="w-px bg-gray-200" />
            <button
              onClick={() => navigate('/kg-register')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              Register New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KGFindPage;
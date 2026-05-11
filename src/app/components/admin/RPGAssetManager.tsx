/**
 * RPGAssetManager.tsx — Tabbed admin panel for managing RPG game entities.
 *
 * Tabs:
 *   - Zones: Create/edit game zones with subject mapping + tileset/map uploads
 *   - Spirits: Create/edit wild spirits with stats, moves, and sprite uploads
 *   - Characters: Upload sprites for Boy/Girl player + Fox companion
 *   - Image Assets: R2 uploads (icons, BGs, UI)
 *   - Map Editor: Visual tile map painter
 *
 * All new uploads go to Supabase Storage (verifiable from server).
 * Metadata stored in KV (rpg_entity:{type}:{id}).
 * One-click migration to R2 when ready for production.
 */
import React, { useState } from 'react';
import {
  MapPin, Swords, User, Gamepad2, Image as ImageIcon,
  Map as MapIcon,
} from 'lucide-react';
import { RPGZoneManager } from './RPGZoneManager';
import { RPGSpiritManager } from './RPGSpiritManager';
import { RPGCharacterManager } from './RPGCharacterManager';
import { RPGImageManager } from './RPGImageManager';
import { RPGMapEditor } from './RPGMapEditor';

const GOLD = '#d4a44a';

type Tab = 'zones' | 'spirits' | 'characters' | 'images' | 'mapeditor';

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'zones', label: 'Zones', icon: MapPin, description: 'Game world areas' },
  { id: 'spirits', label: 'Spirits', icon: Swords, description: 'Wild monsters' },
  { id: 'characters', label: 'Characters', icon: User, description: 'Boy/Girl + Fox' },
  { id: 'images', label: 'Image Assets', icon: ImageIcon, description: 'R2 uploads (icons, BGs, UI)' },
  { id: 'mapeditor', label: 'Map Editor', icon: MapIcon, description: 'Visual tile map painter' },
];

export const RPGAssetManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('zones');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-5 h-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-bold text-gray-900">RPG Game Manager</h2>
        </div>
        <p className="text-sm text-gray-500">
          Create zones, spirits, and characters for the open-world adventure.
          All assets stored in Supabase Storage (verifiable).
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content — dark RPG panel */}
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(30,22,12,0.97), rgba(15,12,8,0.99))',
          border: `1.5px solid ${GOLD}20`,
          boxShadow: `0 4px 30px rgba(0,0,0,0.4), 0 0 20px ${GOLD}06`,
        }}
      >
        {/* Tab title */}
        <div className="mb-5 pb-3 border-b border-gray-800">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: GOLD }}>
            {(() => {
              const tab = TABS.find(t => t.id === activeTab)!;
              const Icon = tab.icon;
              return (
                <>
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  <span className="text-gray-600 font-normal text-xs ml-1">— {tab.description}</span>
                </>
              );
            })()}
          </h3>
        </div>

        {/* Content */}
        {activeTab === 'zones' && <RPGZoneManager />}
        {activeTab === 'spirits' && <RPGSpiritManager />}
        {activeTab === 'characters' && <RPGCharacterManager />}
        {activeTab === 'images' && <RPGImageManager />}
        {activeTab === 'mapeditor' && <RPGMapEditor />}
      </div>

      {/* Storage info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h4 className="text-xs font-bold text-blue-800 mb-1">Storage: Supabase (Dev Mode)</h4>
        <p className="text-[11px] text-blue-600 leading-relaxed">
          All uploads go to Supabase Storage bucket <code className="bg-blue-100 px-1 rounded">rpg-assets-221a61bc</code>.
          This lets us verify uploads from the server. When assets are finalized, use the "Migrate to R2" button to copy
          everything to Cloudflare R2 for production CDN delivery.
        </p>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { X, Swords, Compass, Coins, ScrollText, ShieldCheck, BookOpen, Music, type LucideIcon } from 'lucide-react';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';
import { updateParentProfile } from '../../utils/parent-api';

export type ParentPage = 'game' | 'mastery' | 'library' | 'audio' | 'earnings' | 'plan' | 'account';

interface MenuItem {
  id: ParentPage;
  labelKey: string;
  sublabelKey: string;
  icon: LucideIcon;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'game', labelKey: 'menu.game', sublabelKey: 'menu.game.sub', icon: Swords },
  { id: 'mastery', labelKey: 'menu.mastery', sublabelKey: 'menu.mastery.sub', icon: Compass },
  { id: 'library', labelKey: 'menu.library', sublabelKey: 'menu.library.sub', icon: BookOpen },
  { id: 'audio', labelKey: 'menu.audio', sublabelKey: 'menu.audio.sub', icon: Music },
  { id: 'earnings', labelKey: 'menu.earnings', sublabelKey: 'menu.earnings.sub', icon: Coins },
  { id: 'plan', labelKey: 'menu.plan', sublabelKey: 'menu.plan.sub', icon: ScrollText },
  { id: 'account', labelKey: 'menu.account', sublabelKey: 'menu.account.sub', icon: ShieldCheck },
];

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface SideMenuProps {
  activePage: ParentPage;
  onNavigate: (page: ParentPage) => void;
  childName?: string;
  parentName?: string;
  onLogout: () => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}

/**
 * RPGIcon — A styled lucide icon in a gold-themed container.
 * Replaces the old emoji IconPlaceholder with proper SVG icons.
 */
function RPGIcon({
  Icon,
  size = 36,
  isActive = false,
}: {
  Icon: LucideIcon;
  size?: number;
  isActive?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded-lg transition-all duration-300"
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${isActive ? GOLD : `${GOLD}40`}`,
        background: isActive
          ? `linear-gradient(135deg, ${GOLD}20, ${GOLD}08)`
          : `rgba(26,18,9,0.4)`,
        boxShadow: isActive ? `0 0 12px ${GOLD}30, inset 0 0 8px ${GOLD}10` : 'none',
      }}
    >
      <Icon
        className="transition-all duration-300"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          color: isActive ? GOLD_LIGHT : `${PARCHMENT}80`,
          filter: isActive ? `drop-shadow(0 0 4px ${GOLD}60)` : 'none',
        }}
      />
    </div>
  );
}

export const SideMenu: React.FC<SideMenuProps> = ({
  activePage,
  onNavigate,
  childName,
  parentName,
  onLogout,
  language,
  onLanguageChange,
}) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!isExpanded || !isMobile) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isExpanded, isMobile]);

  const handleNav = (page: ParentPage) => {
    playMenuSelect();
    onNavigate(page);
    if (isMobile) setIsExpanded(false);
  };

  // Language change handler — update context AND persist to server
  const handleLanguageSwitch = (lang: string) => {
    playMenuSelect();
    onLanguageChange(lang);
    // Fire-and-forget persist to server
    updateParentProfile({ language: lang }).catch((err) => {
      console.warn('[SIDEMENU] Failed to persist language to server:', err);
    });
  };

  // ===== MOBILE: Floating button + overlay =====
  if (isMobile) {
    return (
      <>
        {/* Floating menu trigger — ornate gold button */}
        <button
          onClick={() => { playMenuSelect(); setIsExpanded(true); }}
          className="fixed top-4 left-4 z-[70] w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
            border: `2px solid ${GOLD}66`,
            boxShadow: `0 0 15px ${GOLD}20, 0 4px 12px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Hamburger with RPG style — 3 gold bars */}
          <div className="flex flex-col gap-[3px]">
            <div className="w-4 h-[2px] rounded-full" style={{ background: GOLD }} />
            <div className="w-3 h-[2px] rounded-full" style={{ background: GOLD }} />
            <div className="w-4 h-[2px] rounded-full" style={{ background: GOLD }} />
          </div>
        </button>

        {/* Overlay scrim */}
        {isExpanded && (
          <div
            className="fixed inset-0 z-[75] transition-opacity duration-300"
            style={{ background: 'rgba(5,3,1,0.7)', backdropFilter: 'blur(3px)' }}
            onClick={() => setIsExpanded(false)}
          />
        )}

        {/* Slide-out menu panel */}
        <div
          ref={menuRef}
          className={`fixed top-0 left-0 bottom-0 z-[80] transition-transform duration-300 ease-out ${
            isExpanded ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: '280px' }}
        >
          <div
            className="h-full flex flex-col overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, #1a120a 0%, #231a0e 50%, #1a120a 100%)',
              borderRight: `2px solid ${GOLD}30`,
              boxShadow: `4px 0 30px rgba(0,0,0,0.6), 0 0 20px ${GOLD}08`,
            }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Child avatar placeholder */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      border: `2px solid ${GOLD}60`,
                      background: `${GOLD}10`,
                      boxShadow: `0 0 10px ${GOLD}15`,
                    }}
                  >
                    <span className="text-lg">🦊</span>
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold leading-tight"
                      style={{
                        fontFamily: "'Cinzel Decorative', serif",
                        color: GOLD_LIGHT,
                      }}
                    >
                      {childName || 'Young Explorer'}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>
                      {parentName || 'Parent'}
                    </p>
                  </div>
                </div>
                {/* Close button */}
                <button
                  onClick={() => { playMenuSelect(); setIsExpanded(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
                >
                  <X className="w-4 h-4" style={{ color: `${GOLD}80` }} />
                </button>
              </div>

              {/* Gold divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${GOLD}40, transparent)` }} />
                <div className="w-1.5 h-1.5 rotate-45" style={{ background: `${GOLD}60` }} />
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, ${GOLD}40, transparent)` }} />
              </div>
            </div>

            {/* Menu items */}
            <nav className="flex-1 px-3 py-2">
              {MENU_ITEMS.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all duration-200 group relative"
                    style={{
                      background: isActive
                        ? `linear-gradient(90deg, ${GOLD}18, transparent)`
                        : 'transparent',
                    }}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                        style={{
                          background: `linear-gradient(180deg, ${GOLD}, ${GOLD_LIGHT})`,
                          boxShadow: `0 0 8px ${GOLD}60`,
                        }}
                      />
                    )}

                    <RPGIcon Icon={item.icon} size={36} isActive={isActive} />

                    <div className="text-left">
                      <p
                        className="text-sm font-bold leading-tight transition-colors"
                        style={{
                          fontFamily: "'Cinzel Decorative', serif",
                          color: isActive ? GOLD_LIGHT : `${PARCHMENT}90`,
                          textShadow: isActive ? `0 0 8px ${GOLD}30` : 'none',
                        }}
                      >
                        {t(item.labelKey)}
                      </p>
                      <p
                        className="text-[10px] mt-0.5 leading-tight"
                        style={{ color: isActive ? `${PARCHMENT}90` : `${PARCHMENT}65` }}
                      >
                        {t(item.sublabelKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-5 pb-5 pt-2">
              {/* Divider */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
                <div className="w-1 h-1 rotate-45" style={{ background: `${GOLD}40` }} />
                <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
              </div>

              {/* Language switcher */}
              <div className="flex items-center justify-center gap-1 mb-4">
                {['en', 'ms', 'zh'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageSwitch(lang)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
                    style={{
                      background: language === lang ? `${GOLD}25` : 'transparent',
                      color: language === lang ? GOLD_LIGHT : `${PARCHMENT}75`,
                      border: `1px solid ${language === lang ? `${GOLD}40` : `${GOLD}15`}`,
                    }}
                  >
                    {lang === 'en' ? 'EN' : lang === 'ms' ? 'BM' : 'ZH'}
                  </button>
                ))}
              </div>

              {/* Logout */}
              <button
                onClick={() => { playMenuSelect(); onLogout(); }}
                className="w-full text-center text-xs py-2 rounded-lg transition-all"
                style={{
                  color: `${PARCHMENT}75`,
                  border: `1px solid ${GOLD}10`,
                  fontFamily: "'Cinzel Decorative', serif",
                }}
              >
                {t('menu.logout')}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ===== DESKTOP: Collapsible sidebar strip =====
  return (
    <div
      ref={menuRef}
      className="fixed top-0 left-0 bottom-0 z-[50] transition-all duration-300 ease-out flex flex-col"
      style={{
        width: isExpanded ? '270px' : '64px',
        background: 'linear-gradient(180deg, #1a120a 0%, #231a0e 50%, #1a120a 100%)',
        borderRight: `2px solid ${GOLD}25`,
        boxShadow: `2px 0 20px rgba(0,0,0,0.4), 0 0 15px ${GOLD}05`,
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className={`px-3 pt-4 pb-3 ${isExpanded ? 'px-4' : ''}`}>
        {isExpanded ? (
          <div className="flex items-center gap-3 mb-3 px-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${GOLD}60`,
                background: `${GOLD}10`,
                boxShadow: `0 0 10px ${GOLD}15`,
              }}
            >
              <span className="text-base">🦊</span>
            </div>
            <div className="overflow-hidden">
              <p
                className="text-sm font-bold leading-tight truncate"
                style={{
                  fontFamily: "'Cinzel Decorative', serif",
                  color: GOLD_LIGHT,
                }}
              >
                {childName || 'Young Explorer'}
              </p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: `${PARCHMENT}80` }}>
                {parentName || 'Parent'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                border: `2px solid ${GOLD}60`,
                background: `${GOLD}10`,
                boxShadow: `0 0 10px ${GOLD}15`,
              }}
            >
              <span className="text-base">🦊</span>
            </div>
          </div>
        )}

        {/* Gold divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: `${GOLD}30` }} />
          {isExpanded && <div className="w-1.5 h-1.5 rotate-45" style={{ background: `${GOLD}50` }} />}
          <div className="flex-1 h-px" style={{ background: `${GOLD}30` }} />
        </div>
      </div>

      {/* Menu items */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center rounded-xl mb-1 transition-all duration-200 relative ${
                isExpanded ? 'gap-3 px-3 py-3' : 'justify-center py-3'
              }`}
              style={{
                background: isActive
                  ? `linear-gradient(90deg, ${GOLD}18, transparent)`
                  : 'transparent',
              }}
              title={!isExpanded ? t(item.labelKey) : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${GOLD}, ${GOLD_LIGHT})`,
                    boxShadow: `0 0 8px ${GOLD}60`,
                  }}
                />
              )}

              <RPGIcon
                Icon={item.icon}
                size={isExpanded ? 36 : 36}
                isActive={isActive}
              />

              {isExpanded && (
                <div className="text-left overflow-hidden">
                  <p
                    className="text-[13px] font-bold leading-tight truncate transition-colors"
                    style={{
                      fontFamily: "'Cinzel Decorative', serif",
                      color: isActive ? GOLD_LIGHT : `${PARCHMENT}90`,
                      textShadow: isActive ? `0 0 8px ${GOLD}30` : 'none',
                    }}
                  >
                    {t(item.labelKey)}
                  </p>
                  <p
                    className="text-[10px] mt-0.5 leading-tight truncate"
                    style={{ color: isActive ? `${PARCHMENT}90` : `${PARCHMENT}65` }}
                  >
                    {t(item.sublabelKey)}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`pb-4 pt-2 ${isExpanded ? 'px-4' : 'px-2'}`}>
        {/* Divider */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
        </div>

        {isExpanded ? (
          <>
            {/* Language switcher */}
            <div className="flex items-center justify-center gap-1 mb-3">
              {['en', 'ms', 'zh'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageSwitch(lang)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all"
                  style={{
                    background: language === lang ? `${GOLD}25` : 'transparent',
                    color: language === lang ? GOLD_LIGHT : `${PARCHMENT}75`,
                    border: `1px solid ${language === lang ? `${GOLD}40` : `${GOLD}15`}`,
                  }}
                >
                  {lang === 'en' ? 'EN' : lang === 'ms' ? 'BM' : 'ZH'}
                </button>
              ))}
            </div>

            <button
              onClick={() => { playMenuSelect(); onLogout(); }}
              className="w-full text-center text-[10px] py-1.5 rounded-lg transition-all"
              style={{
                color: `${PARCHMENT}75`,
                border: `1px solid ${GOLD}10`,
                fontFamily: "'Cinzel Decorative', serif",
              }}
            >
              {t('menu.logout')}
            </button>
          </>
        ) : (
          <button
            onClick={() => { playMenuSelect(); onLogout(); }}
            className="w-full flex justify-center py-2 rounded-lg transition-all"
            style={{ color: `${PARCHMENT}65` }}
            title={t('menu.logout')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { X, Swords, Coins, ScrollText, ShieldCheck, BookOpen, Music, Layers, Gamepad2, GraduationCap, Trophy, ChevronDown, Compass, Castle, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';
import { updateParentProfile } from '../../utils/parent-api';

export type ParentPage = 'game' | 'mastery' | 'library' | 'audio' | 'flashcards' | 'earnings' | 'plan' | 'account' | 'training' | 'quest';

interface MenuItem {
  id: ParentPage;
  labelKey: string;
  sublabelKey: string;
  icon: LucideIcon;
  children?: SubMenuItem[];
}

interface SubMenuItem {
  id: ParentPage;
  labelKey: string;
  sublabelKey: string;
  icon: LucideIcon;
}

const GAME_CHILDREN: SubMenuItem[] = [
  { id: 'flashcards', labelKey: 'menu.flashcards', sublabelKey: 'menu.flashcards.sub', icon: Layers },
  { id: 'training', labelKey: 'menu.training', sublabelKey: 'menu.training.sub', icon: GraduationCap },
  { id: 'library', labelKey: 'menu.library', sublabelKey: 'menu.library.sub', icon: BookOpen },
  { id: 'audio', labelKey: 'menu.audio', sublabelKey: 'menu.audio.sub', icon: Music },
  { id: 'quest', labelKey: 'menu.quest', sublabelKey: 'menu.quest.sub', icon: Trophy },
];

const MENU_ITEMS: MenuItem[] = [
  { id: 'game', labelKey: 'menu.game', sublabelKey: 'menu.game.sub', icon: Swords },
  // "Game" expandable parent — id is a placeholder; children handle navigation
  { id: 'flashcards' /* not used directly */, labelKey: 'menu.gameParent', sublabelKey: 'menu.gameParent.sub', icon: Gamepad2, children: GAME_CHILDREN },
];

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

// Pages that belong to the Game expandable group
const GAME_SUB_IDS: ParentPage[] = ['flashcards', 'library', 'audio', 'training', 'quest'];

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
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [gameExpanded, setGameExpanded] = useState(() => GAME_SUB_IDS.includes(activePage as any));
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-expand Game group when a sub-page is active
  useEffect(() => {
    if (GAME_SUB_IDS.includes(activePage)) {
      setGameExpanded(true);
    }
  }, [activePage]);

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

  const handleGoToRealm = () => {
    playMenuSelect();
    if (isMobile) setIsExpanded(false);
    navigate('/realm');
  };

  // Language change handler — update context AND persist to server
  const handleLanguageSwitch = (lang: string) => {
    playMenuSelect();
    onLanguageChange(lang);
    updateParentProfile({ language: lang }).catch((err) => {
      console.warn('[SIDEMENU] Failed to persist language to server:', err);
    });
  };

  const toggleGameGroup = () => {
    playMenuSelect();
    setGameExpanded((prev) => !prev);
  };

  /** Render a single menu item button (top-level or sub-item) */
  const renderMenuButton = (
    id: ParentPage,
    labelKey: string,
    sublabelKey: string,
    Icon: LucideIcon,
    opts?: { isSub?: boolean; showExpanded?: boolean; iconSize?: number }
  ) => {
    const isSub = opts?.isSub ?? false;
    const showExpanded = opts?.showExpanded ?? true;
    const iconSize = opts?.iconSize ?? (isSub ? 28 : 36);
    const isActive = activePage === id;

    return (
      <button
        key={id}
        onClick={() => handleNav(id)}
        className={`w-full flex items-center rounded-xl transition-all duration-200 group relative ${
          showExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-3'
        } ${isSub ? 'pl-6' : ''}`}
        style={{
          background: isActive
            ? `linear-gradient(90deg, ${GOLD}18, transparent)`
            : 'transparent',
        }}
        title={!showExpanded ? t(labelKey) : undefined}
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

        <RPGIcon Icon={Icon} size={iconSize} isActive={isActive} />

        {showExpanded && (
          <div className="text-left overflow-hidden">
            <p
              className={`font-bold leading-tight truncate transition-colors ${isSub ? 'text-[12px]' : 'text-[13px]'}`}
              style={{
                fontFamily: "'Cinzel Decorative', serif",
                color: isActive ? GOLD_LIGHT : `${PARCHMENT}90`,
                textShadow: isActive ? `0 0 8px ${GOLD}30` : 'none',
              }}
            >
              {t(labelKey)}
            </p>
            <p
              className="text-[10px] mt-0.5 leading-tight truncate"
              style={{ color: isActive ? `${PARCHMENT}90` : `${PARCHMENT}65` }}
            >
              {t(sublabelKey)}
            </p>
          </div>
        )}
      </button>
    );
  };

  /** Render the expandable Game parent button */
  const renderGameParent = (item: MenuItem, showExpanded: boolean) => {
    const hasActiveSub = GAME_SUB_IDS.includes(activePage);

    return (
      <div key="game-parent">
        <button
          onClick={toggleGameGroup}
          className={`w-full flex items-center rounded-xl transition-all duration-200 group relative ${
            showExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-3'
          }`}
          style={{
            background: hasActiveSub && !gameExpanded
              ? `linear-gradient(90deg, ${GOLD}10, transparent)`
              : 'transparent',
          }}
          title={!showExpanded ? t(item.labelKey) : undefined}
        >
          {/* Active indicator when a child is selected but group is collapsed */}
          {hasActiveSub && !gameExpanded && (
            <div
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
              style={{
                background: `linear-gradient(180deg, ${GOLD}, ${GOLD_LIGHT})`,
                boxShadow: `0 0 8px ${GOLD}60`,
              }}
            />
          )}

          <RPGIcon Icon={item.icon} size={36} isActive={hasActiveSub} />

          {showExpanded && (
            <>
              <div className="text-left overflow-hidden flex-1">
                <p
                  className="text-[13px] font-bold leading-tight truncate transition-colors"
                  style={{
                    fontFamily: "'Cinzel Decorative', serif",
                    color: hasActiveSub ? GOLD_LIGHT : `${PARCHMENT}90`,
                    textShadow: hasActiveSub ? `0 0 8px ${GOLD}30` : 'none',
                  }}
                >
                  {t(item.labelKey)}
                </p>
                <p
                  className="text-[10px] mt-0.5 leading-tight truncate"
                  style={{ color: hasActiveSub ? `${PARCHMENT}90` : `${PARCHMENT}65` }}
                >
                  {t(item.sublabelKey)}
                </p>
              </div>
              <ChevronDown
                className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                style={{
                  color: `${PARCHMENT}60`,
                  transform: gameExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </>
          )}
        </button>

        {/* Sub-items — collapsible */}
        {showExpanded && (
          <div
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: gameExpanded ? `${GAME_CHILDREN.length * 56}px` : '0px',
              opacity: gameExpanded ? 1 : 0,
            }}
          >
            {GAME_CHILDREN.map((sub) =>
              renderMenuButton(sub.id, sub.labelKey, sub.sublabelKey, sub.icon, {
                isSub: true,
                showExpanded: true,
                iconSize: 28,
              })
            )}
          </div>
        )}
      </div>
    );
  };

  /** Render the "Back to Realm" button */
  const renderRealmButton = (showExpanded: boolean) => (
    <button
      onClick={handleGoToRealm}
      className={`w-full flex items-center rounded-xl transition-all duration-200 group relative ${
        showExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center py-3'
      }`}
      style={{
        background: `linear-gradient(90deg, rgba(74,222,128,0.08), transparent)`,
        marginTop: 4,
      }}
      title={!showExpanded ? t('menu.realm') : undefined}
    >
      <RPGIcon Icon={Castle} size={36} isActive={false} />
      {showExpanded && (
        <div className="text-left overflow-hidden">
          <p
            className="text-[13px] font-bold leading-tight truncate"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              color: '#4ade80',
              textShadow: '0 0 8px rgba(74,222,128,0.3)',
            }}
          >
            {t('menu.realm')}
          </p>
          <p
            className="text-[10px] mt-0.5 leading-tight truncate"
            style={{ color: `${PARCHMENT}65` }}
          >
            {t('menu.realm.sub')}
          </p>
        </div>
      )}
    </button>
  );

  /** Render full nav (shared between mobile and desktop) */
  const renderNav = (showExpanded: boolean) => (
    <nav className="flex-1 px-2 py-1 overflow-y-auto">
      {MENU_ITEMS.map((item) => {
        if (item.children) {
          return renderGameParent(item, showExpanded);
        }
        return renderMenuButton(item.id, item.labelKey, item.sublabelKey, item.icon, {
          showExpanded,
        });
      })}

      {/* Divider before realm button */}
      <div className="flex items-center gap-2 my-2 px-1">
        <div className="flex-1 h-px" style={{ background: `${GOLD}15` }} />
      </div>

      {/* Back to Realm */}
      {renderRealmButton(showExpanded)}
    </nav>
  );

  /** Render language switcher */
  const renderLanguageSwitcher = () => (
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
  );

  // ===== MOBILE: Floating button + overlay =====
  if (isMobile) {
    return (
      <>
        {/* Floating menu trigger */}
        <button
          onClick={() => { playMenuSelect(); setIsExpanded(true); }}
          className="fixed top-4 left-4 z-[70] w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #2a1f0e 0%, #3d2b14 100%)',
            border: `2px solid ${GOLD}66`,
            boxShadow: `0 0 15px ${GOLD}20, 0 4px 12px rgba(0,0,0,0.4)`,
          }}
        >
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
                <button
                  onClick={() => { playMenuSelect(); setIsExpanded(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
                >
                  <X className="w-4 h-4" style={{ color: `${GOLD}80` }} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${GOLD}40, transparent)` }} />
                <div className="w-1.5 h-1.5 rotate-45" style={{ background: `${GOLD}60` }} />
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, ${GOLD}40, transparent)` }} />
              </div>
            </div>

            {/* Menu items */}
            {renderNav(true)}

            {/* Footer */}
            <div className="px-5 pb-5 pt-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
                <div className="w-1 h-1 rotate-45" style={{ background: `${GOLD}40` }} />
                <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
              </div>

              {renderLanguageSwitcher()}

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

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: `${GOLD}30` }} />
          {isExpanded && <div className="w-1.5 h-1.5 rotate-45" style={{ background: `${GOLD}50` }} />}
          <div className="flex-1 h-px" style={{ background: `${GOLD}30` }} />
        </div>
      </div>

      {/* Menu items */}
      {renderNav(isExpanded)}

      {/* Footer */}
      <div className={`pb-4 pt-2 ${isExpanded ? 'px-4' : 'px-2'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
        </div>

        {isExpanded ? (
          <>
            {renderLanguageSwitcher()}
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

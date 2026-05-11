/**
 * SettingsPopup.tsx — Dark fantasy RPG settings menu overlay
 *
 * Shows 3 navigation items: Earning, Account, Billing
 * Plus a trilingual language selector (EN / BM / ZH)
 * Styled to match the realm's dark-fantasy gold aesthetic.
 *
 * Language changes now:
 *  1. Update React context (immediate UI change)
 *  2. Persist to localStorage (survives refresh)
 *  3. Persist to server via updateParentProfile (survives across devices)
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserCircle, CreditCard, Heart, X, Globe } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLanguage, type Language } from '../LanguageContext';
import { updateParentProfile } from '../../utils/parent-api';

const F = "'Cherry Bomb One', cursive";

const LANG_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ms', label: 'BM', flag: '🇲🇾' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPopup({ isOpen, onClose }: SettingsPopupProps) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = (route: string) => {
    onClose();
    setTimeout(() => navigate(route), 200);
  };

  const handleLanguageChange = (code: Language) => {
    setLanguage(code);
    // Persist to server (fire-and-forget)
    updateParentProfile({ language: code }).catch((err) => {
      console.warn('[SETTINGS_POPUP] Failed to persist language to server:', err);
    });
  };

  // Menu items with translated labels — reordered: Account → Billing → Refer a Friend
  const menuItems = [
    {
      labelKey: 'settings.account',
      icon: <UserCircle size={22} />,
      route: '/account',
      color: '#60a5fa',
      glowColor: 'rgba(96,165,250,0.3)',
    },
    {
      labelKey: 'settings.billing',
      icon: <CreditCard size={22} />,
      route: '/plan',
      color: '#a855f7',
      glowColor: 'rgba(168,85,247,0.3)',
    },
    {
      labelKey: 'settings.referFriend',
      icon: <Heart size={22} />,
      route: '/earnings',
      color: '#f472b6',
      glowColor: 'rgba(244,114,182,0.3)',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* Dark backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'rgba(5,4,2,0.7)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Popup panel */}
          <motion.div
            className="relative z-10"
            style={{
              width: 280,
              background: 'linear-gradient(145deg, rgba(28,22,12,0.96) 0%, rgba(15,12,6,0.98) 100%)',
              border: '2px solid rgba(255,215,0,0.2)',
              borderRadius: 20,
              padding: '20px 16px 16px',
              boxShadow:
                '0 12px 48px rgba(0,0,0,0.7), 0 0 24px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
            initial={{ scale: 0.7, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative corner accents */}
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
              <div
                key={i}
                className={`absolute ${pos} w-3 h-3 pointer-events-none`}
                style={{
                  borderTop: pos.includes('top') ? '1px solid rgba(255,215,0,0.2)' : 'none',
                  borderBottom: pos.includes('bottom') ? '1px solid rgba(255,215,0,0.2)' : 'none',
                  borderLeft: pos.includes('left') ? '1px solid rgba(255,215,0,0.2)' : 'none',
                  borderRight: pos.includes('right') ? '1px solid rgba(255,215,0,0.2)' : 'none',
                  borderRadius: 3,
                }}
              />
            ))}

            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <span
                style={{
                  fontFamily: F,
                  fontSize: 16,
                  color: '#ffd700',
                  textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)',
                }}
              >
                {t('settings.title')}
              </span>
              <motion.button
                onClick={onClose}
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileTap={{ scale: 0.85 }}
              >
                <X size={14} color="rgba(200,184,138,0.7)" />
              </motion.button>
            </div>

            {/* Divider line */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)',
              }}
            />

            {/* ── Language Selector ── */}
            <div className="mb-3 px-1">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} color="rgba(200,184,138,0.6)" />
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 11,
                    color: 'rgba(200,184,138,0.7)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('settings.language')}
                </span>
              </div>
              <div className="flex gap-2">
                {LANG_OPTIONS.map((lang) => {
                  const isActive = language === lang.code;
                  return (
                    <motion.button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className="flex-1 flex items-center justify-center gap-1.5"
                      style={{
                        padding: '7px 0',
                        borderRadius: 12,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.06))'
                          : 'rgba(255,255,255,0.03)',
                        border: isActive
                          ? '1.5px solid rgba(255,215,0,0.4)'
                          : '1.5px solid rgba(255,255,255,0.08)',
                        boxShadow: isActive
                          ? '0 0 12px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : 'none',
                        transition: 'all 0.2s ease',
                      }}
                      whileTap={{ scale: 0.93 }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{lang.flag}</span>
                      <span
                        style={{
                          fontFamily: F,
                          fontSize: 12,
                          color: isActive ? '#ffd700' : 'rgba(200,184,138,0.5)',
                          textShadow: isActive
                            ? '0 0 8px rgba(255,215,0,0.3)'
                            : 'none',
                          lineHeight: 1,
                        }}
                      >
                        {lang.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)',
              }}
            />

            {/* Menu items */}
            <div className="flex flex-col gap-2">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.labelKey}
                  onClick={() => handleSelect(item.route)}
                  className="flex items-center gap-3 w-full text-left"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                    border: `1.5px solid ${item.glowColor.replace('0.3', '0.12')}`,
                    transition: 'border-color 0.2s',
                  }}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, type: 'spring', stiffness: 300, damping: 20 }}
                  whileTap={{ scale: 0.96 }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)';
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${item.glowColor.replace('0.3', '0.15')}, ${item.glowColor.replace('0.3', '0.05')})`,
                      border: `1px solid ${item.glowColor.replace('0.3', '0.2')}`,
                      color: item.color,
                      boxShadow: `0 0 12px ${item.glowColor.replace('0.3', '0.1')}`,
                    }}
                  >
                    {item.icon}
                  </div>

                  {/* Label */}
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 14,
                      color: item.color,
                      textShadow: `0 1px 4px rgba(0,0,0,0.8), 0 0 8px ${item.glowColor.replace('0.3', '0.15')}`,
                      lineHeight: 1.2,
                    }}
                  >
                    {t(item.labelKey)}
                  </span>

                  {/* Arrow */}
                  <div className="flex-1" />
                  <svg viewBox="0 0 16 16" width={14} height={14} style={{ opacity: 0.35, color: item.color }}>
                    <path
                      d="M6 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.button>
              ))}
            </div>

            {/* Bottom decorative line */}
            <div
              className="mt-3"
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)',
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
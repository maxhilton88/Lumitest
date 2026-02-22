import React, { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { deleteParentAccount, updateParentProfile } from '../../utils/parent-api';
import { parentAuthClient } from '../../utils/supabase-client';
import { Volume2, VolumeX, Pencil, Save, X, Eye, EyeOff } from 'lucide-react';
import {
  isMusicEnabled,
  toggleMusic,
  subscribe as subscribeMusicState,
} from '../../utils/music-service';
import { useLanguage } from '../LanguageContext';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface AccountProfileProps {
  parentData: any;
  childName: string;
  childAge: number;
  language: string;
  onLanguageChange: (lang: string) => void;
  onLogout: () => void;
  includeMandarinTest: boolean;
  onMandarinToggle: (val: boolean) => void;
  onProfileSaved?: () => void;
}

export const AccountProfile: React.FC<AccountProfileProps> = ({
  parentData,
  childName,
  childAge,
  language,
  onLanguageChange,
  onLogout,
  includeMandarinTest,
  onMandarinToggle,
  onProfileSaved,
}) => {
  const email = parentData?.email || '';
  const name = parentData?.name || '';
  const originTag = parentData?.origin_tag || null;
  const provider = parentData?.provider || 'email';

  // ── Edit mode state ──
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(parentData?.phone || '');
  const [editChildName, setEditChildName] = useState(childName || parentData?.child_name || '');
  const [editChildAge, setEditChildAge] = useState<number>(childAge || parentData?.child_age || 5);
  const [isSaving, setIsSaving] = useState(false);

  // ── Change password state ──
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // ── Delete account state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Music state ──
  const [musicOn, setMusicOn] = useState(isMusicEnabled());

  // Subscribe to music state changes so the toggle stays in sync
  React.useEffect(() => {
    return subscribeMusicState((playing) => {
      setMusicOn(isMusicEnabled());
    });
  }, []);

  // Reset edit fields when parentData changes (e.g. after save + refresh)
  React.useEffect(() => {
    if (!isEditing) {
      setEditName(parentData?.name || '');
      setEditPhone(parentData?.phone || '');
      setEditChildName(parentData?.child_name || childName || '');
      setEditChildAge(parentData?.child_age || childAge || 5);
    }
  }, [parentData, childName, childAge, isEditing]);

  const handleStartEdit = () => {
    playMenuSelect();
    setEditName(name);
    setEditPhone(parentData?.phone || '');
    setEditChildName(childName || parentData?.child_name || '');
    setEditChildAge(childAge || parentData?.child_age || 5);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    playMenuSelect();
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    playMenuSelect();
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (editName !== name) updates.name = editName;
      if (editPhone !== (parentData?.phone || '')) updates.phone = editPhone;
      if (editChildName !== (parentData?.child_name || '')) updates.child_name = editChildName;
      if (editChildAge !== (parentData?.child_age || 5)) updates.child_age = editChildAge;

      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save');
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      await updateParentProfile(updates);
      toast.success('Profile updated!');
      setIsEditing(false);
      onProfileSaved?.();
    } catch (err) {
      console.error('[ACCOUNT] Save profile error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageSelect = async (langCode: string) => {
    playMenuSelect();
    onLanguageChange(langCode);
    // Persist language preference to server
    try {
      await updateParentProfile({ language: langCode });
      console.log('[ACCOUNT] Language preference persisted:', langCode);
    } catch (err) {
      console.warn('[ACCOUNT] Failed to persist language to server:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await parentAuthClient.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        console.error('[ACCOUNT] Change password error:', error);
        toast.error(`Failed to change password: ${error.message}`);
        return;
      }
      toast.success('Password updated successfully!');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error('[ACCOUNT] Change password exception:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    setIsDeleting(true);
    try {
      await deleteParentAccount();
      toast.success('Account deleted. Farewell, adventurer!');
      onLogout();
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">{t('menu.account')}</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {t('menu.account.sub')}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Parent Info */}
      <FantasyPanel className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            {/* Avatar placeholder */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px dashed ${GOLD}44`,
                background: `${GOLD}08`,
                boxShadow: `0 0 15px ${GOLD}10`,
              }}
            >
              <span className="text-2xl">🛡</span>
            </div>
            <div>
              <h3
                className="text-base font-bold"
                style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
              >
                {name || 'Parent'}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}90` }}>{email}</p>
              {provider !== 'email' && (
                <div
                  className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: `${GOLD}10`,
                    border: `1px solid ${GOLD}20`,
                    color: `${PARCHMENT}70`,
                  }}
                >
                  {provider === 'google' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {provider === 'facebook' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  )}
                  via {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </div>
              )}
            </div>
          </div>

          {/* Edit toggle button */}
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.05] active:scale-[0.95]"
              style={{
                background: `${GOLD}15`,
                border: `1px solid ${GOLD}30`,
                color: GOLD,
                fontFamily: "'Cinzel Decorative', serif",
              }}
            >
              <Pencil className="w-3 h-3" />
              {t('account.edit')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.05] active:scale-[0.95]"
                style={{
                  background: 'rgba(231,76,60,0.1)',
                  border: '1px solid rgba(231,76,60,0.2)',
                  color: 'rgba(231,76,60,0.7)',
                }}
              >
                <X className="w-3 h-3" />
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 100%)`,
                  border: `1.5px solid ${GOLD_LIGHT}`,
                  color: '#2a1f0e',
                  fontFamily: "'Cinzel Decorative', serif",
                  boxShadow: `0 2px 0 #a67c2e`,
                }}
              >
                <Save className="w-3 h-3" />
                {isSaving ? t('account.saving') : t('account.save')}
              </button>
            </div>
          )}
        </div>

        {/* Info rows — toggle between display and edit */}
        <div className="space-y-3">
          {isEditing ? (
            <>
              <EditableRow label={t('account.name')} value={editName} onChange={setEditName} />
              <InfoRow label={t('account.email')} value={email || '\u2014'} />
              <EditableRow label="Phone" value={editPhone} onChange={setEditPhone} placeholder="e.g. +60123456789" />
            </>
          ) : (
            <>
              <InfoRow label={t('account.name')} value={name || '\u2014'} />
              <InfoRow label={t('account.email')} value={email || '\u2014'} />
              <InfoRow label="Phone" value={parentData?.phone || '\u2014'} />
            </>
          )}
        </div>
      </FantasyPanel>

      {/* Child Profile */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-4"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          {t('account.childDetails')}
        </h3>

        {isEditing ? (
          <div className="space-y-3">
            <EditableRow label={t('account.childNameLabel')} value={editChildName} onChange={setEditChildName} placeholder="Your child's name" />
            <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${GOLD}08` }}>
              <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{t('account.childAgeLabel')}</span>
              <select
                value={editChildAge}
                onChange={(e) => setEditChildAge(Number(e.target.value))}
                className="text-xs font-medium px-2 py-1 rounded-lg focus:outline-none"
                style={{
                  background: `${GOLD}10`,
                  border: `1px solid ${GOLD}30`,
                  color: GOLD_LIGHT,
                }}
              >
                {[3, 4, 5, 6, 7, 8].map((age) => (
                  <option key={age} value={age} style={{ background: '#1a1a2e', color: PARCHMENT }}>
                    {age} years
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}12` }}>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${GOLD}40`,
                background: `${GOLD}10`,
              }}
            >
              <span className="text-xl">🦊</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>
                {childName || parentData?.child_name || 'Young Explorer'}
              </p>
              <p className="text-[11px]" style={{ color: `${PARCHMENT}80` }}>
                Age {childAge || parentData?.child_age || '?'} {t('account.yearsOld')}
              </p>
            </div>
          </div>
        )}

        <p className="text-[10px] mt-3" style={{ color: `${PARCHMENT}60` }}>
          Multiple child profiles coming soon
        </p>
      </FantasyPanel>

      {/* Origin Kindergarten */}
      {originTag && (
        <FantasyPanel className="p-5">
          <h3
            className="text-sm font-bold mb-3"
            style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
          >
            {t('account.kindergarten')}
          </h3>
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}12` }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ border: `1.5px dashed ${GOLD}30`, background: `${GOLD}08` }}
            >
              <span className="text-base">🏫</span>
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>{originTag}</p>
              <p className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>
                {t('account.recruitedFrom')}
              </p>
            </div>
          </div>
        </FantasyPanel>
      )}

      {/* Language Preference */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-3"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          {t('account.languagePref')}
        </h3>
        <div className="flex items-center gap-2">
          {[
            { code: 'en', label: 'English' },
            { code: 'ms', label: 'Bahasa Melayu' },
            { code: 'zh', label: '中文' },
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: language === lang.code ? `${GOLD}20` : 'transparent',
                color: language === lang.code ? GOLD_LIGHT : `${PARCHMENT}80`,
                border: `1.5px solid ${language === lang.code ? `${GOLD}40` : `${GOLD}15`}`,
                fontFamily: "'Cinzel Decorative', serif",
                boxShadow: language === lang.code ? `0 0 10px ${GOLD}15` : 'none',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </FantasyPanel>

      {/* Mandarin Quest Toggle */}
      <FantasyPanel className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <h3
              className="text-sm font-bold"
              style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
            >
              {t('account.mandarinQuest')}
            </h3>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: `${PARCHMENT}80` }}>
              {t('account.mandarinDesc')}
            </p>
          </div>

          {/* Custom RPG-styled toggle switch */}
          <button
            onClick={() => { playMenuSelect(); onMandarinToggle(!includeMandarinTest); }}
            className="relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
            style={{
              background: includeMandarinTest
                ? `linear-gradient(135deg, ${GOLD} 0%, #f0d078 100%)`
                : `rgba(200,184,138,0.12)`,
              border: `2px solid ${includeMandarinTest ? GOLD_LIGHT : `${GOLD}25`}`,
              boxShadow: includeMandarinTest
                ? `0 0 12px ${GOLD}30, inset 0 1px 0 rgba(255,255,255,0.2)`
                : `inset 0 1px 3px rgba(0,0,0,0.3)`,
            }}
            aria-label="Toggle Mandarin Quest"
            role="switch"
            aria-checked={includeMandarinTest}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center text-[10px]"
              style={{
                left: includeMandarinTest ? 'calc(100% - 24px)' : '2px',
                background: includeMandarinTest
                  ? '#2a1f0e'
                  : `${PARCHMENT}50`,
                boxShadow: includeMandarinTest
                  ? `0 2px 4px rgba(0,0,0,0.3)`
                  : `0 1px 2px rgba(0,0,0,0.2)`,
              }}
            >
              {includeMandarinTest ? '中' : ''}
            </div>
          </button>
        </div>

        {/* Status indicator */}
        <div
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: includeMandarinTest ? `${GOLD}08` : 'transparent',
            border: `1px solid ${includeMandarinTest ? `${GOLD}20` : `${GOLD}08`}`,
          }}
        >
          <span className="text-sm">{includeMandarinTest ? '✨' : '💤'}</span>
          <span className="text-[11px] font-medium" style={{
            color: includeMandarinTest ? GOLD_LIGHT : `${PARCHMENT}60`,
          }}>
            {includeMandarinTest
              ? 'Mandarin quest is active — 5 quests per assessment'
              : 'Mandarin quest is off — 4 quests per assessment'}
          </span>
        </div>
      </FantasyPanel>

      {/* Background Music Toggle */}
      <FantasyPanel className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <h3
              className="text-sm font-bold"
              style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
            >
              {t('account.bgMusic')}
            </h3>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: `${PARCHMENT}80` }}>
              {t('account.bgMusicDesc')}
            </p>
          </div>

          {/* RPG-styled toggle */}
          <button
            onClick={() => { playMenuSelect(); toggleMusic(); setMusicOn(!musicOn); }}
            className="relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
            style={{
              background: musicOn
                ? `linear-gradient(135deg, ${GOLD} 0%, #f0d078 100%)`
                : `rgba(200,184,138,0.12)`,
              border: `2px solid ${musicOn ? GOLD_LIGHT : `${GOLD}25`}`,
              boxShadow: musicOn
                ? `0 0 12px ${GOLD}30, inset 0 1px 0 rgba(255,255,255,0.2)`
                : `inset 0 1px 3px rgba(0,0,0,0.3)`,
            }}
            aria-label="Toggle Background Music"
            role="switch"
            aria-checked={musicOn}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center"
              style={{
                left: musicOn ? 'calc(100% - 24px)' : '2px',
                background: musicOn ? '#2a1f0e' : `${PARCHMENT}50`,
                boxShadow: musicOn
                  ? `0 2px 4px rgba(0,0,0,0.3)`
                  : `0 1px 2px rgba(0,0,0,0.2)`,
              }}
            >
              {musicOn
                ? <Volume2 className="w-3 h-3" style={{ color: GOLD_LIGHT }} />
                : <VolumeX className="w-3 h-3" style={{ color: `${PARCHMENT}90` }} />
              }
            </div>
          </button>
        </div>

        {/* Status indicator */}
        <div
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: musicOn ? `${GOLD}08` : 'transparent',
            border: `1px solid ${musicOn ? `${GOLD}20` : `${GOLD}08`}`,
          }}
        >
          <span className="text-sm">{musicOn ? '🎵' : '🔇'}</span>
          <span className="text-[11px] font-medium" style={{
            color: musicOn ? GOLD_LIGHT : `${PARCHMENT}60`,
          }}>
            {musicOn
              ? 'Quest music is playing'
              : 'Music is off'}
          </span>
        </div>
      </FantasyPanel>

      {/* Change Password (only for email provider) */}
      {provider === 'email' && (
        <FantasyPanel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-sm font-bold"
              style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
            >
              {t('account.changePassword')}
            </h3>
            {!showChangePassword && (
              <button
                onClick={() => { playMenuSelect(); setShowChangePassword(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.05] active:scale-[0.95]"
                style={{
                  background: `${GOLD}15`,
                  border: `1px solid ${GOLD}30`,
                  color: GOLD,
                  fontFamily: "'Cinzel Decorative', serif",
                }}
              >
                Change
              </button>
            )}
          </div>

          {showChangePassword ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  required
                  minLength={6}
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all pr-10"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${GOLD}30`,
                    color: GOLD_LIGHT,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: `${GOLD}50` }}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${GOLD}30`,
                    color: GOLD_LIGHT,
                  }}
                />
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(231,76,60,0.8)' }}>
                    Passwords do not match
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playMenuSelect();
                    setShowChangePassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'transparent',
                    border: `1.5px solid ${GOLD}15`,
                    color: `${PARCHMENT}80`,
                    fontFamily: "'Cinzel Decorative', serif",
                  }}
                >
                  {t('account.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 100%)`,
                    border: `1.5px solid ${GOLD_LIGHT}`,
                    color: '#2a1f0e',
                    fontFamily: "'Cinzel Decorative', serif",
                    boxShadow: `0 2px 0 #a67c2e`,
                  }}
                >
                  {isChangingPassword ? t('account.updating') : t('account.updatePassword')}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-[11px]" style={{ color: `${PARCHMENT}70` }}>
              {t('account.changePasswordDesc')}
            </p>
          )}
        </FantasyPanel>
      )}

      {/* Notification Settings placeholder */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-2"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          Notifications
        </h3>
        <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
          Notification preferences coming soon.
        </p>
      </FantasyPanel>

      {/* Logout */}
      <button
        onClick={() => { playMenuSelect(); onLogout(); }}
        className="w-full py-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          background: 'rgba(231,76,60,0.1)',
          border: '1.5px solid rgba(231,76,60,0.2)',
          color: 'rgba(231,76,60,0.7)',
        }}
      >
        {t('menu.logout')}
      </button>

      {/* Delete Account */}
      <button
        onClick={() => { playMenuSelect(); setShowDeleteConfirm(true); }}
        className="w-full py-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          background: '#e74c3c',
          border: '1.5px solid #c0392b',
          color: '#ffeaa7',
        }}
      >
        {t('account.deleteAccount')}
      </button>

      {/* Delete Account Confirmation */}
      {showDeleteConfirm && (
        <FantasyPanel className="p-5">
          <h3
            className="text-sm font-bold mb-3"
            style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
          >
            Confirm Delete Account
          </h3>
          <p className="text-[11px] leading-relaxed" style={{ color: `${PARCHMENT}80` }}>
            Type <strong>DELETE</strong> in the box below to confirm account deletion. This action is irreversible.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
            className="w-full mt-3 py-2.5 px-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'transparent',
              color: `${PARCHMENT}80`,
              border: `1.5px solid ${GOLD}15`,
              fontFamily: "'Cinzel Decorative', serif",
              boxShadow: 'none',
            }}
            placeholder="DELETE"
          />
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => { playMenuSelect(); setShowDeleteConfirm(false); }}
              className="py-2.5 px-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'transparent',
                color: `${PARCHMENT}80`,
                border: `1.5px solid ${GOLD}15`,
                fontFamily: "'Cinzel Decorative', serif",
                boxShadow: 'none',
              }}
            >
              {t('account.cancel')}
            </button>
            <button
              onClick={handleDeleteAccount}
              className="py-2.5 px-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: isDeleting ? 'rgba(231,76,60,0.1)' : `${GOLD}20`,
                color: isDeleting ? 'rgba(231,76,60,0.7)' : GOLD_LIGHT,
                border: isDeleting ? '1.5px solid rgba(231,76,60,0.2)' : `1.5px solid ${GOLD}40`,
                fontFamily: "'Cinzel Decorative', serif",
                boxShadow: isDeleting ? 'none' : `0 0 10px ${GOLD}15`,
              }}
              disabled={isDeleting}
            >
              {isDeleting ? t('account.deleting') : t('account.deleteAccount')}
            </button>
          </div>
        </FantasyPanel>
      )}
    </div>
  );
};

// ── Helper components ──

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${GOLD}08` }}>
      <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: PARCHMENT }}>{value}</span>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${GOLD}08` }}>
      <span className="text-xs flex-shrink-0 mr-3" style={{ color: `${PARCHMENT}80` }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="text-xs font-medium text-right px-2 py-1 rounded-lg flex-1 max-w-[200px] focus:outline-none transition-all"
        style={{
          background: `${GOLD}10`,
          border: `1px solid ${GOLD}30`,
          color: GOLD_LIGHT,
        }}
      />
    </div>
  );
}
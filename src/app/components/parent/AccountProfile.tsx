import React, { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { FantasyPanel, FantasyTitle, GoldOrnament } from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { deleteParentAccount, updateParentProfile, connectToKG, disconnectFromKG, fetchKGInfo } from '../../utils/parent-api';
import { parentAuthClient } from '../../utils/supabase-client';
import {
  Volume2, VolumeX, Pencil, Save, X, Eye, EyeOff,
  Link2, Unlink, Loader2, School, Lock, Bell, LogOut, Trash2,
} from 'lucide-react';
import { isMusicEnabled, toggleMusic, subscribe as subscribeMusicState } from '../../utils/music-service';
import { useLanguage } from '../LanguageContext';
import { KGFinder } from './KGFinder';
import { deriveLevelFromBirthdate, getBirthdateBounds, isBirthdateInRange, formatBirthdate, getSchoolAge } from '../../utils/level-utils';
import { SUBJECTS, type SubjectCode } from '../../data/kssr-taxonomy';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const DIM = `${PARCHMENT}60`;
const PANEL_BG = `${GOLD}07`;
const PANEL_BORDER = `${GOLD}18`;

interface AccountProfileProps {
  parentData: any;
  childName: string;
  childAge: number;
  language: string;
  onLanguageChange: (lang: string) => void;
  onLogout: () => void;
  excludedSubjects?: string[];
  onExcludedSubjectsChange?: (subjects: string[]) => void;
  onProfileSaved?: () => void;
}

// ─── Reusable row ──────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${GOLD}0f` }}>
    <span className="text-[11px]" style={{ color: DIM }}>{label}</span>
    <span className="text-[12px] font-medium" style={{ color: `${PARCHMENT}cc` }}>{value}</span>
  </div>
);

const EditRow: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({
  label, value, onChange, placeholder = '', type = 'text',
}) => (
  <div className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${GOLD}0f` }}>
    <span className="text-[11px] flex-shrink-0" style={{ color: DIM }}>{label}</span>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 text-right text-[12px] font-medium bg-transparent focus:outline-none"
      style={{ color: GOLD_LIGHT, caretColor: GOLD }}
    />
  </div>
);

// ─── Slim toggle row ──────────────────────────────────────────────────────────
const ToggleRow: React.FC<{
  label: string; desc?: string; icon: React.ReactNode; on: boolean; onToggle: () => void;
}> = ({ label, desc, icon, on, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-3 py-3 text-left transition-opacity hover:opacity-80"
    style={{ borderBottom: `1px solid ${GOLD}0f` }}
  >
    <span style={{ color: on ? GOLD : DIM, flexShrink: 0 }}>{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-semibold leading-tight" style={{ color: on ? GOLD_LIGHT : `${PARCHMENT}90` }}>{label}</p>
      {desc && <p className="text-[10px] mt-0.5" style={{ color: DIM }}>{desc}</p>}
    </div>
    {/* Pill toggle */}
    <div
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-300"
      style={{
        background: on ? `linear-gradient(135deg, ${GOLD}, #f0d078)` : 'rgba(255,255,255,0.07)',
        border: `1.5px solid ${on ? GOLD_LIGHT : `${GOLD}22`}`,
        boxShadow: on ? `0 0 10px ${GOLD}35` : 'none',
      }}
    >
      <div
        className="absolute top-[3px] w-[16px] h-[16px] rounded-full transition-all duration-300"
        style={{
          left: on ? 'calc(100% - 19px)' : '3px',
          background: on ? '#2a1f0e' : `${PARCHMENT}55`,
        }}
      />
    </div>
  </button>
);

// ─── Section header ───────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[9px] font-bold tracking-[0.15em] mb-2" style={{ color: `${PARCHMENT}40` }}>
    {String(children).toUpperCase()}
  </p>
);

// ─── Main component ───────────────────────────────────────────────────────────
export const AccountProfile: React.FC<AccountProfileProps> = ({
  parentData, childName, childAge, language, onLanguageChange,
  onLogout, excludedSubjects = [], onExcludedSubjectsChange, onProfileSaved,
}) => {
  const email = parentData?.email || '';
  const name = parentData?.name || '';
  const provider = parentData?.provider || 'email';
  const originTag = parentData?.origin_tag || null;

  // Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(parentData?.phone || '');
  const [editChildName, setEditChildName] = useState(childName || parentData?.child_name || '');
  const [editChildAge, setEditChildAge] = useState<number>(childAge || parentData?.child_age || 5);
  const [editBirthdate, setEditBirthdate] = useState<string>(parentData?.child_birthdate || '');
  const [editExcludedSubjects, setEditExcludedSubjects] = useState<Set<SubjectCode>>(
    new Set((parentData?.excluded_subjects || []) as SubjectCode[])
  );
  const [isSaving, setIsSaving] = useState(false);

  // Password
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // KG
  const [kgConnection, setKgConnection] = useState<{
    kgId?: string; kgName: string; shortCode: string; kgLogoUrl?: string; connectedAt: string;
  } | null>(parentData?.kg_connection || null);
  const [kgCode, setKgCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [logoError, setLogoError] = useState(false);
  // Live logo fetched fresh from the server — overrides whatever is stored in kg_connection
  const [liveLogo, setLiveLogo] = useState<string>('');
  const [liveSchoolName, setLiveSchoolName] = useState<string>('');

  React.useEffect(() => {
    setKgConnection(parentData?.kg_connection || null);
    setLogoError(false);
    setLiveLogo('');
    setLiveSchoolName('');
  }, [parentData?.kg_connection]);

  // Fetch the KG's latest logo + name whenever a connection is set
  React.useEffect(() => {
    if (!kgConnection?.shortCode) { setLiveLogo(''); setLiveSchoolName(''); return; }
    let cancelled = false;
    fetchKGInfo(kgConnection.shortCode).then(info => {
      if (!cancelled) {
        if (info?.logoUrl) {
          console.log('[AccountProfile] Fetched live KG logo for', kgConnection.shortCode);
          setLiveLogo(info.logoUrl);
          setLogoError(false);
        }
        if (info?.schoolName) {
          console.log('[AccountProfile] Fetched live KG name:', info.schoolName);
          setLiveSchoolName(info.schoolName);
        }
      }
    });
    return () => { cancelled = true; };
  }, [kgConnection?.shortCode]);

  // Music
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  React.useEffect(() => subscribeMusicState(() => setMusicOn(isMusicEnabled())), []);

  // Sync edit fields
  React.useEffect(() => {
    if (!isEditing) {
      setEditName(parentData?.name || '');
      setEditPhone(parentData?.phone || '');
      setEditChildName(parentData?.child_name || childName || '');
      setEditChildAge(parentData?.child_age || childAge || 5);
      setEditBirthdate(parentData?.child_birthdate || '');
      setEditExcludedSubjects(new Set((parentData?.excluded_subjects || []) as SubjectCode[]));
    }
  }, [parentData, childName, childAge, isEditing]);

  const { t } = useLanguage();

  // ── Handlers ──
  const handleSave = async () => {
    playMenuSelect();
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (editName !== name) updates.name = editName;
      if (editPhone !== (parentData?.phone || '')) updates.phone = editPhone;
      if (editChildName !== (parentData?.child_name || '')) updates.child_name = editChildName;
      if (editBirthdate && editBirthdate !== (parentData?.child_birthdate || '')) {
        updates.child_birthdate = editBirthdate;
        updates.child_age = getSchoolAge(editBirthdate);
      } else if (editChildAge !== (parentData?.child_age || 5)) {
        updates.child_age = editChildAge;
      }
      const currentExcluded = new Set((parentData?.excluded_subjects || []) as SubjectCode[]);
      const excludedChanged = editExcludedSubjects.size !== currentExcluded.size ||
        [...editExcludedSubjects].some(s => !currentExcluded.has(s));
      if (excludedChanged) updates.excluded_subjects = Array.from(editExcludedSubjects);
      if (!Object.keys(updates).length) { toast.info('No changes'); setIsEditing(false); return; }
      await updateParentProfile(updates);
      toast.success('Profile updated!');
      setIsEditing(false);
      onProfileSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setIsSaving(false); }
  };

  const handleLang = async (code: string) => {
    playMenuSelect();
    onLanguageChange(code);
    try { await updateParentProfile({ language: code }); } catch (_) {}
  };

  const handleConnect = async () => {
    if (!kgCode.trim()) { toast.error('Enter a school code'); return; }
    setIsConnecting(true);
    try {
      await connectToKG(kgCode.trim());
      const stored = localStorage.getItem('parent_data');
      const updated = stored ? JSON.parse(stored) : null;
      setKgConnection(updated?.kg_connection || null);
      setLogoError(false);
      setKgCode('');
      toast.success(`Connected to ${updated?.kg_connection?.kgName || 'kindergarten'}!`);
    } catch (err: any) { toast.error(err.message || 'Failed to connect'); }
    finally { setIsConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect? Your teacher will no longer see your child's progress.")) return;
    setIsDisconnecting(true);
    try {
      await disconnectFromKG();
      setKgConnection(null);
      toast.success('Disconnected from kindergarten.');
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    finally { setIsDisconnecting(false); }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { toast.error('Min 6 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords don\'t match'); return; }
    setIsChangingPw(true);
    try {
      const { error } = await parentAuthClient.auth.updateUser({ password: newPw });
      if (error) { toast.error(error.message); return; }
      toast.success('Password updated!');
      setShowPwForm(false);
      setNewPw(''); setConfirmPw('');
    } catch { toast.error('Something went wrong'); }
    finally { setIsChangingPw(false); }
  };

  const handleDelete = async () => {
    if (deleteText !== 'DELETE') { toast.error('Type DELETE to confirm'); return; }
    setIsDeleting(true);
    try {
      await deleteParentAccount();
      toast.success('Account deleted. Farewell!');
      onLogout();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setIsDeleting(false); }
  };

  const hasLogo = (liveLogo || kgConnection?.kgLogoUrl) && !logoError;

  return (
    <div className="space-y-3 pb-8">

      {/* ── Title ── */}
      <div className="text-center pb-1">
        <FantasyTitle size="md">{t('menu.account')}</FantasyTitle>
        <GoldOrnament className="mt-2" />
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 1 — Profile
      ══════════════════════════════════════════════ */}
      <SectionLabel>Profile</SectionLabel>
      <FantasyPanel className="px-4 py-3">
        {/* Header row with edit button */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-bold" style={{ color: GOLD_LIGHT }}>
            {isEditing ? 'Editing…' : (name || 'Adventurer')}
          </p>
          {!isEditing ? (
            <button
              onClick={() => { playMenuSelect(); setIsEditing(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
              style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD, fontFamily: "'Cinzel Decorative', serif" }}
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { playMenuSelect(); setIsEditing(false); }}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.2)', color: 'rgba(231,76,60,0.8)' }}
              >
                <X className="w-3 h-3" />
              </button>
              <button
                onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-all"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e', fontFamily: "'Cinzel Decorative', serif", boxShadow: `0 2px 0 #a67c2e` }}
              >
                <Save className="w-3 h-3" /> {isSaving ? '…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Rows */}
        <div>
          {isEditing ? (
            <>
              <EditRow label="Name" value={editName} onChange={setEditName} placeholder="Your name" />
              <EditRow label="Phone" value={editPhone} onChange={setEditPhone} placeholder="+601…" />
              <EditRow label="Child's name" value={editChildName} onChange={setEditChildName} placeholder="Explorer" />
              {/* Birthdate picker */}
              <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${GOLD}0f` }}>
                <span className="text-[11px]" style={{ color: DIM }}>Birthdate</span>
                <input
                  type="date"
                  value={editBirthdate}
                  onChange={e => setEditBirthdate(e.target.value)}
                  min={getBirthdateBounds().min}
                  max={getBirthdateBounds().max}
                  className="text-[12px] font-medium bg-transparent focus:outline-none text-right"
                  style={{ color: GOLD_LIGHT, colorScheme: 'dark' }}
                />
              </div>
              {editBirthdate && isBirthdateInRange(editBirthdate) && (() => {
                const lvl = deriveLevelFromBirthdate(editBirthdate);
                return (
                  <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1" style={{ background: `${lvl.tierColor}10` }}>
                    <span className="text-[10px] font-bold" style={{ color: lvl.tierColor }}>{lvl.tierLabel}</span>
                    <span className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>— {lvl.level} (Age {lvl.age})</span>
                  </div>
                );
              })()}
              {/* Subject toggles */}
              <div className="mt-2 mb-1">
                <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: `${PARCHMENT}40` }}>SUBJECTS</span>
              </div>
              <div className="space-y-1">
                {SUBJECTS.map(subj => {
                  const isEnabled = !editExcludedSubjects.has(subj.code);
                  const isMandatory = !subj.optional;
                  return (
                    <button
                      key={subj.code}
                      onClick={() => {
                        if (isMandatory) return;
                        const next = new Set(editExcludedSubjects);
                        if (next.has(subj.code)) next.delete(subj.code);
                        else next.add(subj.code);
                        setEditExcludedSubjects(next);
                      }}
                      disabled={isMandatory}
                      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all text-left"
                      style={{
                        background: isEnabled ? `${subj.color}08` : 'transparent',
                        opacity: isEnabled ? 1 : 0.35,
                        cursor: isMandatory ? 'default' : 'pointer',
                      }}
                    >
                      <span className="text-sm">{subj.icon}</span>
                      <span className="flex-1 text-[11px]" style={{ color: isEnabled ? subj.color : `${PARCHMENT}50` }}>
                        {subj.name.en}
                      </span>
                      {isMandatory && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${subj.color}15`, color: subj.color }}>Core</span>
                      )}
                      <div className="w-8 h-4 rounded-full relative flex-shrink-0" style={{
                        background: isEnabled ? subj.color : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${isEnabled ? subj.color : 'rgba(255,255,255,0.1)'}`,
                        opacity: isMandatory ? 0.4 : 1,
                      }}>
                        <div className="absolute top-0.5 w-3 h-3 rounded-full shadow transition-all duration-200" style={{
                          left: isEnabled ? '15px' : '1px',
                          background: isEnabled ? '#fff' : `${PARCHMENT}50`,
                        }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Email" value={email || '—'} />
              <InfoRow label="Phone" value={parentData?.phone || '—'} />
              <InfoRow label="Child" value={childName || parentData?.child_name || '—'} />
              {parentData?.child_birthdate ? (() => {
                const lvl = deriveLevelFromBirthdate(parentData.child_birthdate);
                return (
                  <>
                    <InfoRow label="Birthdate" value={formatBirthdate(parentData.child_birthdate)} />
                    <InfoRow label="Level" value={`${lvl.level} — ${lvl.tierLabel} (Age ${lvl.age})`} />
                  </>
                );
              })() : (
                <InfoRow label="Age" value={`${childAge || parentData?.child_age || '?'} years`} />
              )}
            </>
          )}

          {/* Provider badge — always shown */}
          {provider !== 'email' && (
            <div className="pt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}20`, color: `${PARCHMENT}70` }}>
                via {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </span>
            </div>
          )}
        </div>
      </FantasyPanel>

      {/* ══════════════════════════════════════════════
          SECTION 2 — Kindergarten
      ══════════════════════════════════════════════ */}
      <SectionLabel>Kindergarten</SectionLabel>
      <FantasyPanel className="px-4 py-3 relative overflow-hidden">
        {kgConnection ? (
          /* ── Connected ── */
          <div>
            {/* KG logo — round, top-right corner */}
            <div className="absolute top-3 right-4">
              {hasLogo ? (
                <img
                  src={liveLogo || kgConnection.kgLogoUrl}
                  alt={kgConnection.kgName}
                  onError={() => setLogoError(true)}
                  className="w-12 h-12 rounded-full object-cover"
                  style={{ border: `2px solid ${GOLD}40`, boxShadow: `0 0 14px ${GOLD}25` }}
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                  style={{ background: `${GOLD}10`, border: `2px dashed ${GOLD}30` }}
                >🏫</div>
              )}
            </div>

            {/* Text content — stays left, right pad keeps it from overlapping logo */}
            <div className="pr-16">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-bold text-green-400 tracking-widest uppercase">Connected</span>
              </div>
              <p className="text-sm font-bold leading-tight" style={{ color: GOLD_LIGHT }}>{liveSchoolName || kgConnection.kgName}</p>
              <p className="text-[11px] mt-1" style={{ color: `${PARCHMENT}70` }}>
                Code: <span className="font-mono font-bold" style={{ color: PARCHMENT }}>{kgConnection.shortCode}</span>
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: DIM }}>
                Since {new Date(kgConnection.connectedAt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${GOLD}10` }}>
              <p className="text-[10px] mb-2.5" style={{ color: DIM }}>
                Your child's assessment results are visible to their teacher.
              </p>
              <button
                onClick={handleDisconnect} disabled={isDisconnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-50 hover:scale-105"
                style={{ borderColor: `${GOLD}30`, color: `${PARCHMENT}80` }}
              >
                {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                Disconnect from kindergarten
              </button>
            </div>
          </div>
        ) : (
          /* ── Not connected ── */
          <div>
            <div className="flex items-center gap-2 mb-3">
              <School className="w-4 h-4" style={{ color: DIM }} />
              <p className="text-[12px] font-semibold" style={{ color: `${PARCHMENT}80` }}>Not connected</p>
            </div>
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: DIM }}>
              Ask your teacher for their class code to share your child's progress with school.
            </p>
            <div className="flex gap-2">
              <input
                type="text" value={kgCode} maxLength={8}
                onChange={e => setKgCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                placeholder="e.g. TGJ01"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono font-black tracking-[0.2em] text-center focus:outline-none uppercase transition-all"
                style={{ background: 'rgba(0,0,0,0.25)', border: `1.5px solid ${GOLD}35`, color: GOLD_LIGHT }}
              />
              <button
                onClick={handleConnect} disabled={isConnecting || !kgCode.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all disabled:opacity-40 hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${GOLD}cc, ${GOLD}77)`, color: '#1a0a00' }}
              >
                {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Connect
              </button>
            </div>
          </div>
        )}

        {/* Origin tag */}
        {originTag && (
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: `${GOLD}07`, border: `1px solid ${GOLD}12` }}>
            <span className="text-xs">🏫</span>
            <p className="text-[10px]" style={{ color: DIM }}>
              Recruited from <span className="font-bold" style={{ color: `${PARCHMENT}80` }}>{originTag}</span>
            </p>
          </div>
        )}
      </FantasyPanel>

      {/* ══════════════════════════════════════════════
          SECTION 2b — Find Kindergarten (Postgres search)
      ══════════════════════════════════════════════ */}
      {!kgConnection && (
        <>
          <SectionLabel>Find Kindergarten</SectionLabel>
          <KGFinder parentId={parentData?.id} onKGSelected={(kg) => {
            console.log('[AccountProfile] KG selected from finder:', kg.name, kg.id);
            toast.success(`Selected: ${kg.name}`);
          }} />
        </>
      )}

      {/* ══════════════════════════════════════════════
          SECTION 3 — Preferences (Lang + Mandarin + Music)
      ══════════════════════════════════════════════ */}
      <SectionLabel>Preferences</SectionLabel>
      <FantasyPanel className="px-4 py-3">
        {/* Language pills */}
        <div className="pb-3" style={{ borderBottom: `1px solid ${GOLD}0f` }}>
          <p className="text-[10px] mb-2" style={{ color: DIM }}>{t('account.languagePref')}</p>
          <div className="flex gap-2">
            {[{ code: 'en', label: 'English' }, { code: 'ms', label: 'Bahasa Melayu' }, { code: 'zh', label: '中文' }].map(lang => (
              <button
                key={lang.code} onClick={() => handleLang(lang.code)}
                className="flex-1 py-2 rounded-xl text-[10px] font-bold tracking-wide transition-all hover:scale-[1.03]"
                style={{
                  background: language === lang.code ? `${GOLD}20` : 'transparent',
                  color: language === lang.code ? GOLD_LIGHT : `${PARCHMENT}60`,
                  border: `1.5px solid ${language === lang.code ? `${GOLD}50` : `${GOLD}15`}`,
                  fontFamily: "'Cinzel Decorative', serif",
                  boxShadow: language === lang.code ? `0 0 8px ${GOLD}25` : 'none',
                }}
              >{lang.label}</button>
            ))}
          </div>
        </div>

        {/* Music toggle — last item, no bottom border */}
      </FantasyPanel>

      {/* ══════════════════════════════════════════════
          SECTION 4 — Notifications (standalone)
      ══════════════════════════════════════════════ */}
      <SectionLabel>Notifications</SectionLabel>
      <FantasyPanel className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} />
          <div className="flex-1">
            <p className="text-[12px] font-semibold" style={{ color: `${PARCHMENT}80` }}>Push Notifications</p>
            <p className="text-[10px] mt-0.5" style={{ color: DIM }}>Notification preferences coming soon.</p>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${GOLD}12`, color: `${PARCHMENT}50`, border: `1px solid ${GOLD}15` }}>
            SOON
          </span>
        </div>
      </FantasyPanel>

      {/* ══════════════════════════════════════════════
          SECTION 5 — Security
      ══════════════════════════════════════════════ */}
      {provider === 'email' && (
        <>
          <SectionLabel>Security</SectionLabel>
          <FantasyPanel className="px-4 py-3">
            {!showPwForm ? (
              <button
                onClick={() => { playMenuSelect(); setShowPwForm(true); }}
                className="w-full flex items-center gap-3 text-left transition-opacity hover:opacity-80"
              >
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold" style={{ color: `${PARCHMENT}90` }}>Change Password</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DIM }}>Update your account password</p>
                </div>
                <span className="text-[11px]" style={{ color: DIM }}>›</span>
              </button>
            ) : (
              <form onSubmit={handleChangePw} className="space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3.5 h-3.5" style={{ color: DIM }} />
                  <p className="text-[11px] font-bold" style={{ color: `${PARCHMENT}80` }}>Change Password</p>
                  <button type="button" onClick={() => { setShowPwForm(false); setNewPw(''); setConfirmPw(''); }}
                    className="ml-auto" style={{ color: `rgba(231,76,60,0.6)` }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="New password (min 6 chars)" required minLength={6}
                    disabled={isChangingPw}
                    className="w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none transition-all pr-9"
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${GOLD}28`, color: GOLD_LIGHT }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: `${GOLD}55` }}>
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <input
                  type={showPw ? 'text' : 'password'} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password" required minLength={6} disabled={isChangingPw}
                  className="w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${GOLD}28`, color: GOLD_LIGHT }}
                />
                {newPw && confirmPw && newPw !== confirmPw && (
                  <p className="text-[10px] text-red-400">Passwords don't match</p>
                )}
                <button type="submit"
                  disabled={isChangingPw || newPw.length < 6 || newPw !== confirmPw}
                  className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider disabled:opacity-50 transition-all hover:scale-[1.01]"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e', fontFamily: "'Cinzel Decorative', serif", boxShadow: `0 2px 0 #a67c2e` }}
                >
                  {isChangingPw ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}
          </FantasyPanel>
        </>
      )}

      {/* ══════════════════════════════════════════════
          ACTIONS — Logout + Delete
      ══════════════════════════════════════════════ */}
      <div className="pt-2 space-y-2">
        <button
          onClick={() => { playMenuSelect(); onLogout(); }}
          className="w-full py-3 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ fontFamily: "'Cinzel Decorative', serif", background: 'rgba(231,76,60,0.1)', border: '1.5px solid rgba(231,76,60,0.22)', color: 'rgba(231,76,60,0.75)' }}
        >
          <LogOut className="w-4 h-4" /> {t('menu.logout')}
        </button>

        {!showDelete ? (
          <button
            onClick={() => { playMenuSelect(); setShowDelete(true); }}
            className="w-full py-2 rounded-xl text-xs font-medium tracking-wider transition-all hover:opacity-70 flex items-center justify-center gap-1.5"
            style={{ color: 'rgba(231,76,60,0.4)', border: '1px solid rgba(231,76,60,0.12)' }}
          >
            <Trash2 className="w-3 h-3" /> {t('account.deleteAccount')}
          </button>
        ) : (
          <FantasyPanel className="p-4">
            <p className="text-sm font-bold mb-1" style={{ color: '#e74c3c', fontFamily: "'Cinzel Decorative', serif" }}>
              Delete Account
            </p>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: `${PARCHMENT}70` }}>
              Type <strong>DELETE</strong> to permanently remove your account. Irreversible.
            </p>
            <input
              type="text" value={deleteText}
              onChange={e => setDeleteText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="w-full py-2.5 px-3 rounded-xl text-sm font-bold tracking-widest focus:outline-none mb-3"
              style={{ background: 'transparent', color: `${PARCHMENT}80`, border: `1.5px solid ${GOLD}18`, fontFamily: "'Cinzel Decorative', serif" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDelete(false); setDeleteText(''); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: 'transparent', color: `${PARCHMENT}70`, border: `1.5px solid ${GOLD}18`, fontFamily: "'Cinzel Decorative', serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete} disabled={isDeleting || deleteText !== 'DELETE'}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 transition-all"
                style={{ background: '#e74c3c', border: '1.5px solid #c0392b', color: '#ffeaa7', fontFamily: "'Cinzel Decorative', serif" }}
              >
                {isDeleting ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </FantasyPanel>
        )}
      </div>
    </div>
  );
};
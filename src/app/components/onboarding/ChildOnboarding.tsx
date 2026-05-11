/**
 * ChildOnboarding.tsx — Post-signup child profile setup
 *
 * Shown after a parent signs up (or first login with no child profile).
 * Collects: child name, birthdate, and subject selection.
 *
 * RPG dark-fantasy aesthetic matching the rest of Foxy Adventure.
 * Birthdate is used to derive the KSSR level (school-year logic).
 * Subject selection defaults to all ON; parent can toggle optional ones OFF.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cake, Sparkles, BookOpen, ChevronRight, ChevronLeft, Check,
  User,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { SUBJECTS, type SubjectCode } from '../../data/kssr-taxonomy';
import {
  deriveLevelFromBirthdate,
  getBirthdateBounds,
  isBirthdateInRange,
  formatBirthdate,
} from '../../utils/level-utils';
// rpgGameGetEntity/rpgGameSignedUrls removed — character previews no longer loaded

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface ChildOnboardingProps {
  /** Called when the user completes onboarding */
  onComplete: (data: {
    childName: string;
    birthdate: string;       // ISO YYYY-MM-DD
    excludedSubjects: SubjectCode[];
    characterType: 'boy' | 'girl';  // NEW: player character choice
  }) => void;
  /** Optional: pre-fill if we already have partial data */
  initialName?: string;
  initialBirthdate?: string;
}

type Step = 'name' | 'birthdate' | 'character' | 'subjects';

export function ChildOnboarding({ onComplete, initialName = '', initialBirthdate = '' }: ChildOnboardingProps) {
  const { language } = useLanguage();

  const [step, setStep] = useState<Step>('name');
  const [childName, setChildName] = useState(initialName);
  const [birthdate, setBirthdate] = useState(initialBirthdate);
  const [excludedSubjects, setExcludedSubjects] = useState<Set<SubjectCode>>(new Set());
  const [characterType, setCharacterType] = useState<'boy' | 'girl' | null>(null);
  // Character previews removed — using plain dropdown now

  const bounds = useMemo(() => getBirthdateBounds(), []);
  const derivedLevel = useMemo(() => {
    if (!birthdate || !isBirthdateInRange(birthdate)) return null;
    return deriveLevelFromBirthdate(birthdate);
  }, [birthdate]);

  // ── Step navigation ──

  const canProceedFromName = childName.trim().length >= 2;
  const canProceedFromBirthdate = birthdate && isBirthdateInRange(birthdate);
  const canProceedFromCharacter = characterType !== null;

  const goNext = () => {
    if (step === 'name' && canProceedFromName) setStep('birthdate');
    else if (step === 'birthdate' && canProceedFromBirthdate) setStep('character');
    else if (step === 'character' && canProceedFromCharacter) setStep('subjects');
  };
  const goBack = () => {
    if (step === 'birthdate') setStep('name');
    else if (step === 'character') setStep('birthdate');
    else if (step === 'subjects') setStep('character');
  };

  const handleFinish = () => {
    onComplete({
      childName: childName.trim(),
      birthdate,
      excludedSubjects: Array.from(excludedSubjects),
      characterType: characterType || 'boy',
    });
  };

  const toggleSubject = (code: SubjectCode) => {
    const next = new Set(excludedSubjects);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExcludedSubjects(next);
  };

  // ── Translations ──

  const t = {
    title: language === 'en' ? 'Tell us about your little adventurer!'
      : language === 'ms' ? 'Ceritakan tentang petualang kecil anda!'
      : '告诉我们关于您的小冒险家！',
    step1Title: language === 'en' ? "What's your child's name?"
      : language === 'ms' ? 'Apakah nama anak anda?'
      : '您孩子叫什么名字？',
    step1Placeholder: language === 'en' ? "Enter child's name..."
      : language === 'ms' ? 'Masukkan nama anak...'
      : '输入孩子姓名...',
    step2Title: language === 'en' ? "When were they born?"
      : language === 'ms' ? 'Bilakah mereka dilahirkan?'
      : '他们什么时候出生的？',
    step2Hint: language === 'en' ? "We use this to serve age-appropriate questions. You'll never need to update it!"
      : language === 'ms' ? 'Kami gunakan ini untuk menyediakan soalan mengikut umur. Anda tak perlu kemaskini!'
      : '我们用这个来提供适龄的问题。您永远不需要更新！',
    stepCharTitle: language === 'en' ? 'Choose your character!'
      : language === 'ms' ? 'Pilih watak anda!'
      : '选择你的角色！',
    stepCharHint: language === 'en' ? 'Your fox companion will join you on your adventure! 🦊'
      : language === 'ms' ? 'Teman rubah anda akan menemani pengembaraan anda! 🦊'
      : '你的狐狸伙伴将加入你的冒险！🦊',
    boyLabel: language === 'en' ? 'Boy' : language === 'ms' ? 'Lelaki' : '男孩',
    girlLabel: language === 'en' ? 'Girl' : language === 'ms' ? 'Perempuan' : '女孩',
    step3Title: language === 'en' ? 'Which subjects?'
      : language === 'ms' ? 'Subjek mana?'
      : '哪些科目？',
    step3Hint: language === 'en' ? 'All subjects are selected by default. Toggle OFF any your child does not study.'
      : language === 'ms' ? 'Semua subjek dipilih. Nyahaktifkan mana yang anak anda tidak belajar.'
      : '默认选择所有科目。关闭孩子不学习的科目。',
    next: language === 'en' ? 'Next' : language === 'ms' ? 'Seterusnya' : '下一步',
    back: language === 'en' ? 'Back' : language === 'ms' ? 'Kembali' : '返回',
    startAdventure: language === 'en' ? "Start Adventure!"
      : language === 'ms' ? 'Mula Pengembaraan!'
      : '开始冒险！',
    levelLabel: language === 'en' ? 'Level' : language === 'ms' ? 'Tahap' : '级别',
    ageLabel: language === 'en' ? 'Age' : language === 'ms' ? 'Umur' : '年龄',
    mandatory: language === 'en' ? 'Core' : language === 'ms' ? 'Teras' : '核心',
    optional: language === 'en' ? 'Elective' : language === 'ms' ? 'Pilihan' : '选修',
  };

  // ── Stepper dots ──
  const STEPS: Step[] = ['name', 'birthdate', 'character', 'subjects'];
  const stepIdx = STEPS.indexOf(step);

  // Character preview loading removed — using plain dropdown

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(30,22,12,1) 0%, rgba(8,6,4,1) 100%)',
      }}
    >
      {/* Load Cherry Bomb One + Cinzel Decorative fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      {/* Top ornament */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <p style={{ fontFamily: F, fontSize: 14, color: `${PARCHMENT}80`, letterSpacing: '0.15em' }}>
          🦊
        </p>
        <h1 style={{ fontFamily: F, fontSize: 20, color: GOLD_LIGHT, textShadow: `0 2px 12px rgba(212,164,74,0.3)` }}>
          {t.title}
        </h1>
      </motion.div>

      {/* Stepper dots */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full transition-all duration-300"
              style={{
                background: i <= stepIdx ? GOLD : `${PARCHMENT}30`,
                boxShadow: i === stepIdx ? `0 0 8px ${GOLD}80` : 'none',
                transform: i === stepIdx ? 'scale(1.3)' : 'scale(1)',
              }}
            />
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px" style={{ background: i < stepIdx ? `${GOLD}60` : `${PARCHMENT}20` }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {/* ── STEP 1: Name ── */}
          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,22,12,0.95), rgba(20,16,10,0.98))',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}08`,
                }}
              >
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${GOLD}12`, border: `1.5px solid ${GOLD}30` }}>
                    <Sparkles className="w-7 h-7" style={{ color: GOLD }} />
                  </div>
                  <h2 style={{ fontFamily: F, fontSize: 17, color: GOLD_LIGHT }}>{t.step1Title}</h2>
                </div>

                <input
                  type="text"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                  placeholder={t.step1Placeholder}
                  autoFocus
                  maxLength={50}
                  className="w-full px-4 py-3.5 rounded-xl text-center font-bold text-base focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(10,10,18,0.6)',
                    color: GOLD_LIGHT,
                    border: `2px solid ${GOLD}30`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    fontFamily: F,
                    fontSize: 16,
                  }}
                  onKeyDown={e => e.key === 'Enter' && goNext()}
                />

                <button
                  onClick={goNext}
                  disabled={!canProceedFromName}
                  className="w-full mt-5 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{
                    background: canProceedFromName
                      ? `linear-gradient(135deg, ${GOLD}, #f0d078)`
                      : `${GOLD}20`,
                    border: canProceedFromName ? `2px solid ${GOLD_LIGHT}` : `2px solid ${GOLD}20`,
                    boxShadow: canProceedFromName ? `0 4px 20px ${GOLD}40` : 'none',
                  }}
                >
                  <span style={{ fontFamily: F, fontSize: 15, color: canProceedFromName ? '#2a1f0e' : `${PARCHMENT}40` }}>
                    {t.next}
                  </span>
                  <ChevronRight className="w-4 h-4" style={{ color: canProceedFromName ? '#2a1f0e' : `${PARCHMENT}40` }} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Birthdate ── */}
          {step === 'birthdate' && (
            <motion.div
              key="birthdate"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,22,12,0.95), rgba(20,16,10,0.98))',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}08`,
                }}
              >
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${GOLD}12`, border: `1.5px solid ${GOLD}30` }}>
                    <Cake className="w-7 h-7" style={{ color: GOLD }} />
                  </div>
                  <h2 style={{ fontFamily: F, fontSize: 17, color: GOLD_LIGHT }}>{t.step2Title}</h2>
                  <p style={{ fontFamily: F, fontSize: 11, color: `${PARCHMENT}60`, marginTop: 4 }}>
                    {t.step2Hint}
                  </p>
                </div>

                <input
                  type="date"
                  value={birthdate}
                  onChange={e => setBirthdate(e.target.value)}
                  min={bounds.min}
                  max={bounds.max}
                  className="w-full px-4 py-3.5 rounded-xl text-center font-bold text-base focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(10,10,18,0.6)',
                    color: GOLD_LIGHT,
                    border: `2px solid ${GOLD}30`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    fontFamily: F,
                    fontSize: 15,
                    colorScheme: 'dark',
                  }}
                />

                {/* Derived level preview */}
                <AnimatePresence>
                  {derivedLevel && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-4 rounded-xl p-4 flex items-center gap-4"
                      style={{
                        background: `${derivedLevel.tierColor}10`,
                        border: `1.5px solid ${derivedLevel.tierColor}30`,
                      }}
                    >
                      {/* Level badge */}
                      <div
                        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                        style={{
                          background: `${derivedLevel.tierColor}18`,
                          border: `1.5px solid ${derivedLevel.tierColor}40`,
                        }}
                      >
                        <span style={{ fontFamily: F, fontSize: 11, color: `${derivedLevel.tierColor}99`, lineHeight: 1 }}>
                          {t.ageLabel}
                        </span>
                        <span style={{ fontFamily: F, fontSize: 22, color: derivedLevel.tierColor, lineHeight: 1 }}>
                          {derivedLevel.age}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: F, fontSize: 15, color: derivedLevel.tierColor }}>
                          {derivedLevel.tierLabel}
                        </p>
                        <p style={{ fontFamily: F, fontSize: 11, color: `${derivedLevel.tierColor}88` }}>
                          {t.levelLabel}: {derivedLevel.level}
                        </p>
                      </div>

                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${derivedLevel.tierColor}25` }}
                      >
                        <Check className="w-4 h-4" style={{ color: derivedLevel.tierColor }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={goBack}
                    className="px-5 py-3 rounded-xl flex items-center gap-1.5 transition-colors"
                    style={{
                      background: `${GOLD}10`,
                      border: `1.5px solid ${GOLD}20`,
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: `${PARCHMENT}60` }} />
                    <span style={{ fontFamily: F, fontSize: 13, color: `${PARCHMENT}60` }}>{t.back}</span>
                  </button>

                  <button
                    onClick={goNext}
                    disabled={!canProceedFromBirthdate}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                    style={{
                      background: canProceedFromBirthdate
                        ? `linear-gradient(135deg, ${GOLD}, #f0d078)`
                        : `${GOLD}20`,
                      border: canProceedFromBirthdate ? `2px solid ${GOLD_LIGHT}` : `2px solid ${GOLD}20`,
                      boxShadow: canProceedFromBirthdate ? `0 4px 20px ${GOLD}40` : 'none',
                    }}
                  >
                    <span style={{ fontFamily: F, fontSize: 15, color: canProceedFromBirthdate ? '#2a1f0e' : `${PARCHMENT}40` }}>
                      {t.next}
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: canProceedFromBirthdate ? '#2a1f0e' : `${PARCHMENT}40` }} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Character ── */}
          {step === 'character' && (
            <motion.div
              key="character"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,22,12,0.95), rgba(20,16,10,0.98))',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}08`,
                }}
              >
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${GOLD}12`, border: `1.5px solid ${GOLD}30` }}>
                    <User className="w-7 h-7" style={{ color: GOLD }} />
                  </div>
                  <h2 style={{ fontFamily: F, fontSize: 17, color: GOLD_LIGHT }}>{t.stepCharTitle}</h2>
                  <p style={{ fontFamily: F, fontSize: 11, color: `${PARCHMENT}60`, marginTop: 4 }}>
                    {t.stepCharHint}
                  </p>
                </div>

                {/* Character selection — plain dropdown */}
                <select
                  value={characterType || ''}
                  onChange={e => setCharacterType(e.target.value as 'boy' | 'girl')}
                  className="w-full px-4 py-3.5 rounded-xl text-center font-bold text-base focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(10,10,18,0.6)',
                    color: characterType ? GOLD_LIGHT : `${PARCHMENT}50`,
                    border: `2px solid ${characterType ? `${GOLD}50` : `${GOLD}30`}`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    fontFamily: F,
                    fontSize: 15,
                    colorScheme: 'dark',
                    WebkitAppearance: 'none',
                  }}
                >
                  <option value="" disabled>
                    {language === 'en' ? '-- Select --' : language === 'ms' ? '-- Pilih --' : '-- 选择 --'}
                  </option>
                  <option value="boy">👦 {t.boyLabel}</option>
                  <option value="girl">👧 {t.girlLabel}</option>
                </select>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={goBack}
                    className="px-5 py-3 rounded-xl flex items-center gap-1.5 transition-colors"
                    style={{
                      background: `${GOLD}10`,
                      border: `1.5px solid ${GOLD}20`,
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: `${PARCHMENT}60` }} />
                    <span style={{ fontFamily: F, fontSize: 13, color: `${PARCHMENT}60` }}>{t.back}</span>
                  </button>

                  <button
                    onClick={goNext}
                    disabled={!canProceedFromCharacter}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                    style={{
                      background: canProceedFromCharacter
                        ? `linear-gradient(135deg, ${GOLD}, #f0d078)`
                        : `${GOLD}20`,
                      border: canProceedFromCharacter ? `2px solid ${GOLD_LIGHT}` : `2px solid ${GOLD}20`,
                      boxShadow: canProceedFromCharacter ? `0 4px 20px ${GOLD}40` : 'none',
                    }}
                  >
                    <span style={{ fontFamily: F, fontSize: 15, color: canProceedFromCharacter ? '#2a1f0e' : `${PARCHMENT}40` }}>
                      {t.next}
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: canProceedFromCharacter ? '#2a1f0e' : `${PARCHMENT}40` }} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Subjects ── */}
          {step === 'subjects' && (
            <motion.div
              key="subjects"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,22,12,0.95), rgba(20,16,10,0.98))',
                  border: `1.5px solid ${GOLD}25`,
                  boxShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}08`,
                }}
              >
                <div className="text-center mb-5">
                  <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${GOLD}12`, border: `1.5px solid ${GOLD}30` }}>
                    <BookOpen className="w-7 h-7" style={{ color: GOLD }} />
                  </div>
                  <h2 style={{ fontFamily: F, fontSize: 17, color: GOLD_LIGHT }}>{t.step3Title}</h2>
                  <p style={{ fontFamily: F, fontSize: 11, color: `${PARCHMENT}60`, marginTop: 4 }}>
                    {t.step3Hint}
                  </p>
                </div>

                {/* Subject grid */}
                <div className="space-y-2">
                  {SUBJECTS.map(subj => {
                    const isEnabled = !excludedSubjects.has(subj.code);
                    const isMandatory = !subj.optional;

                    return (
                      <button
                        key={subj.code}
                        onClick={() => !isMandatory && toggleSubject(subj.code)}
                        disabled={isMandatory}
                        className="w-full rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                        style={{
                          background: isEnabled ? `${subj.color}12` : 'rgba(255,255,255,0.02)',
                          border: `1.5px solid ${isEnabled ? `${subj.color}40` : 'rgba(255,255,255,0.06)'}`,
                          opacity: isEnabled ? 1 : 0.4,
                          cursor: isMandatory ? 'default' : 'pointer',
                        }}
                      >
                        {/* Icon */}
                        <span className="text-lg">{subj.icon}</span>

                        {/* Label */}
                        <div className="flex-1 text-left min-w-0">
                          <p style={{
                            fontFamily: F,
                            fontSize: 14,
                            color: isEnabled ? subj.color : `${PARCHMENT}50`,
                          }}>
                            {subj.name[language as 'en' | 'ms' | 'zh'] || subj.name.en}
                          </p>
                        </div>

                        {/* Badge */}
                        {isMandatory ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: `${subj.color}20`, color: subj.color }}
                          >
                            {t.mandatory}
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                              background: isEnabled ? `${subj.color}20` : 'rgba(255,255,255,0.04)',
                              color: isEnabled ? subj.color : `${PARCHMENT}40`,
                            }}
                          >
                            {t.optional}
                          </span>
                        )}

                        {/* Toggle indicator */}
                        <div
                          className="w-10 h-5.5 rounded-full relative transition-all flex-shrink-0"
                          style={{
                            width: 40,
                            height: 22,
                            background: isEnabled ? subj.color : 'rgba(60,50,30,0.6)',
                            border: isEnabled ? `1.5px solid ${subj.color}` : `1.5px solid rgba(255,255,255,0.1)`,
                            opacity: isMandatory ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="absolute top-0.5 w-4 h-4 rounded-full shadow transition-all duration-200"
                            style={{
                              left: isEnabled ? '19px' : '2px',
                              background: isEnabled ? '#fff' : `${PARCHMENT}60`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={goBack}
                    className="px-5 py-3 rounded-xl flex items-center gap-1.5 transition-colors"
                    style={{
                      background: `${GOLD}10`,
                      border: `1.5px solid ${GOLD}20`,
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: `${PARCHMENT}60` }} />
                    <span style={{ fontFamily: F, fontSize: 13, color: `${PARCHMENT}60` }}>{t.back}</span>
                  </button>

                  <button
                    onClick={handleFinish}
                    className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                      border: `2px solid ${GOLD_LIGHT}`,
                      boxShadow: `0 4px 20px ${GOLD}40, inset 0 1px 0 rgba(255,255,255,0.3)`,
                    }}
                  >
                    <Sparkles className="w-4 h-4" style={{ color: '#2a1f0e' }} />
                    <span style={{ fontFamily: F, fontSize: 15, color: '#2a1f0e' }}>
                      {t.startAdventure}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
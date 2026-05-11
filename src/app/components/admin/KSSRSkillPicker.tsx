/**
 * KSSRSkillPicker — Cascading KSSR taxonomy selector for question tagging.
 *
 * Allows SuperAdmin to pick: Age -> Subject -> Topic -> Skill
 * Each step filters the next. Supports both cascading dropdowns and
 * a free-text search/autocomplete for quick lookup.
 *
 * When a skill is selected, emits the full taxonomy data:
 *   { age, subject, topic, skillName, skillCode }
 *
 * Also supports manual override — admin can type custom values if the
 * taxonomy doesn't cover their specific case.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, X, BookOpen, Sparkles, AlertTriangle } from 'lucide-react';
import {
  VALID_AGES,
  AGE_INFO,
  SUBJECTS,
  ageFromSkillCode,
  resolveSkillAge,
  displayLabelFromAge,
  type SubjectCode,
  type SkillEntry,
} from '../../data/kssr-taxonomy';
import { useTaxonomy } from '../../contexts/TaxonomyContext';

export interface KSSRSelection {
  level: string;        // display label (backward compat)
  age?: number;         // numeric age
  subject: string;      // SubjectCode like 'ENG', 'MAT'
  topic: string;
  skillName: string;    // subtopic / kemahiran
  dskpCode: string;     // skill code e.g. 'ENG-T1-G01' (field name kept for compat)
}

interface KSSRSkillPickerProps {
  /** Current values (for editing an existing question) */
  value?: Partial<KSSRSelection>;
  /** Called when the selection changes */
  onChange: (selection: KSSRSelection) => void;
  /** Whether to show in compact mode (single row) */
  compact?: boolean;
}

/** Map quest-system subject names to SubjectCode */
const QUEST_SUBJECT_TO_CODE: Record<string, SubjectCode> = {
  english: 'ENG', eng: 'ENG', 'bahasa inggeris': 'ENG',
  math: 'MAT', maths: 'MAT', mathematics: 'MAT', numbers: 'MAT',
  bahasa: 'BM', 'bahasa melayu': 'BM', bm: 'BM',
  mandarin: 'ZH', chinese: 'ZH', 'bahasa cina': 'ZH',
  science: 'SCI', sains: 'SCI',
  sejarah: 'SJ', history: 'SJ',
  geography: 'GEO', geografi: 'GEO',
};

/** Resolve a quest subject name to SubjectCode */
function resolveSubjectCode(s: string): SubjectCode | '' {
  if (!s) return '';
  const upper = s.toUpperCase();
  if (SUBJECTS.some(sub => sub.code === upper)) return upper as SubjectCode;
  return QUEST_SUBJECT_TO_CODE[s.toLowerCase()] || '';
}

export function KSSRSkillPicker({ value, onChange, compact }: KSSRSkillPickerProps) {
  // Use live taxonomy from context
  const { skills: LIVE_SKILLS, byCode: LIVE_BY_CODE, tree: LIVE_TREE } = useTaxonomy();

  // Local state for cascading selection
  const [selectedAge, setSelectedAge] = useState<number | ''>(value?.age || '');
  const [subjectCode, setSubjectCode] = useState<string>(value?.subject || '');
  const [topic, setTopic] = useState<string>(value?.topic || '');
  const [skillCode, setSkillCode] = useState<string>(value?.dskpCode || '');

  // Search mode
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Manual override mode
  const [manualMode, setManualMode] = useState(false);
  const [manualAge, setManualAge] = useState(value?.age?.toString() || value?.level || '');
  const [manualTopic, setManualTopic] = useState(value?.topic || '');
  const [manualSkillName, setManualSkillName] = useState(value?.skillName || '');
  const [manualSkillCode, setManualSkillCode] = useState(value?.dskpCode || '');

  // Sync from parent value
  useEffect(() => {
    if (value) {
      const sc = resolveSubjectCode(value.subject || '');
      const age = value.age || (value.dskpCode ? ageFromSkillCode(value.dskpCode) : '');
      setSelectedAge(age || '');
      setSubjectCode(sc || value.subject || '');
      setTopic(value.topic || '');
      setSkillCode(value.dskpCode || '');
      setManualAge(age?.toString() || value.level || '');
      setManualTopic(value.topic || '');
      setManualSkillName(value.skillName || '');
      setManualSkillCode(value.dskpCode || '');
    }
  }, [value?.dskpCode]); // Only re-sync when skillCode changes (avoids loops)

  // Derived: available subjects for selected age
  const availableSubjects = useMemo(() => {
    if (!selectedAge) return SUBJECTS;
    const tree = LIVE_TREE[selectedAge as number];
    if (!tree) return SUBJECTS;
    return SUBJECTS.filter(s => tree[s.code]);
  }, [selectedAge, LIVE_TREE]);

  // Derived: available topics for selected age + subject
  const availableTopics = useMemo(() => {
    if (!selectedAge || !subjectCode) return [];
    const tree = LIVE_TREE[selectedAge as number]?.[subjectCode];
    if (!tree) return [];
    return Object.keys(tree).sort();
  }, [selectedAge, subjectCode, LIVE_TREE]);

  // Derived: available skills for selected age + subject + topic
  const availableSkills = useMemo(() => {
    if (!selectedAge || !subjectCode || !topic) return [];
    return LIVE_TREE[selectedAge as number]?.[subjectCode]?.[topic] || [];
  }, [selectedAge, subjectCode, topic, LIVE_TREE]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return LIVE_SKILLS.filter(s =>
      s.skillCode.toLowerCase().includes(q) ||
      s.subtopic.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q) ||
      s.subject.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [searchQuery, LIVE_SKILLS]);

  // Emit change
  const emitChange = useCallback((sel: Partial<KSSRSelection>) => {
    const age = sel.age || (selectedAge as number) || 0;
    onChange({
      level: sel.level || (age ? displayLabelFromAge(age) : manualAge),
      age: age || undefined,
      subject: sel.subject || subjectCode || '',
      topic: sel.topic || topic || manualTopic || '',
      skillName: sel.skillName || manualSkillName || '',
      dskpCode: sel.dskpCode || skillCode || manualSkillCode || '',
    });
  }, [selectedAge, subjectCode, topic, skillCode, manualAge, manualTopic, manualSkillName, manualSkillCode, onChange]);

  // Handle age change
  const handleAgeChange = (newAge: string) => {
    const age = newAge ? parseInt(newAge) : '';
    setSelectedAge(age);
    setTopic('');
    setSkillCode('');
    emitChange({ age: age || undefined, level: age ? displayLabelFromAge(age as number) : '', topic: '', skillName: '', dskpCode: '' });
  };

  // Handle subject change
  const handleSubjectChange = (newSubject: string) => {
    setSubjectCode(newSubject);
    setTopic('');
    setSkillCode('');
    emitChange({ subject: newSubject, topic: '', skillName: '', dskpCode: '' });
  };

  // Handle topic change
  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    setSkillCode('');
    emitChange({ topic: newTopic, skillName: '', dskpCode: '' });
  };

  // Handle skill selection (from dropdown or search)
  const handleSkillSelect = (skill: SkillEntry) => {
    const age = resolveSkillAge(skill);
    setSelectedAge(age);
    setSubjectCode(skill.subject);
    setTopic(skill.topic);
    setSkillCode(skill.skillCode);
    setSearchQuery('');
    setShowResults(false);
    setSearchMode(false);
    onChange({
      level: displayLabelFromAge(age),
      age,
      subject: skill.subject,
      topic: skill.topic,
      skillName: skill.subtopic,
      dskpCode: skill.skillCode,
    });
  };

  // Handle manual override emit
  const emitManual = () => {
    const age = parseInt(manualAge) || undefined;
    onChange({
      level: age ? displayLabelFromAge(age) : manualAge,
      age,
      subject: subjectCode,
      topic: manualTopic,
      skillName: manualSkillName,
      dskpCode: manualSkillCode,
    });
  };

  // Current selection summary
  const currentSkill = skillCode ? LIVE_BY_CODE[skillCode] : null;

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent';
  const selectClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="space-y-3">
      {/* Header with mode toggles */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-blue-500" />
          Skill Tag
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setSearchMode(!searchMode); setManualMode(false); }}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              searchMode ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Search className="w-3 h-3 inline mr-1" />
            Search
          </button>
          <button
            type="button"
            onClick={() => { setManualMode(!manualMode); setSearchMode(false); }}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              manualMode ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Manual
          </button>
        </div>
      </div>

      {/* Search mode */}
      {searchMode && (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="Search by skill code, topic, or description..."
              className="w-full pl-9 pr-8 py-2 border border-blue-200 rounded-lg text-sm bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setShowResults(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map(skill => (
                <button
                  key={skill.skillCode}
                  type="button"
                  onClick={() => handleSkillSelect(skill)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {skill.skillCode}
                    </span>
                    <span className="text-xs text-gray-400">Age {resolveSkillAge(skill)}</span>
                    <span className="text-xs text-gray-400">{skill.subject}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{skill.topic} &gt; {skill.subtopic}</p>
                </button>
              ))}
            </div>
          )}
          {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-xs text-gray-500">
              No skills found for "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Manual override mode */}
      {manualMode && (
        <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 mb-2">
            Override taxonomy fields manually. Use when the taxonomy doesn't cover your case.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Age</label>
              <input
                type="number"
                min={4}
                max={12}
                value={manualAge}
                onChange={e => setManualAge(e.target.value)}
                onBlur={emitManual}
                placeholder="e.g. 7"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Skill Code</label>
              <input
                type="text"
                value={manualSkillCode}
                onChange={e => setManualSkillCode(e.target.value)}
                onBlur={emitManual}
                placeholder="e.g. ENG-T1-G01"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Topic</label>
            <input
              type="text"
              value={manualTopic}
              onChange={e => setManualTopic(e.target.value)}
              onBlur={emitManual}
              placeholder="e.g. Grammar"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Skill Name</label>
            <input
              type="text"
              value={manualSkillName}
              onChange={e => setManualSkillName(e.target.value)}
              onBlur={emitManual}
              placeholder="e.g. Ayat mudah: subjek + predikat"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Cascading dropdowns (default mode) */}
      {!manualMode && (
        <div className={compact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-3'}>
          {/* Age */}
          <div>
            <label className={labelClass}>Age</label>
            <select
              value={selectedAge}
              onChange={e => handleAgeChange(e.target.value)}
              className={selectClass}
            >
              <option value="">All Ages</option>
              {VALID_AGES.map(a => (
                <option key={a} value={a}>Age {a} — {AGE_INFO[a]?.displayLabel}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className={labelClass}>Subject</label>
            <select
              value={subjectCode}
              onChange={e => handleSubjectChange(e.target.value)}
              className={selectClass}
            >
              <option value="">Select subject...</option>
              {availableSubjects.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.name.en}</option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className={labelClass}>Topic</label>
            <select
              value={topic}
              onChange={e => handleTopicChange(e.target.value)}
              className={selectClass}
              disabled={availableTopics.length === 0}
            >
              <option value="">{availableTopics.length === 0 ? 'Pick age + subject first' : 'Select topic...'}</option>
              {availableTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Skill */}
          <div>
            <label className={labelClass}>Skill</label>
            <select
              value={skillCode}
              onChange={e => {
                const skill = LIVE_BY_CODE[e.target.value];
                if (skill) handleSkillSelect(skill);
              }}
              className={selectClass}
              disabled={availableSkills.length === 0}
            >
              <option value="">{availableSkills.length === 0 ? 'Pick topic first' : 'Select skill...'}</option>
              {availableSkills.map(s => (
                <option key={s.skillCode} value={s.skillCode}>
                  {s.skillCode} — {s.subtopic.substring(0, 50)}{s.subtopic.length > 50 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Selected skill summary */}
      {currentSkill && !manualMode && (
        <div className="flex items-start gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono bg-green-100 px-1.5 py-0.5 rounded text-green-800 font-bold">
                {currentSkill.skillCode}
              </span>
              <span className="text-xs text-green-600">Age {resolveSkillAge(currentSkill)}</span>
              <span className="text-xs text-green-600">{currentSkill.subject}</span>
              <span className="text-xs text-green-600">{currentSkill.topic}</span>
            </div>
            <p className="text-xs text-green-700 mt-1 truncate">{currentSkill.subtopic}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSkillCode('');
              setTopic('');
              onChange({
                level: selectedAge ? displayLabelFromAge(selectedAge as number) : '',
                age: selectedAge as number || undefined,
                subject: subjectCode,
                topic: '',
                skillName: '',
                dskpCode: '',
              });
            }}
            className="p-1 text-green-400 hover:text-green-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Manual mode summary */}
      {manualMode && (manualSkillCode || manualTopic || manualSkillName) && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {manualSkillCode && (
                <span className="text-xs font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-800 font-bold">
                  {manualSkillCode}
                </span>
              )}
              {manualAge && <span className="text-xs text-amber-600">Age {manualAge}</span>}
              {manualTopic && <span className="text-xs text-amber-600">{manualTopic}</span>}
            </div>
            {manualSkillName && (
              <p className="text-xs text-amber-700 mt-1 truncate">{manualSkillName}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
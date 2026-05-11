/**
 * FlashcardCategoryGrid — RPG-themed category selection for the flashcard mode.
 * Styled to match the Game Dashboard card aesthetic with full-bleed images,
 * dark gradient overlays, gold accents, and Cinzel Decorative typography.
 *
 * Supports:
 * - Single-tap mode (default): tap a card → enter immediately
 * - Multi-select mode (toggle): tap cards to select, then press Start
 */
import React, { useState, useEffect } from 'react';
import { Loader2, Layers, Sparkles, Lock, CheckCircle2, Shuffle, Play } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { fetchFlashcardCategories, fetchFlashcards } from '../../utils/api';
import {
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';

// Fallback placeholder images — will be replaced by R2 category images
import foxyCards from "figma:asset/d93ba808ae421821a6ea35d8f9026b8b9144b4dc.png";
import foxyTraining from "figma:asset/51529dd613ccfeaf3ee88bc05a3da7a753d5e766.png";
import foxyLibrary from "figma:asset/521b603b8bbe2f81d5701f7e5b867148de63d3be.png";
import foxyMusic from "figma:asset/0a4a5f2de61ff3cab00b6f55e866327e0c304c03.png";
import foxyQuest from "figma:asset/1d57ecae39753929a310104cbef828723aa8bd86.png";

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const DARK_BASE = 'rgba(12,8,20,';

const PLACEHOLDER_IMAGES = [foxyCards, foxyTraining, foxyLibrary, foxyMusic, foxyQuest];

interface Category {
  id: string;
  name_en: string;
  name_bm: string;
  name_zh: string;
  emoji: string;
  color: string;
  image_url?: string | null;
}

interface Props {
  onSelectCategory: (categoryId: string, categoryName: string) => void;
  onSelectMultiple?: (categoryIds: string[], label: string) => void;
}

export function FlashcardCategoryGrid({ onSelectCategory, onSelectMultiple }: Props) {
  const { language } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Multi-select state
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, allCards] = await Promise.all([
          fetchFlashcardCategories(),
          fetchFlashcards(),
        ]);
        setCategories(cats);
        const counts: Record<string, number> = {};
        for (const card of allCards) {
          counts[card.category_id] = (counts[card.category_id] || 0) + 1;
        }
        setCardCounts(counts);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getCatName = (cat: Category) => {
    if (language === 'zh') return cat.name_zh || cat.name_en;
    if (language === 'ms') return cat.name_bm || cat.name_en;
    return cat.name_en;
  };

  const getSecondaryNames = (cat: Category) => {
    const names: string[] = [];
    if (language !== 'ms' && cat.name_bm) names.push(cat.name_bm);
    if (language !== 'zh' && cat.name_zh) names.push(cat.name_zh);
    if (language !== 'en' && cat.name_en) names.push(cat.name_en);
    return names.slice(0, 2);
  };

  const toggleSelect = (catId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Total cards across selected categories
  const selectedCardCount = Array.from(selected).reduce(
    (sum, id) => sum + (cardCounts[id] || 0), 0
  );

  const handleStart = () => {
    if (selected.size === 0) return;
    playMenuSelect();

    const ids = Array.from(selected);
    if (ids.length === 1) {
      const cat = categories.find(c => c.id === ids[0]);
      onSelectCategory(ids[0], cat ? getCatName(cat) : 'Flashcards');
    } else if (onSelectMultiple) {
      const names = ids.map(id => {
        const cat = categories.find(c => c.id === id);
        return cat ? getCatName(cat) : '';
      }).filter(Boolean);
      const label = names.length <= 2
        ? names.join(' + ')
        : `${names.length} ${language === 'zh' ? '个类别' : language === 'ms' ? 'kategori' : 'categories'}`;
      onSelectMultiple(ids, label);
    }
  };

  const handleToggleMulti = () => {
    playMenuSelect();
    if (multiMode) {
      // Turning off — clear selection
      setSelected(new Set());
    }
    setMultiMode(!multiMode);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
        <p className="text-sm" style={{ color: `${PARCHMENT}80` }}>
          {language === 'zh' ? '加载中...' : language === 'ms' ? 'Memuatkan...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-16">
        <Layers size={56} className="mx-auto mb-4 opacity-30" style={{ color: `${PARCHMENT}40` }} />
        <p className="text-lg font-bold" style={{ color: `${PARCHMENT}80`, fontFamily: "'Cinzel Decorative', serif" }}>
          {language === 'zh' ? '暂无闪卡类别' : language === 'ms' ? 'Tiada kategori kad imbas' : 'No flashcard categories yet'}
        </p>
        <p className="text-sm mt-2" style={{ color: `${PARCHMENT}60` }}>
          {language === 'zh' ? '管理员需要先添加内容' : language === 'ms' ? 'Admin perlu menambah kandungan terlebih dahulu' : 'Admin needs to add content first'}
        </p>
      </div>
    );
  }

  return (
    <div className="py-6 pb-28">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-1">
          <Sparkles size={18} style={{ color: GOLD }} />
          <FantasyTitle size="md">
            {language === 'zh' ? '闪卡冒险' : language === 'ms' ? 'Pengembaraan Kad Imbas' : 'Flashcard Adventure'}
          </FantasyTitle>
          <Sparkles size={18} style={{ color: GOLD }} />
        </div>
        <p className="text-sm mt-2" style={{ color: `${PARCHMENT}80` }}>
          {multiMode
            ? (language === 'zh' ? '选择多个类别混合学习' : language === 'ms' ? 'Pilih beberapa kategori untuk dicampur' : 'Select categories to shuffle & learn')
            : (language === 'zh' ? '选择一个类别开始学习！' : language === 'ms' ? 'Pilih kategori untuk mula belajar!' : 'Choose a realm to begin your journey!')}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Multi-select toggle */}
      <div className="flex justify-center mb-5">
        <button
          onClick={handleToggleMulti}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            background: multiMode
              ? `linear-gradient(135deg, ${GOLD}30, ${GOLD}15)`
              : `${DARK_BASE}0.5)`,
            border: `1.5px solid ${multiMode ? GOLD : `${GOLD}30`}`,
            color: multiMode ? GOLD_LIGHT : `${PARCHMENT}70`,
            boxShadow: multiMode ? `0 0 20px ${GOLD}15` : 'none',
          }}
        >
          <Shuffle className="w-3.5 h-3.5" />
          {language === 'zh' ? '多选混合' : language === 'ms' ? 'Pilihan Berganda' : 'Multi-Select'}
          {/* Toggle indicator */}
          <div
            className="relative w-8 h-4 rounded-full transition-colors duration-300"
            style={{
              background: multiMode ? GOLD : `${PARCHMENT}30`,
            }}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300"
              style={{
                background: multiMode ? '#2a1f0e' : `${PARCHMENT}60`,
                left: multiMode ? '18px' : '2px',
                boxShadow: multiMode ? `0 0 6px ${GOLD}80` : 'none',
              }}
            />
          </div>
        </button>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto px-2">
        {categories.map((cat, idx) => {
          const count = cardCounts[cat.id] || 0;
          const isEmpty = count === 0;
          const bgImage = cat.image_url || PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length];
          const secondaryNames = getSecondaryNames(cat);
          const isSelected = selected.has(cat.id);

          return (
            <button
              key={cat.id}
              onClick={() => {
                if (isEmpty) return;
                playMenuSelect();
                if (multiMode) {
                  toggleSelect(cat.id);
                } else {
                  onSelectCategory(cat.id, getCatName(cat));
                }
              }}
              disabled={isEmpty}
              className="group relative overflow-hidden rounded-2xl text-left transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                aspectRatio: '3 / 4',
                border: `2px solid ${isSelected ? GOLD : `${GOLD}40`}`,
                boxShadow: isSelected
                  ? `0 6px 30px rgba(0,0,0,0.5), 0 0 25px ${GOLD}25, inset 0 0 20px ${GOLD}10`
                  : `0 6px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}08, inset 0 1px 0 ${GOLD}15`,
                transform: isSelected ? 'scale(1.02)' : undefined,
              }}
            >
              {/* Full background image */}
              <div className="absolute inset-0">
                <img
                  src={bgImage}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>

              {/* Inner border glow */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  boxShadow: `inset 0 0 30px rgba(0,0,0,0.5)`,
                  borderRadius: 'inherit',
                }}
              />

              {/* Hover glow effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10"
                style={{
                  boxShadow: `inset 0 0 40px ${GOLD}15, 0 0 30px ${GOLD}10`,
                  borderRadius: 'inherit',
                }}
              />

              {/* Selected overlay — gold tint */}
              {isSelected && (
                <div
                  className="absolute inset-0 z-15 pointer-events-none transition-opacity duration-300"
                  style={{
                    background: `${GOLD}12`,
                    borderRadius: 'inherit',
                  }}
                />
              )}

              {/* Top-right: Card count badge */}
              <div
                className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                style={{
                  background: `${DARK_BASE}0.7)`,
                  border: `1px solid ${GOLD}40`,
                  color: GOLD_LIGHT,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Layers className="w-3 h-3" />
                {count} {language === 'zh' ? '张' : language === 'ms' ? 'kad' : 'cards'}
              </div>

              {/* Selected checkmark — top-left */}
              {multiMode && !isEmpty && (
                <div
                  className="absolute top-3 left-3 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${GOLD}, #f0d078)`
                      : `${DARK_BASE}0.6)`,
                    border: `2px solid ${isSelected ? GOLD_LIGHT : `${GOLD}40`}`,
                    boxShadow: isSelected ? `0 0 12px ${GOLD}60` : 'none',
                  }}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#2a1f0e' }} />
                  ) : (
                    <div className="w-3 h-3 rounded-full" style={{ border: `1.5px solid ${PARCHMENT}50` }} />
                  )}
                </div>
              )}

              {/* Sparkle dot — only in single mode */}
              {!multiMode && !isEmpty && (
                <div
                  className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full z-20 animate-pulse"
                  style={{
                    background: GOLD,
                    boxShadow: `0 0 8px ${GOLD}, 0 0 16px ${GOLD}60`,
                  }}
                />
              )}

              {/* Lock overlay for empty categories */}
              {isEmpty && (
                <div className="absolute inset-0 z-20 flex items-center justify-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: `${DARK_BASE}0.7)`,
                      border: `2px solid ${GOLD}30`,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <Lock className="w-5 h-5" style={{ color: `${PARCHMENT}60` }} />
                  </div>
                </div>
              )}

              {/* Bottom gradient overlay with text */}
              <div
                className="absolute bottom-0 left-0 right-0 z-20 px-3.5 pt-16 pb-3.5"
                style={{
                  background: `linear-gradient(to top, ${DARK_BASE}0.97) 0%, ${DARK_BASE}0.9) 35%, ${DARK_BASE}0.6) 60%, ${DARK_BASE}0) 100%)`,
                }}
              >
                <h3
                  className="text-sm md:text-base font-bold leading-tight"
                  style={{
                    fontFamily: "'Cinzel Decorative', serif",
                    color: GOLD_LIGHT,
                    textShadow: `0 2px 6px rgba(0,0,0,0.9), 0 0 10px ${GOLD}30`,
                  }}
                >
                  {getCatName(cat)}
                </h3>
                {secondaryNames.length > 0 && (
                  <p
                    className="text-[10px] mt-1 leading-tight"
                    style={{
                      color: `${PARCHMENT}90`,
                      textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    }}
                  >
                    {secondaryNames.join(' · ')}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Floating Start Button — visible when multi-select has selections */}
      {multiMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
          <button
            onClick={handleStart}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all duration-300 hover:brightness-110 active:scale-[0.97]"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
              color: '#2a1f0e',
              border: `2px solid ${GOLD_LIGHT}`,
              boxShadow: `0 4px 0 #a67c2e, 0 8px 30px ${GOLD}40, 0 0 40px ${GOLD}20`,
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <Play className="w-5 h-5" />
            <span>
              {language === 'zh'
                ? `开始 · ${selected.size} 类 · ${selectedCardCount} 张`
                : language === 'ms'
                ? `Mula · ${selected.size} kategori · ${selectedCardCount} kad`
                : `Start · ${selected.size} ${selected.size === 1 ? 'realm' : 'realms'} · ${selectedCardCount} cards`}
            </span>
            <Shuffle className="w-4 h-4 opacity-60" />
          </button>
        </div>
      )}
    </div>
  );
}
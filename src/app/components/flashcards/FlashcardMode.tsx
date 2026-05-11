/**
 * FlashcardMode — Parent-facing container for the flashcard experience.
 * Tier 1: Category selection grid (single or multi-select)
 * Tier 2: Tinder-style swipeable flashcards (rendered via Portal to escape ParentShell constraints)
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FlashcardCategoryGrid } from './FlashcardCategoryGrid';
import { FlashcardSwiper } from './FlashcardSwiper';

interface Props {
  parentData?: any;
  onShowUpgrade?: () => void;
  onComplete?: () => void;
}

export function FlashcardMode({ parentData, onShowUpgrade, onComplete }: Props) {
  const [session, setSession] = useState<{
    categoryIds: string[];
    label: string;
  } | null>(null);

  return (
    <>
      {/* Category grid renders normally inside ParentShell */}
      {!session && (
        <FlashcardCategoryGrid
          onSelectCategory={(id, name) => setSession({ categoryIds: [id], label: name })}
          onSelectMultiple={(ids, label) => setSession({ categoryIds: ids, label })}
        />
      )}

      {/* Swiper renders via Portal directly into document.body — escapes all ParentShell CSS */}
      {session && createPortal(
        <FlashcardSwiper
          categoryIds={session.categoryIds}
          categoryName={session.label}
          onBack={() => setSession(null)}
          onComplete={onComplete}
        />,
        document.body
      )}
    </>
  );
}
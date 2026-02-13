/**
 * Report calculation utilities for KSSR Readiness Assessment.
 *
 * - TP (Tahap Penguasaan 1-6): Calculated ONLY from Age 7 question accuracy.
 * - Functional Age per Subject: Highest age level where accuracy >= 50%.
 * - Radar chart data: Per-subject functional age for spider-web chart axes.
 */

export interface DetailedAnswer {
  questionId: string;
  answerId: string;
  correctAnswer: string;
  isCorrect: boolean;
  quest: string;
  ageDifficulty: number;
}

export interface QuestResult {
  quest: string;
  questId: string;
  score: number;
  total: number;
  percentage: number;
}

export interface AgePerformance {
  age: number;
  correct: number;
  total: number;
  percentage: number;
}

export interface SubjectAgeBreakdown {
  questId: string;
  questName: string;
  icon: string;
  overallScore: number;
  overallTotal: number;
  overallPercentage: number;
  functionalAge: number;
  ageLevels: {
    age: number;
    correct: number;
    total: number;
    passed: boolean;
  }[];
  strengthTag: string;
}

export interface TPResult {
  level: number; // 1-6
  labelBM: string;
  labelEN: string;
  labelZH: string;
  age7Accuracy: number; // 0-100
  description: {
    en: string;
    ms: string;
    zh: string;
  };
}

// TP Scale mapping based on Age 7 question accuracy
const TP_SCALE: {
  level: number;
  labelBM: string;
  labelEN: string;
  labelZH: string;
  minAccuracy: number;
  maxAccuracy: number;
  description: { en: string; ms: string; zh: string };
}[] = [
  {
    level: 1,
    labelBM: 'Belum Menguasai',
    labelEN: 'Not Yet Proficient',
    labelZH: '尚未掌握',
    minAccuracy: 0,
    maxAccuracy: 0,
    description: {
      en: 'has not yet demonstrated understanding of Year 1-level concepts. More foundational practice is needed.',
      ms: 'belum menunjukkan pemahaman konsep Tahun 1. Latihan asas yang lebih banyak diperlukan.',
      zh: '尚未展示对一年级概念的理解，需要更多基础练习。',
    },
  },
  {
    level: 2,
    labelBM: 'Menguasai Minimum',
    labelEN: 'Minimally Proficient',
    labelZH: '基本掌握',
    minAccuracy: 1,
    maxAccuracy: 20,
    description: {
      en: 'shows beginning awareness of Year 1 concepts but needs significant support to develop further.',
      ms: 'menunjukkan kesedaran awal konsep Tahun 1 tetapi memerlukan sokongan yang ketara.',
      zh: '显示出对一年级概念的初步认识，但需要大量支持来进一步发展。',
    },
  },
  {
    level: 3,
    labelBM: 'Menguasai Asas',
    labelEN: 'Basic Proficiency',
    labelZH: '基础掌握',
    minAccuracy: 21,
    maxAccuracy: 40,
    description: {
      en: 'can follow basic instructions and recognise some Year 1 concepts, but struggles to apply them independently.',
      ms: 'boleh mengikut arahan asas dan mengenal beberapa konsep Tahun 1, tetapi sukar mengaplikasinya secara sendiri.',
      zh: '能够遵循基本指令并认识一些一年级概念，但难以独立应用。',
    },
  },
  {
    level: 4,
    labelBM: 'Menguasai',
    labelEN: 'Proficient',
    labelZH: '掌握',
    minAccuracy: 41,
    maxAccuracy: 60,
    description: {
      en: 'demonstrates solid understanding of Year 1 concepts and can apply them with some guidance.',
      ms: 'menunjukkan pemahaman kukuh konsep Tahun 1 dan boleh mengaplikasinya dengan sedikit bimbingan.',
      zh: '展示了对一年级概念的扎实理解，并能在一定指导下应用。',
    },
  },
  {
    level: 5,
    labelBM: 'Menguasai Cemerlang',
    labelEN: 'Advanced',
    labelZH: '优秀掌握',
    minAccuracy: 61,
    maxAccuracy: 80,
    description: {
      en: 'shows strong command of Year 1 concepts and can apply them independently in most situations.',
      ms: 'menunjukkan penguasaan kukuh konsep Tahun 1 dan boleh mengaplikasinya secara sendiri dalam kebanyakan situasi.',
      zh: '展示了对一年级概念的强大掌握，能在大多数情况下独立应用。',
    },
  },
  {
    level: 6,
    labelBM: 'Menguasai Tertinggi',
    labelEN: 'Exceptional',
    labelZH: '卓越掌握',
    minAccuracy: 81,
    maxAccuracy: 100,
    description: {
      en: 'demonstrates exceptional mastery of Year 1 concepts and can apply, analyse and create independently.',
      ms: 'menunjukkan penguasaan tertinggi konsep Tahun 1 dan boleh mengaplikasi, menganalisa serta mencipta secara sendiri.',
      zh: '展示了对一年级概念的卓越掌握，能够独立应用、分析和创造。',
    },
  },
];

/**
 * Calculate TP (Tahap Penguasaan 1-6) from Age 7 question accuracy ONLY.
 */
export function calculateTP(answers: DetailedAnswer[]): TPResult {
  const age7Answers = answers.filter((a) => a.ageDifficulty === 7);

  if (age7Answers.length === 0) {
    // No Age 7 questions attempted — default to TP1
    return {
      level: 1,
      labelBM: TP_SCALE[0].labelBM,
      labelEN: TP_SCALE[0].labelEN,
      labelZH: TP_SCALE[0].labelZH,
      age7Accuracy: 0,
      description: TP_SCALE[0].description,
    };
  }

  const correct = age7Answers.filter((a) => a.isCorrect).length;
  const accuracy = Math.round((correct / age7Answers.length) * 100);

  // Find matching TP level
  const tp =
    TP_SCALE.find(
      (t) => accuracy >= t.minAccuracy && accuracy <= t.maxAccuracy
    ) || TP_SCALE[0];

  return {
    level: tp.level,
    labelBM: tp.labelBM,
    labelEN: tp.labelEN,
    labelZH: tp.labelZH,
    age7Accuracy: accuracy,
    description: tp.description,
  };
}

/**
 * Calculate the functional age per subject.
 * Functional age = highest age level where the child scored >= 50% on questions for that subject.
 */
export function calculateSubjectBreakdowns(
  answers: DetailedAnswer[],
  questNameMap: Record<string, { name: string; icon: string }>
): SubjectAgeBreakdown[] {
  // Group answers by quest
  const questGroups: Record<string, DetailedAnswer[]> = {};
  answers.forEach((a) => {
    const quest = a.quest || 'unknown';
    if (!questGroups[quest]) questGroups[quest] = [];
    questGroups[quest].push(a);
  });

  return Object.entries(questGroups).map(([questId, questAnswers]) => {
    const info = questNameMap[questId] || { name: questId, icon: '📝' };

    // Group by age within this quest
    const ageGroups: Record<number, DetailedAnswer[]> = {};
    questAnswers.forEach((a) => {
      const age = a.ageDifficulty || 4;
      if (!ageGroups[age]) ageGroups[age] = [];
      ageGroups[age].push(a);
    });

    // Calculate per-age results
    const ageLevels = [4, 5, 6, 7]
      .map((age) => {
        const ageAnswers = ageGroups[age] || [];
        const correct = ageAnswers.filter((a) => a.isCorrect).length;
        const total = ageAnswers.length;
        return {
          age,
          correct,
          total,
          passed: total > 0 && correct / total >= 0.5,
        };
      })
      .filter((a) => a.total > 0 || a.age <= 7);

    // Functional age = highest age where passed = true
    const passedAges = ageLevels.filter((a) => a.passed);
    const functionalAge =
      passedAges.length > 0
        ? Math.max(...passedAges.map((a) => a.age))
        : Math.min(...ageLevels.filter((a) => a.total > 0).map((a) => a.age)) -
            1 || 3;

    // Overall score for this quest
    const overallScore = questAnswers.filter((a) => a.isCorrect).length;
    const overallTotal = questAnswers.length;
    const overallPercentage =
      overallTotal > 0 ? Math.round((overallScore / overallTotal) * 100) : 0;

    // Strength tag
    let strengthTag = '';
    if (overallPercentage >= 80) strengthTag = 'Excellent';
    else if (overallPercentage >= 60) strengthTag = 'Good';
    else if (overallPercentage >= 40) strengthTag = 'Developing';
    else strengthTag = 'Needs Practice';

    return {
      questId,
      questName: info.name,
      icon: info.icon,
      overallScore,
      overallTotal,
      overallPercentage,
      functionalAge: Math.min(functionalAge, 7),
      ageLevels,
      strengthTag,
    };
  });
}

/**
 * Build radar chart data from subject breakdowns.
 * Returns array of { subject, functionalAge, fullMark } for recharts RadarChart.
 */
export function buildRadarData(
  breakdowns: SubjectAgeBreakdown[]
): { subject: string; functionalAge: number; fullMark: number }[] {
  return breakdowns.map((b) => ({
    subject: b.questName,
    functionalAge: b.functionalAge,
    fullMark: 7,
  }));
}

/**
 * Calculate overall readiness percentage.
 */
export function calculateReadiness(answers: DetailedAnswer[]): {
  score: number;
  total: number;
  percentage: number;
} {
  const score = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percentage };
}

/**
 * Calculate total stars earned across all quests.
 * Stars per quest: >= 80% = 3 stars, >= 50% = 2 stars, > 0% = 1 star, 0% = 0 stars
 */
export function calculateTotalStars(
  moduleResults: Record<string, { score: number; total: number }>
): { earned: number; possible: number } {
  let earned = 0;
  let possible = 0;

  Object.values(moduleResults).forEach(({ score, total }) => {
    possible += 3;
    if (total === 0) return;
    const pct = (score / total) * 100;
    if (pct >= 80) earned += 3;
    else if (pct >= 50) earned += 2;
    else if (pct > 0) earned += 1;
  });

  return { earned, possible };
}

/**
 * Generate subject-specific recommendations based on performance.
 */
export function generateRecommendations(
  breakdowns: SubjectAgeBreakdown[],
  childName: string
): { subject: string; icon: string; tip: { en: string; ms: string; zh: string } }[] {
  const recommendations: {
    subject: string;
    icon: string;
    tip: { en: string; ms: string; zh: string };
  }[] = [];

  const tipMap: Record<
    string,
    { weak: { en: string; ms: string; zh: string }; strong: { en: string; ms: string; zh: string } }
  > = {
    english: {
      weak: {
        en: 'Read English storybooks together for 15 minutes daily. Focus on letter sounds and simple words.',
        ms: 'Baca buku cerita Bahasa Inggeris bersama selama 15 minit setiap hari. Fokus pada bunyi huruf dan perkataan mudah.',
        zh: '每天一起阅读英语故事书15分钟，重点关注字母发音和简单词汇。',
      },
      strong: {
        en: 'Great English skills! Try introducing short chapter books and encourage writing simple sentences.',
        ms: 'Kemahiran Bahasa Inggeris yang hebat! Cuba perkenalkan buku bab pendek dan galakkan menulis ayat mudah.',
        zh: '英语技能很棒！尝试介绍简短的章节书并鼓励写简单的句子。',
      },
    },
    numbers: {
      weak: {
        en: 'Practice counting everyday objects — toys, fruits, steps. Use fingers and blocks for addition.',
        ms: 'Latih mengira objek harian — mainan, buah, tangga. Gunakan jari dan blok untuk penambahan.',
        zh: '练习数日常物品——玩具、水果、台阶。用手指和积木做加法。',
      },
      strong: {
        en: 'Strong number sense! Introduce simple word problems and pattern recognition games.',
        ms: 'Deria nombor yang kuat! Perkenalkan masalah perkataan mudah dan permainan corak.',
        zh: '数感很强！介绍简单的应用题和图案识别游戏。',
      },
    },
    bahasa: {
      weak: {
        en: 'Sing BM nursery rhymes and read Malay picture books together. Practice suku kata (syllables).',
        ms: 'Nyanyi lagu BM dan baca buku bergambar Melayu bersama. Latih suku kata.',
        zh: '一起唱马来语儿歌和阅读马来语绘本。练习音节。',
      },
      strong: {
        en: 'Excellent BM foundation! Encourage creating simple stories and writing in Jawi.',
        ms: 'Asas BM yang cemerlang! Galakkan mencipta cerita mudah dan menulis dalam Jawi.',
        zh: '马来语基础很好！鼓励创作简单故事和学习爪夷文书写。',
      },
    },
    mandarin: {
      weak: {
        en: 'Practice Chinese character recognition with flashcards. Sing Chinese nursery rhymes daily.',
        ms: 'Latih pengecaman aksara Cina dengan kad imbasan. Nyanyi lagu kanak-kanak Cina setiap hari.',
        zh: '用闪卡练习汉字认读。每天唱中文儿歌。',
      },
      strong: {
        en: 'Great Mandarin progress! Introduce simple reading books with pinyin and stroke writing practice.',
        ms: 'Kemajuan Mandarin yang hebat! Perkenalkan buku bacaan mudah dengan pinyin dan latihan menulis.',
        zh: '中文进步很大！介绍带拼音的简单读物和笔画练习。',
      },
    },
    science: {
      weak: {
        en: 'Explore nature together — observe plants, animals, weather. Ask "why" questions during walks.',
        ms: 'Teroka alam bersama — perhatikan tumbuhan, haiwan, cuaca. Tanya soalan "kenapa" semasa berjalan.',
        zh: '一起探索大自然——观察植物、动物、天气。散步时提"为什么"的问题。',
      },
      strong: {
        en: 'Wonderful curiosity! Try simple science experiments at home — mixing colours, growing seeds.',
        ms: 'Rasa ingin tahu yang hebat! Cuba eksperimen sains mudah di rumah — campuran warna, menanam biji benih.',
        zh: '好奇心很强！尝试简单的家庭科学实验——混合颜色、种植种子。',
      },
    },
  };

  breakdowns.forEach((b) => {
    // Try to match quest ID to tip map key
    const key = Object.keys(tipMap).find(
      (k) =>
        b.questId.toLowerCase().includes(k) ||
        b.questName.toLowerCase().includes(k)
    );
    const tips = key ? tipMap[key] : null;

    if (tips) {
      const tip = b.overallPercentage >= 60 ? tips.strong : tips.weak;
      recommendations.push({ subject: b.questName, icon: b.icon, tip });
    } else {
      // Generic recommendation
      const isStrong = b.overallPercentage >= 60;
      recommendations.push({
        subject: b.questName,
        icon: b.icon,
        tip: isStrong
          ? {
              en: `Great performance in ${b.questName}! Keep up the excellent work with daily practice.`,
              ms: `Prestasi hebat dalam ${b.questName}! Teruskan kerja cemerlang dengan latihan harian.`,
              zh: `${b.questName}表现很好！继续每天练习保持优秀。`,
            }
          : {
              en: `More practice needed in ${b.questName}. Try 10-15 minutes of focused activity daily.`,
              ms: `Lebih banyak latihan diperlukan dalam ${b.questName}. Cuba 10-15 minit aktiviti fokus setiap hari.`,
              zh: `${b.questName}需要更多练习。每天尝试10-15分钟的专注活动。`,
            },
      });
    }
  });

  return recommendations;
}

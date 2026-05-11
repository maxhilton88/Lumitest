/**
 * KSSR Skill Taxonomy v4 — Age-Based (338 skills, fallback)
 *
 * Hierarchy: Age -> Subject -> Topic -> Skill (with unique code)
 *
 * Age is DERIVED from the Skill Code middle segment:
 *   A4=age4, A5=age5, A6=age6, T1=age7 ... T6=age12
 *   Legacy PS codes map to age 4.
 *
 * This hardcoded data is the FALLBACK only.
 * The live taxonomy is loaded from KV via TaxonomyContext.
 */

// ── Age system ─────────────────────────────────────────────────────────────────

export const VALID_AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type ValidAge = (typeof VALID_AGES)[number];

export interface AgeInfo {
  age: number;
  displayLabel: string;
  tierLabel: string;
  tierColor: string;
  tierGlow: string;
}

export const AGE_INFO: Record<number, AgeInfo> = {
  4:  { age: 4,  displayLabel: 'Prasekolah Thn 1', tierLabel: 'Seedling',    tierColor: '#7cc643', tierGlow: 'rgba(124,198,67,0.3)' },
  5:  { age: 5,  displayLabel: 'Prasekolah Thn 2', tierLabel: 'Sprout',      tierColor: '#a3d977', tierGlow: 'rgba(163,217,119,0.3)' },
  6:  { age: 6,  displayLabel: 'Prasekolah Thn 3', tierLabel: 'Sapling',     tierColor: '#c5e84d', tierGlow: 'rgba(197,232,77,0.3)' },
  7:  { age: 7,  displayLabel: 'Tahun 1',           tierLabel: 'Scout',       tierColor: '#4ecdc4', tierGlow: 'rgba(78,205,196,0.3)' },
  8:  { age: 8,  displayLabel: 'Tahun 2',           tierLabel: 'Explorer',    tierColor: '#4a90e2', tierGlow: 'rgba(74,144,226,0.3)' },
  9:  { age: 9,  displayLabel: 'Tahun 3',           tierLabel: 'Knight',      tierColor: '#a78bfa', tierGlow: 'rgba(167,139,250,0.3)' },
  10: { age: 10, displayLabel: 'Tahun 4',           tierLabel: 'Champion',    tierColor: '#f59e0b', tierGlow: 'rgba(245,158,11,0.3)' },
  11: { age: 11, displayLabel: 'Tahun 5',           tierLabel: 'Hero',        tierColor: '#ef4444', tierGlow: 'rgba(239,68,68,0.3)' },
  12: { age: 12, displayLabel: 'Tahun 6',           tierLabel: 'Grandmaster', tierColor: '#ffd700', tierGlow: 'rgba(255,215,0,0.4)' },
};

/**
 * Extract age from a Skill Code's middle segment.
 * e.g. MAT-A4-N01 → 4, ENG-T3-G01 → 9, BM-PS-F01 → 4 (legacy)
 */
export function ageFromSkillCode(code: string): number {
  const parts = code.split('-');
  if (parts.length < 2) return 4;
  const seg = parts[1].toUpperCase();
  if (seg.startsWith('A')) return parseInt(seg.substring(1)) || 4;
  if (seg.startsWith('T')) return (parseInt(seg.substring(1)) || 1) + 6;
  if (seg === 'PS') return 4; // Legacy prasekolah
  return 4;
}

/** Get display label for an age (e.g. 7 → "Tahun 1") */
export function displayLabelFromAge(age: number): string {
  return AGE_INFO[age]?.displayLabel || `Age ${age}`;
}

// ── Subject definitions ────────────────────────────────────────────────────────

export type SubjectCode = 'MAT' | 'SCI' | 'ENG' | 'BM' | 'ZH' | 'GEO' | 'SJ';

export interface SubjectDef {
  code: SubjectCode;
  /** Internal quest ID used throughout the app */
  questId: string;
  name: { en: string; ms: string; zh: string };
  icon: string;
  color: string;
  glow: string;
  /** If true, parent can opt-out (default all selected) */
  optional: boolean;
}

export const SUBJECTS: SubjectDef[] = [
  {
    code: 'ENG',
    questId: 'english',
    name: { en: 'English', ms: 'Bahasa Inggeris', zh: '英语' },
    icon: '🌳',
    color: '#7cc643',
    glow: 'rgba(124,198,67,0.35)',
    optional: false,
  },
  {
    code: 'MAT',
    questId: 'math',
    name: { en: 'Mathematics', ms: 'Matematik', zh: '数学' },
    icon: '🔢',
    color: '#4a90e2',
    glow: 'rgba(74,144,226,0.35)',
    optional: false,
  },
  {
    code: 'BM',
    questId: 'bahasa',
    name: { en: 'Bahasa Melayu', ms: 'Bahasa Melayu', zh: '马来文' },
    icon: '🇲🇾',
    color: '#e74c3c',
    glow: 'rgba(231,76,60,0.35)',
    optional: false,
  },
  {
    code: 'ZH',
    questId: 'mandarin',
    name: { en: 'Chinese', ms: 'Bahasa Cina', zh: '华文' },
    icon: '🏔️',
    color: '#f39c12',
    glow: 'rgba(243,156,18,0.35)',
    optional: true,
  },
  {
    code: 'SCI',
    questId: 'science',
    name: { en: 'Science', ms: 'Sains', zh: '科学' },
    icon: '🔬',
    color: '#9b59b6',
    glow: 'rgba(155,89,182,0.35)',
    optional: false,
  },
  {
    code: 'SJ',
    questId: 'sejarah',
    name: { en: 'History', ms: 'Sejarah', zh: '历史' },
    icon: '📜',
    color: '#d97706',
    glow: 'rgba(217,119,6,0.35)',
    optional: true,
  },
  {
    code: 'GEO',
    questId: 'geography',
    name: { en: 'Geography', ms: 'Geografi', zh: '地理' },
    icon: '🌏',
    color: '#059669',
    glow: 'rgba(5,150,105,0.35)',
    optional: true,
  },
];

export const SUBJECT_BY_CODE: Record<SubjectCode, SubjectDef> = Object.fromEntries(
  SUBJECTS.map(s => [s.code, s])
) as Record<SubjectCode, SubjectDef>;

/** Maps quest IDs (including common aliases) to subject definitions */
export const SUBJECT_BY_QUEST_ID: Record<string, SubjectDef> = Object.fromEntries([
  ...SUBJECTS.map(s => [s.questId, s]),
  // Common aliases used by arena/quest system
  ['numbers', SUBJECTS.find(s => s.code === 'MAT')!],
  ['english', SUBJECTS.find(s => s.code === 'ENG')!],
  ['bahasa', SUBJECTS.find(s => s.code === 'BM')!],
  ['mandarin', SUBJECTS.find(s => s.code === 'ZH')!],
  ['science', SUBJECTS.find(s => s.code === 'SCI')!],
]) as Record<string, SubjectDef>;

// ── Skill taxonomy entry ───────────────────────────────────────────────────────

export interface SkillEntry {
  subject: SubjectCode;
  topic: string;      // Bidang / Topik
  subtopic: string;   // Kemahiran / Subtopik
  skillCode: string;  // e.g. "MAT-A4-N01" (age derived from this)
  age?: number;       // Explicit age (4-12). If present, takes priority over code-derived age.
}

/**
 * Resolve the age for a skill entry.
 * Uses explicit `age` field if available, otherwise derives from skill code.
 */
export function resolveSkillAge(skill: SkillEntry): number {
  if (skill.age != null && skill.age >= 4 && skill.age <= 12) return skill.age;
  return ageFromSkillCode(skill.skillCode);
}

/**
 * Full KSSR taxonomy — 338 skills (fallback/hardcoded).
 * Used for question tagging, mastery aggregation, and report drill-down.
 * Live taxonomy is loaded from KV via TaxonomyContext.
 */
export const SKILL_TAXONOMY: SkillEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PRASEKOLAH (45 skills) — legacy PS codes → age 4
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (8)
  { subject: 'MAT', topic: 'Nombor',    subtopic: 'Membilang objek 1\u201310',                                      skillCode: 'MAT-PS-N01' },
  { subject: 'MAT', topic: 'Nombor',    subtopic: 'Mengenal nombor dan lambang angka 1\u201310',                     skillCode: 'MAT-PS-N02' },
  { subject: 'MAT', topic: 'Nombor',    subtopic: 'Membanding lebih banyak dan lebih sedikit',                       skillCode: 'MAT-PS-N03' },
  { subject: 'MAT', topic: 'Operasi',   subtopic: 'Menambah dengan objek hingga 5',                                 skillCode: 'MAT-PS-O01' },
  { subject: 'MAT', topic: 'Bentuk 2D', subtopic: 'Mengenal bentuk: bulatan, segi tiga, segi empat',                skillCode: 'MAT-PS-B01' },
  { subject: 'MAT', topic: 'Ruang',     subtopic: 'Konsep: dalam, luar, atas, bawah, depan, belakang',              skillCode: 'MAT-PS-R01' },
  { subject: 'MAT', topic: 'Pola',      subtopic: 'Mengenal dan menyambung pola mudah',                             skillCode: 'MAT-PS-P01' },
  { subject: 'MAT', topic: 'Sukatan',   subtopic: 'Bandingkan panjang: panjang vs pendek',                          skillCode: 'MAT-PS-S01' },

  // Sains (7)
  { subject: 'SCI', topic: 'Hidupan',   subtopic: 'Benda hidup vs benda bukan hidup',                               skillCode: 'SCI-PS-H01' },
  { subject: 'SCI', topic: 'Hidupan',   subtopic: 'Lima deria manusia dan organ deria',                             skillCode: 'SCI-PS-H02' },
  { subject: 'SCI', topic: 'Hidupan',   subtopic: 'Bahagian badan manusia (kepala, tangan, kaki)',                   skillCode: 'SCI-PS-H03' },
  { subject: 'SCI', topic: 'Haiwan',    subtopic: 'Mengenal haiwan biasa dan bunyinya',                             skillCode: 'SCI-PS-A01' },
  { subject: 'SCI', topic: 'Tumbuhan',  subtopic: 'Bahagian tumbuhan: akar, batang, daun, bunga',                   skillCode: 'SCI-PS-T01' },
  { subject: 'SCI', topic: 'Cuaca',     subtopic: 'Keadaan cuaca: cerah, hujan, berangin',                          skillCode: 'SCI-PS-C01' },
  { subject: 'SCI', topic: 'Bahan',     subtopic: 'Sifat bahan: terapung atau tenggelam',                           skillCode: 'SCI-PS-M01' },

  // English (6)
  { subject: 'ENG', topic: 'Phonics',    subtopic: 'Mengenal huruf besar A\u2013Z',                                 skillCode: 'ENG-PS-P01' },
  { subject: 'ENG', topic: 'Phonics',    subtopic: 'Bunyi huruf awal (phonics): a, b, c\u2026',                     skillCode: 'ENG-PS-P02' },
  { subject: 'ENG', topic: 'Phonics',    subtopic: 'Mengenal huruf vokal (A, E, I, O, U)',                           skillCode: 'ENG-PS-P03' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Nama benda harian (cat, dog, ball, book)',                       skillCode: 'ENG-PS-V01' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Warna asas (red, blue, yellow, green)',                          skillCode: 'ENG-PS-V02' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Nombor dalam BI (one to ten)',                                   skillCode: 'ENG-PS-V03' },

  // Bahasa Melayu (5)
  { subject: 'BM', topic: 'Fonetik',   subtopic: 'Mengenal huruf vokal BM: a, e, i, o, u',                          skillCode: 'BM-PS-F01' },
  { subject: 'BM', topic: 'Fonetik',   subtopic: 'Suku kata KV: ba, bu, da, di, ma, mi',                            skillCode: 'BM-PS-F02' },
  { subject: 'BM', topic: 'Fonetik',   subtopic: 'Membatang perkataan dua suku kata KV+KV',                         skillCode: 'BM-PS-F03' },
  { subject: 'BM', topic: 'Kosa Kata', subtopic: 'Kosa kata benda harian (meja, kerusi, baju)',                      skillCode: 'BM-PS-K01' },
  { subject: 'BM', topic: 'Ayat',      subtopic: 'Memahami arahan mudah (duduk, berdiri, angkat tangan)',            skillCode: 'BM-PS-A01' },

  // Chinese (3)
  { subject: 'ZH', topic: 'Aksara', subtopic: 'Membilang 1\u201310 dalam aksara Cina (\u4e00\u5230\u5341)',          skillCode: 'ZH-PS-A01' },
  { subject: 'ZH', topic: 'Aksara', subtopic: 'Mengenal aksara asas (\u4eba, \u53e3, \u624b, \u773c, \u8033)',       skillCode: 'ZH-PS-A02' },
  { subject: 'ZH', topic: 'Pinyin', subtopic: 'Bunyi vokal Pinyin: a, o, e, i, u, \u00fc',                          skillCode: 'ZH-PS-P01' },

  // Geography (8)
  { subject: 'GEO', topic: 'Persekitaran Diri', subtopic: 'Mengenal persekitaran terdekat: rumah, sekolah, kedai',                    skillCode: 'GEO-PS-PD01' },
  { subject: 'GEO', topic: 'Persekitaran Diri', subtopic: 'Mengenal tempat dalam rumah: bilik tidur, dapur, bilik air',               skillCode: 'GEO-PS-PD02' },
  { subject: 'GEO', topic: 'Persekitaran Diri', subtopic: 'Mengenal kawasan: bandar vs kampung',                                     skillCode: 'GEO-PS-PD03' },
  { subject: 'GEO', topic: 'Alam Sekitar',      subtopic: 'Mengenal unsur alam: tanah, air, udara',                                  skillCode: 'GEO-PS-AS01' },
  { subject: 'GEO', topic: 'Alam Sekitar',      subtopic: 'Mengenal permukaan bumi: darat dan laut',                                 skillCode: 'GEO-PS-AS02' },
  { subject: 'GEO', topic: 'Cuaca & Iklim',     subtopic: 'Keadaan cuaca harian: panas, hujan, mendung, berangin',                   skillCode: 'GEO-PS-CK01' },
  { subject: 'GEO', topic: 'Pengangkutan',      subtopic: 'Jenis pengangkutan: darat, air, udara',                                   skillCode: 'GEO-PS-PG01' },
  { subject: 'GEO', topic: 'Arah',              subtopic: 'Konsep arah mudah: kiri, kanan, depan, belakang',                         skillCode: 'GEO-PS-AR01' },

  // Sejarah (8)
  { subject: 'SJ', topic: 'Identiti Diri',      subtopic: 'Nama, umur, keluarga \u2013 siapa saya',                                  skillCode: 'SJ-PS-ID01' },
  { subject: 'SJ', topic: 'Identiti Diri',      subtopic: 'Mengenal ahli keluarga: ibu, ayah, adik-beradik',                         skillCode: 'SJ-PS-ID02' },
  { subject: 'SJ', topic: 'Budaya & Perayaan',  subtopic: 'Mengenal perayaan Malaysia: Hari Raya, CNY, Deepavali, Krismas',          skillCode: 'SJ-PS-BP01' },
  { subject: 'SJ', topic: 'Budaya & Perayaan',  subtopic: 'Mengenal pakaian tradisional kaum',                                       skillCode: 'SJ-PS-BP02' },
  { subject: 'SJ', topic: 'Budaya & Perayaan',  subtopic: 'Mengenal makanan tradisional kaum',                                       skillCode: 'SJ-PS-BP03' },
  { subject: 'SJ', topic: 'Simbol Negara',      subtopic: 'Mengenal bendera Malaysia (Jalur Gemilang)',                               skillCode: 'SJ-PS-SN01' },
  { subject: 'SJ', topic: 'Simbol Negara',      subtopic: 'Mengenal bunga kebangsaan: Bunga Raya',                                   skillCode: 'SJ-PS-SN02' },
  { subject: 'SJ', topic: 'Komuniti',           subtopic: 'Mengenal pekerjaan dalam komuniti: doktor, guru, polis',                   skillCode: 'SJ-PS-KM01' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 1 / Age 7 (56 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (11)
  { subject: 'MAT', topic: 'Nombor Bulat',      subtopic: 'Nilai nombor bulat hingga 100',                              skillCode: 'MAT-T1-N01' },
  { subject: 'MAT', topic: 'Nombor Bulat',      subtopic: 'Membilang dalam lingkungan 100 (1s, 2s, 5s, 10s)',            skillCode: 'MAT-T1-N02' },
  { subject: 'MAT', topic: 'Nombor Bulat',      subtopic: 'Nilai tempat: puluh dan sa',                                 skillCode: 'MAT-T1-N03' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tambah', subtopic: 'Menambah dua nombor, hasil dalam lingkungan 100',         skillCode: 'MAT-T1-OT01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tambah', subtopic: 'Pasangan nombor bagi suatu jumlah (nombor bon)',          skillCode: 'MAT-T1-OT02' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tolak',  subtopic: 'Menolak dua nombor dalam lingkungan 100',                 skillCode: 'MAT-T1-OL01' },
  { subject: 'MAT', topic: 'Wang',              subtopic: 'Mengenal syiling Malaysia (5 sen hingga RM1)',                skillCode: 'MAT-T1-W01' },
  { subject: 'MAT', topic: 'Masa',              subtopic: "Membaca jam \u2013 tepat (o'clock)",                          skillCode: 'MAT-T1-M01' },
  { subject: 'MAT', topic: 'Sukatan Panjang',   subtopic: 'Mengukur panjang menggunakan unit tidak piawai',              skillCode: 'MAT-T1-SP01' },
  { subject: 'MAT', topic: 'Bentuk 2D & 3D',    subtopic: 'Mengenal dan menamakan bentuk 2D dan 3D',                    skillCode: 'MAT-T1-B01' },
  { subject: 'MAT', topic: 'Data',              subtopic: 'Membaca piktograf mudah',                                    skillCode: 'MAT-T1-D01' },

  // Sains (8)
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Ciri-ciri benda hidup dan bukan hidup',                         skillCode: 'SCI-T1-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Keperluan asas hidupan: air, makanan, udara, cahaya',            skillCode: 'SCI-T1-H02' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Deria manusia dan fungsinya',                                   skillCode: 'SCI-T1-H03' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Haiwan: ciri-ciri dan pengkelasan asas',                        skillCode: 'SCI-T1-A01' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Tumbuhan: bahagian-bahagian dan fungsinya',                     skillCode: 'SCI-T1-T01' },
  { subject: 'SCI', topic: 'Sains Fizikal',  subtopic: 'Magnet: bahan yang boleh dan tidak boleh ditarik magnet',        skillCode: 'SCI-T1-F01' },
  { subject: 'SCI', topic: 'Sains Bahan',    subtopic: 'Penyerapan: bahan menyerap dan tidak menyerap air',             skillCode: 'SCI-T1-B01' },
  { subject: 'SCI', topic: 'Bumi & Angkasa', subtopic: 'Permukaan bumi: tanah, batu, pasir',                            skillCode: 'SCI-T1-E01' },

  // English (6)
  { subject: 'ENG', topic: 'Phonics',     subtopic: 'Bunyi huruf CVC (cat, dog, pin)',                                  skillCode: 'ENG-T1-P01' },
  { subject: 'ENG', topic: 'Phonics',     subtopic: 'Perkataan CVC \u2013 isi huruf yang hilang (c_t)',                  skillCode: 'ENG-T1-P02' },
  { subject: 'ENG', topic: 'Sight Words', subtopic: 'Mengenal dan membaca sight words (I, am, is, the, a, can)',         skillCode: 'ENG-T1-SW01' },
  { subject: 'ENG', topic: 'Vocabulary',  subtopic: 'Kosa kata topik: animals, colours, food, school items',             skillCode: 'ENG-T1-V01' },
  { subject: 'ENG', topic: 'Grammar',     subtopic: 'Ayat mudah: subjek + predikat',                                    skillCode: 'ENG-T1-G01' },
  { subject: 'ENG', topic: 'Writing',     subtopic: 'Menulis huruf besar dan huruf kecil dengan betul',                 skillCode: 'ENG-T1-W01' },

  // Bahasa Melayu (11)
  { subject: 'BM', topic: 'Fonetik',     subtopic: 'Suku kata KV: ba, be, bi, bo, bu',                                 skillCode: 'BM-T1-F01' },
  { subject: 'BM', topic: 'Fonetik',     subtopic: 'Suku kata KVK: bab, cak, dal, mil',                                skillCode: 'BM-T1-F02' },
  { subject: 'BM', topic: 'Fonetik',     subtopic: 'Membatang dan membaca perkataan KVKV',                              skillCode: 'BM-T1-F03' },
  { subject: 'BM', topic: 'Fonetik',     subtopic: 'Membatang dan membaca perkataan KVKVK',                             skillCode: 'BM-T1-F04' },
  { subject: 'BM', topic: 'Ejaan',       subtopic: 'Mengeja dan menulis perkataan KV+KV',                               skillCode: 'BM-T1-E01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kata Nama Am dan Kata Nama Khas',                                   skillCode: 'BM-T1-T01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kata Ganti Nama Diri (saya, awak, dia)',                             skillCode: 'BM-T1-T02' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kata Kerja Aktif Transitif',                                        skillCode: 'BM-T1-T03' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kata Adjektif (sifat benda)',                                       skillCode: 'BM-T1-T04' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Imbuhan Awalan (me-)',                                              skillCode: 'BM-T1-T05' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Jenis Ayat: Ayat Penyata',                                         skillCode: 'BM-T1-T06' },

  // Chinese (6)
  { subject: 'ZH', topic: 'Aksara',    subtopic: 'Mengenal dan membaca aksara asas Tahun 1 (~150 aksara)',               skillCode: 'ZH-T1-A01' },
  { subject: 'ZH', topic: 'Pinyin',    subtopic: 'Pinyin: huruf konsonan (b, p, m, f, d, t\u2026)',                      skillCode: 'ZH-T1-P01' },
  { subject: 'ZH', topic: 'Pinyin',    subtopic: 'Pinyin 4 nada (nada 1\u20134)',                                       skillCode: 'ZH-T1-P02' },
  { subject: 'ZH', topic: 'Ductus',    subtopic: 'Urutan ductus (\u7b14\u987a) aksara asas',                            skillCode: 'ZH-T1-B01' },
  { subject: 'ZH', topic: 'Kosa Kata', subtopic: 'Kosa kata topik: keluarga, sekolah, nombor',                          skillCode: 'ZH-T1-K01' },
  { subject: 'ZH', topic: 'Ayat',      subtopic: 'Membina ayat mudah menggunakan \u662f/\u6709/\u5728',                 skillCode: 'ZH-T1-Y01' },

  // Geography (7)
  { subject: 'GEO', topic: 'Persekitaran',  subtopic: 'Mengenal kawasan: rumah, sekolah, kedai, pasar',                 skillCode: 'GEO-T1-PK01' },
  { subject: 'GEO', topic: 'Persekitaran',  subtopic: 'Mengenal jiran dan komuniti',                                    skillCode: 'GEO-T1-PK02' },
  { subject: 'GEO', topic: 'Peta Mudah',    subtopic: 'Membaca pelan mudah (bilik darjah, sekolah)',                     skillCode: 'GEO-T1-PM01' },
  { subject: 'GEO', topic: 'Arah',          subtopic: 'Mengenal arah: kiri, kanan, depan, belakang, atas, bawah',       skillCode: 'GEO-T1-AR01' },
  { subject: 'GEO', topic: 'Alam Sekitar',  subtopic: 'Mengenal tumbuhan dan haiwan di persekitaran',                   skillCode: 'GEO-T1-AS01' },
  { subject: 'GEO', topic: 'Cuaca',         subtopic: 'Mengenal cuaca dan pakaian yang sesuai',                         skillCode: 'GEO-T1-CW01' },
  { subject: 'GEO', topic: 'Pengangkutan',  subtopic: 'Jenis pengangkutan di darat, air dan udara',                     skillCode: 'GEO-T1-PG01' },

  // Sejarah (7)
  { subject: 'SJ', topic: 'Identiti & Keluarga', subtopic: 'Mengenal keluarga asas dan peranan ahli keluarga',          skillCode: 'SJ-T1-IK01' },
  { subject: 'SJ', topic: 'Identiti & Keluarga', subtopic: 'Mengenal negara Malaysia \u2013 saya rakyat Malaysia',      skillCode: 'SJ-T1-IK02' },
  { subject: 'SJ', topic: 'Budaya',              subtopic: 'Perayaan kaum di Malaysia: Hari Raya, CNY, Deepavali',      skillCode: 'SJ-T1-BD01' },
  { subject: 'SJ', topic: 'Budaya',              subtopic: 'Pakaian tradisional mengikut kaum',                         skillCode: 'SJ-T1-BD02' },
  { subject: 'SJ', topic: 'Budaya',              subtopic: 'Makanan tradisional mengikut kaum',                         skillCode: 'SJ-T1-BD03' },
  { subject: 'SJ', topic: 'Simbol Negara',       subtopic: 'Jalur Gemilang: warna dan lambang',                         skillCode: 'SJ-T1-SN01' },
  { subject: 'SJ', topic: 'Simbol Negara',       subtopic: 'Lagu Negaraku \u2013 lagu kebangsaan',                      skillCode: 'SJ-T1-SN02' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 2 / Age 8 (50 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (11)
  { subject: 'MAT', topic: 'Nombor Bulat',          subtopic: 'Nilai nombor bulat hingga 1000',                         skillCode: 'MAT-T2-N01' },
  { subject: 'MAT', topic: 'Nombor Bulat',          subtopic: 'Membilang dalam lingkungan 1000',                        skillCode: 'MAT-T2-N02' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tambah', subtopic: 'Tambah dua nombor, hasil dalam lingkungan 1000',         skillCode: 'MAT-T2-OT01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tolak',  subtopic: 'Tolak dua nombor dalam lingkungan 1000',                 skillCode: 'MAT-T2-OL01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Darab',  subtopic: 'Sifir 2, 3, 4, 5',                                      skillCode: 'MAT-T2-OD01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Bahagi', subtopic: 'Konsep bahagi sama rata',                                skillCode: 'MAT-T2-OB01' },
  { subject: 'MAT', topic: 'Wang',                  subtopic: 'Nilai wang kertas RM1\u2013RM50',                        skillCode: 'MAT-T2-W01' },
  { subject: 'MAT', topic: 'Masa',                  subtopic: 'Membaca jam \u2013 setengah dan suku jam',               skillCode: 'MAT-T2-M01' },
  { subject: 'MAT', topic: 'Panjang',               subtopic: 'Mengukur panjang menggunakan cm dan m',                  skillCode: 'MAT-T2-P01' },
  { subject: 'MAT', topic: 'Jisim',                 subtopic: 'Menimbang jisim menggunakan g dan kg',                   skillCode: 'MAT-T2-J01' },
  { subject: 'MAT', topic: 'Data',                  subtopic: 'Membina dan membaca carta palang mudah',                 skillCode: 'MAT-T2-D01' },

  // Sains (6)
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Kitaran hidup haiwan (kupu-kupu, katak)',                       skillCode: 'SCI-T2-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Keperluan haiwan: makanan, air, tempat tinggal',                skillCode: 'SCI-T2-H02' },
  { subject: 'SCI', topic: 'Sains Hayat',    subtopic: 'Pengkelasan tumbuhan: berbunga dan tidak berbunga',             skillCode: 'SCI-T2-T01' },
  { subject: 'SCI', topic: 'Sains Fizikal',  subtopic: 'Daya tolak dan tarik',                                         skillCode: 'SCI-T2-F01' },
  { subject: 'SCI', topic: 'Sains Bahan',    subtopic: 'Keadaan jirim: pepejal, cecair, gas',                           skillCode: 'SCI-T2-B01' },
  { subject: 'SCI', topic: 'Bumi & Angkasa', subtopic: 'Objek langit: matahari, bulan, bintang',                        skillCode: 'SCI-T2-E01' },

  // English (7)
  { subject: 'ENG', topic: 'Phonics',    subtopic: 'Dwigraf: sh, ch, th, wh',                                          skillCode: 'ENG-T2-P01' },
  { subject: 'ENG', topic: 'Phonics',    subtopic: 'Bunyi vokal panjang: a-e, i-e, o-e (cake, bike, home)',              skillCode: 'ENG-T2-P02' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Kata sifat: big, small, happy, sad',                                skillCode: 'ENG-T2-V01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata nama jamak regular (cat\u2192cats)',                            skillCode: 'ENG-T2-G01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata kerja present tense (run, eat, play)',                          skillCode: 'ENG-T2-G02' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Artikel: a, an, the',                                               skillCode: 'ENG-T2-G03' },
  { subject: 'ENG', topic: 'Writing',    subtopic: 'Menulis ayat mudah dengan tanda baca betul',                         skillCode: 'ENG-T2-W01' },

  // Bahasa Melayu (8)
  { subject: 'BM', topic: 'Membaca',    subtopic: 'Membaca dan memahami teks pendek (1\u20132 perenggan)',               skillCode: 'BM-T2-MB01' },
  { subject: 'BM', topic: 'Ejaan',      subtopic: 'Mengeja perkataan KVK+KV, KV+KVK, KVKK',                            skillCode: 'BM-T2-E01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Penjodoh Bilangan (ekor, orang, biji, buah, helai)',                  skillCode: 'BM-T2-T01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Kata Kerja Pasif (di- + kata kerja)',                                 skillCode: 'BM-T2-T02' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Kata Sendi Nama (di, ke, dari, pada, untuk)',                         skillCode: 'BM-T2-T03' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Imbuhan Akhiran (-kan, -an, -i)',                                    skillCode: 'BM-T2-T04' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Kata Ganda Penuh',                                                  skillCode: 'BM-T2-T05' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Jenis Ayat: Ayat Tanya',                                            skillCode: 'BM-T2-T06' },

  // Chinese (5)
  { subject: 'ZH', topic: 'Aksara',     subtopic: 'Aksara Tahun 2 (~200 aksara kumulatif)',                              skillCode: 'ZH-T2-A01' },
  { subject: 'ZH', topic: 'Radikal',    subtopic: 'Mengenal radikal asas (\u4eba, \u6c34, \u6728, \u706b, \u571f, \u53e3)', skillCode: 'ZH-T2-R01' },
  { subject: 'ZH', topic: 'Kosa Kata',  subtopic: 'Kosa kata topik: badan manusia, makanan, haiwan',                    skillCode: 'ZH-T2-K01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Ayat tanya menggunakan \u5417/\u4ec0\u4e48/\u54ea\u91cc/\u8c01',    skillCode: 'ZH-T2-G01' },
  { subject: 'ZH', topic: 'Bacaan',     subtopic: 'Memahami teks pendek dan menjawab soalan',                           skillCode: 'ZH-T2-B01' },

  // Geography (8)
  { subject: 'GEO', topic: 'Peta',          subtopic: 'Membaca dan memahami simbol peta mudah',                         skillCode: 'GEO-T2-PT01' },
  { subject: 'GEO', topic: 'Peta',          subtopic: 'Mengenal arah mata angin: Utara, Selatan, Timur, Barat',         skillCode: 'GEO-T2-AR01' },
  { subject: 'GEO', topic: 'Malaysia',      subtopic: 'Mengenal Malaysia: benua, jiran, lautan',                        skillCode: 'GEO-T2-MY01' },
  { subject: 'GEO', topic: 'Malaysia',      subtopic: 'Mengenal Semenanjung Malaysia vs Sabah & Sarawak',               skillCode: 'GEO-T2-MY02' },
  { subject: 'GEO', topic: 'Alam Sekitar',  subtopic: 'Mengenal hutan, sungai, gunung dan pantai',                      skillCode: 'GEO-T2-AS01' },
  { subject: 'GEO', topic: 'Cuaca & Iklim', subtopic: 'Malaysia beriklim khatulistiwa: panas dan lembap sepanjang tahun', skillCode: 'GEO-T2-CK01' },
  { subject: 'GEO', topic: 'Komuniti',      subtopic: 'Jenis-jenis tempat dalam komuniti: hospital, stesen polis, sekolah', skillCode: 'GEO-T2-KM01' },

  // Sejarah (5+1)
  { subject: 'SJ', topic: 'Budaya Malaysia', subtopic: 'Kepelbagaian kaum di Malaysia: Melayu, Cina, India, dll',       skillCode: 'SJ-T2-BM01' },
  { subject: 'SJ', topic: 'Budaya Malaysia', subtopic: 'Bahasa perpaduan: Bahasa Malaysia',                             skillCode: 'SJ-T2-BM02' },
  { subject: 'SJ', topic: 'Simbol Negara',   subtopic: 'Jata Negara: lambang-lambang',                                 skillCode: 'SJ-T2-SN01' },
  { subject: 'SJ', topic: 'Simbol Negara',   subtopic: 'Bunga kebangsaan, sukan kebangsaan, warna bendera',             skillCode: 'SJ-T2-SN02' },
  { subject: 'SJ', topic: 'Komuniti',        subtopic: 'Peranan pemimpin komuniti: ketua kampung, ahli majlis',         skillCode: 'SJ-T2-KM01' },
  { subject: 'SJ', topic: 'Rukun Negara',    subtopic: 'Pengenalan Rukun Negara (5 prinsip)',                           skillCode: 'SJ-T2-RN01' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 3 / Age 9 (49 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (11)
  { subject: 'MAT', topic: 'Nombor Bulat',          subtopic: 'Nilai nombor bulat hingga 10 000',                       skillCode: 'MAT-T3-N01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tambah', subtopic: 'Tambah hingga tiga nombor dalam 10 000',                 skillCode: 'MAT-T3-OT01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Tolak',  subtopic: 'Tolak dua nombor dalam lingkungan 10 000',               skillCode: 'MAT-T3-OL01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Darab',  subtopic: 'Sifir 6, 7, 8, 9',                                      skillCode: 'MAT-T3-OD01' },
  { subject: 'MAT', topic: 'Operasi \u2013 Bahagi', subtopic: 'Bahagi dalam lingkungan sifir 2\u20139',                  skillCode: 'MAT-T3-OB01' },
  { subject: 'MAT', topic: 'Pecahan',               subtopic: 'Mengenal dan menamakan pecahan (1/2, 1/3, 1/4, 1/5)',    skillCode: 'MAT-T3-PC01' },
  { subject: 'MAT', topic: 'Pecahan',               subtopic: 'Membanding dan menyusun pecahan',                       skillCode: 'MAT-T3-PC02' },
  { subject: 'MAT', topic: 'Wang',                  subtopic: 'Operasi bergabung melibatkan wang',                      skillCode: 'MAT-T3-W01' },
  { subject: 'MAT', topic: 'Masa',                  subtopic: 'Membaca jam \u2013 minit (3:15, 4:45)',                  skillCode: 'MAT-T3-M01' },
  { subject: 'MAT', topic: 'Panjang',               subtopic: 'Menukar unit: m ke cm, km ke m',                         skillCode: 'MAT-T3-P01' },
  { subject: 'MAT', topic: 'Data',                  subtopic: 'Membaca dan menafsir carta palang',                      skillCode: 'MAT-T3-D01' },

  // Sains (5)
  { subject: 'SCI', topic: 'Sains Hayat',      subtopic: 'Pembiakan haiwan: bertelur dan melahirkan anak',              skillCode: 'SCI-T3-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',      subtopic: 'Pembiakan tumbuhan: benih, spora, keratan',                   skillCode: 'SCI-T3-T01' },
  { subject: 'SCI', topic: 'Sains Fizikal',    subtopic: 'Daya: graviti, daya tolak, daya tarik',                       skillCode: 'SCI-T3-F01' },
  { subject: 'SCI', topic: 'Sains Bahan',      subtopic: 'Sifat bahan: keras, lembut, telus, legap',                    skillCode: 'SCI-T3-B01' },
  { subject: 'SCI', topic: 'Kemahiran Proses', subtopic: 'Kemahiran memerhati dan mengelas',                            skillCode: 'SCI-T3-KP01' },

  // English (7)
  { subject: 'ENG', topic: 'Reading',    subtopic: 'Membaca dan memahami teks pendek \u2013 soalan fakta',              skillCode: 'ENG-T3-R01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata kerja lampau regular (+ed)',                                    skillCode: 'ENG-T3-G01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata kerja lampau irregular (go\u2192went)',                         skillCode: 'ENG-T3-G02' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata nama jamak tidak teratur (child\u2192children)',                 skillCode: 'ENG-T3-G03' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata depan tempat (in, on, under, beside, between)',                 skillCode: 'ENG-T3-G04' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata hubung (and, but, because, so, or)',                            skillCode: 'ENG-T3-G05' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Sinonim dan antonim mudah',                                         skillCode: 'ENG-T3-V01' },

  // Bahasa Melayu (7)
  { subject: 'BM', topic: 'Membaca',     subtopic: 'Membaca dan memahami petikan prosa',                                skillCode: 'BM-T3-MB01' },
  { subject: 'BM', topic: 'Ejaan',       subtopic: 'Mengeja perkataan berimbuhan awalan',                               skillCode: 'BM-T3-E01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Imbuhan Awalan: ber-, ter-, pe-',                                   skillCode: 'BM-T3-T01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kata Majmuk Rangkai Kata Bebas',                                    skillCode: 'BM-T3-T02' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Jenis Ayat: Ayat Perintah dan Ayat Seruan',                         skillCode: 'BM-T3-T03' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Bentuk Ayat: Ayat Tunggal dan Ayat Majmuk',                         skillCode: 'BM-T3-T04' },
  { subject: 'BM', topic: 'Seni Bahasa', subtopic: 'Melafaz dan memahami pantun dua kerat',                             skillCode: 'BM-T3-SB01' },

  // Chinese (5)
  { subject: 'ZH', topic: 'Aksara',     subtopic: 'Aksara Tahun 3 (~300 aksara kumulatif)',                              skillCode: 'ZH-T3-A01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Kata adjektif \u2013 membanding (\u6bd4)',                            skillCode: 'ZH-T3-G01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Penegas masa: \u4eca\u5929, \u6628\u5929, \u660e\u5929',             skillCode: 'ZH-T3-G02' },
  { subject: 'ZH', topic: 'Bacaan',     subtopic: 'Memahami teks deskriptif pendek',                                    skillCode: 'ZH-T3-B01' },
  { subject: 'ZH', topic: 'Penulisan',  subtopic: 'Susun semula ayat mengikut urutan betul',                            skillCode: 'ZH-T3-P01' },

  // Geography (8)
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Mengenal 14 negeri Malaysia dan wilayah persekutuan',            skillCode: 'GEO-T3-MY01' },
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Ibu negeri bagi setiap negeri Malaysia',                         skillCode: 'GEO-T3-MY02' },
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Mengenal peta Malaysia dan kedudukan negeri',                    skillCode: 'GEO-T3-MY03' },
  { subject: 'GEO', topic: 'Asia Tenggara',  subtopic: 'Negara-negara Asia Tenggara (ASEAN)',                            skillCode: 'GEO-T3-AT01' },
  { subject: 'GEO', topic: 'Asia Tenggara',  subtopic: 'Jiran-jiran Malaysia (Thailand, Singapura, Indonesia, Brunei)',   skillCode: 'GEO-T3-AT02' },
  { subject: 'GEO', topic: 'Dunia',          subtopic: 'Mengenal 7 benua dunia',                                        skillCode: 'GEO-T3-DU01' },
  { subject: 'GEO', topic: 'Dunia',          subtopic: 'Mengenal lautan dunia (Lautan Hindi, Pasifik, Atlantik)',         skillCode: 'GEO-T3-DU02' },
  { subject: 'GEO', topic: 'Alam Sekitar',   subtopic: 'Sumber semula jadi Malaysia: petroleum, getah, sawit, kayu',     skillCode: 'GEO-T3-AS01' },

  // Sejarah (6)
  { subject: 'SJ', topic: 'Sejarah Tempatan', subtopic: 'Mengenal sejarah kawasan tempatan (bandar, kampung)',            skillCode: 'SJ-T3-ST01' },
  { subject: 'SJ', topic: 'Kerajaan Awal',    subtopic: 'Pengenalan kerajaan Melayu awal: Srivijaya, Langkasuka',        skillCode: 'SJ-T3-KA01' },
  { subject: 'SJ', topic: 'Kerajaan Awal',    subtopic: 'Pengenalan Kesultanan Melayu Melaka',                           skillCode: 'SJ-T3-KA02' },
  { subject: 'SJ', topic: 'Tokoh',            subtopic: 'Mengenal tokoh tempatan dan sumbangan mereka',                  skillCode: 'SJ-T3-TK01' },
  { subject: 'SJ', topic: 'Perpaduan',        subtopic: 'Konsep perpaduan kaum di Malaysia',                             skillCode: 'SJ-T3-PD01' },
  { subject: 'SJ', topic: 'Simbol Negara',    subtopic: 'Rukun Negara \u2013 5 prinsip secara urutan',                   skillCode: 'SJ-T3-SN01' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 4 / Age 10 (48 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (12)
  { subject: 'MAT', topic: 'Nombor Bulat',      subtopic: 'Nilai nombor bulat hingga 100 000',                          skillCode: 'MAT-T4-N01' },
  { subject: 'MAT', topic: 'Nombor Bulat',      subtopic: 'Operasi bergabung darab dan bahagi',                          skillCode: 'MAT-T4-N02' },
  { subject: 'MAT', topic: 'Pecahan',           subtopic: 'Pecahan wajar, tidak wajar, nombor bercampur',                skillCode: 'MAT-T4-PC01' },
  { subject: 'MAT', topic: 'Pecahan',           subtopic: 'Penambahan dan penolakan pecahan penyebut sama',              skillCode: 'MAT-T4-PC02' },
  { subject: 'MAT', topic: 'Perpuluhan',        subtopic: 'Perpuluhan 1 tempat perpuluhan',                             skillCode: 'MAT-T4-PP01' },
  { subject: 'MAT', topic: 'Perpuluhan',        subtopic: 'Hubungan perpuluhan dan pecahan (0.5 = 1/2)',                 skillCode: 'MAT-T4-PP02' },
  { subject: 'MAT', topic: 'Wang',              subtopic: 'Tambah, tolak, darab dan bahagi wang',                        skillCode: 'MAT-T4-W01' },
  { subject: 'MAT', topic: 'Masa',              subtopic: 'Tempoh masa: jam, minit, saat',                               skillCode: 'MAT-T4-M01' },
  { subject: 'MAT', topic: 'Perimeter & Luas',  subtopic: 'Mengira perimeter segiempat dan segi tiga',                   skillCode: 'MAT-T4-PL01' },
  { subject: 'MAT', topic: 'Perimeter & Luas',  subtopic: 'Mengira luas segiempat tepat dan segiempat sama',             skillCode: 'MAT-T4-PL02' },
  { subject: 'MAT', topic: 'Data',              subtopic: 'Membaca dan menafsirkan carta palang berganda',               skillCode: 'MAT-T4-D01' },

  // Sains (7)
  { subject: 'SCI', topic: 'Sains Hayat',      subtopic: 'Pemakanan manusia: kumpulan makanan, piramid makanan',         skillCode: 'SCI-T4-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',      subtopic: 'Sistem pernafasan manusia',                                   skillCode: 'SCI-T4-H02' },
  { subject: 'SCI', topic: 'Sains Hayat',      subtopic: 'Adaptasi haiwan terhadap persekitaran',                       skillCode: 'SCI-T4-A01' },
  { subject: 'SCI', topic: 'Sains Fizikal',    subtopic: 'Sumber tenaga: matahari, air, angin, bahan api',              skillCode: 'SCI-T4-F01' },
  { subject: 'SCI', topic: 'Sains Fizikal',    subtopic: 'Haba: konduktor dan penebat haba',                            skillCode: 'SCI-T4-H03' },
  { subject: 'SCI', topic: 'Sains Bumi',       subtopic: 'Sumber semula jadi: boleh diperbaharui dan tidak boleh',       skillCode: 'SCI-T4-E01' },
  { subject: 'SCI', topic: 'Kemahiran Proses', subtopic: 'Kaedah saintifik: hipotesis, ujikaji, kesimpulan',             skillCode: 'SCI-T4-KP01' },

  // English (4+1)
  { subject: 'ENG', topic: 'Reading', subtopic: 'Membaca dan memahami teks \u2013 fakta dan inferens',                   skillCode: 'ENG-T4-R01' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Kata bantu: can, must, should, will, would',                            skillCode: 'ENG-T4-G01' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Kata sifat perbandingan: -er, -est',                                    skillCode: 'ENG-T4-G02' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Kata keterangan cara (-ly)',                                            skillCode: 'ENG-T4-G03' },
  { subject: 'ENG', topic: 'Writing', subtopic: 'Menulis perenggan dengan idea tersusun',                                skillCode: 'ENG-T4-W01' },

  // Bahasa Melayu (6)
  { subject: 'BM', topic: 'Membaca',    subtopic: 'Membaca dan memahami pelbagai jenis teks',                            skillCode: 'BM-T4-MB01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Imbuhan Awalan: men-, mem-, meng-, meny-',                            skillCode: 'BM-T4-T01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Kata Ganda Separa dan Berentak',                                      skillCode: 'BM-T4-T02' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Simpulan Bahasa \u2013 maksud',                                       skillCode: 'BM-T4-T03' },
  { subject: 'BM', topic: 'Penulisan',  subtopic: 'Mengenal pasti kesilapan ejaan dalam ayat',                            skillCode: 'BM-T4-P01' },
  { subject: 'BM', topic: 'Penulisan',  subtopic: 'Menulis surat tidak rasmi',                                           skillCode: 'BM-T4-P02' },

  // Chinese (5)
  { subject: 'ZH', topic: 'Aksara',     subtopic: 'Aksara Tahun 4 (~400 aksara kumulatif)',                               skillCode: 'ZH-T4-A01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Ayat \u628a (\u628a\u5b57\u53e5)',                                    skillCode: 'ZH-T4-G01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Ayat pasif menggunakan \u88ab',                                       skillCode: 'ZH-T4-G02' },
  { subject: 'ZH', topic: 'Bacaan',     subtopic: 'Memahami teks naratif',                                               skillCode: 'ZH-T4-B01' },
  { subject: 'ZH', topic: 'Idiom',      subtopic: 'Makna Chengyu asas: \u4e00\u77f3\u4e8c\u9e1f',                        skillCode: 'ZH-T4-I01' },

  // Geography (7)
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Mengenal 14 negeri: lokasi, ibu negeri, lambang',                skillCode: 'GEO-T4-MY01' },
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Bentuk muka bumi Malaysia: gunung, sungai, pantai, tanah pamah', skillCode: 'GEO-T4-MY02' },
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Iklim Malaysia: monsun timur laut dan monsun barat daya',        skillCode: 'GEO-T4-MY03' },
  { subject: 'GEO', topic: 'Malaysia',       subtopic: 'Sumber asli Malaysia dan kepentingannya',                        skillCode: 'GEO-T4-MY04' },
  { subject: 'GEO', topic: 'Peta',           subtopic: 'Membaca skala peta',                                            skillCode: 'GEO-T4-PT01' },
  { subject: 'GEO', topic: 'Peta',           subtopic: 'Membaca dan menggunakan grid peta',                              skillCode: 'GEO-T4-PT02' },
  { subject: 'GEO', topic: 'Asia Tenggara',  subtopic: 'Negara-negara ASEAN dan ibu negerinya',                          skillCode: 'GEO-T4-AT01' },

  // Sejarah (7)
  { subject: 'SJ', topic: 'Kemahiran Sejarah', subtopic: 'Pengertian sejarah dan sumber sejarah',                        skillCode: 'SJ-T4-KS01' },
  { subject: 'SJ', topic: 'Kemahiran Sejarah', subtopic: 'Konsep masa: kronologi dan urutan peristiwa',                  skillCode: 'SJ-T4-KS02' },
  { subject: 'SJ', topic: 'Tamadun Awal',      subtopic: 'Tamadun awal di Asia Tenggara',                               skillCode: 'SJ-T4-TA01' },
  { subject: 'SJ', topic: 'Kerajaan Melayu',   subtopic: 'Kerajaan Melayu awal: Kedah Tua, Srivijaya, Langkasuka',      skillCode: 'SJ-T4-KM01' },
  { subject: 'SJ', topic: 'Kerajaan Melayu',   subtopic: 'Kesultanan Melayu Melaka: penubuhan dan pemerintahan',         skillCode: 'SJ-T4-KM02' },
  { subject: 'SJ', topic: 'Kerajaan Melayu',   subtopic: 'Sistem pemerintahan Kesultanan Melaka',                        skillCode: 'SJ-T4-KM03' },
  { subject: 'SJ', topic: 'Ekonomi',           subtopic: 'Melaka sebagai pusat perdagangan antarabangsa',                skillCode: 'SJ-T4-EK01' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 5 / Age 11 (46 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (11)
  { subject: 'MAT', topic: 'Nombor Bulat', subtopic: 'Nombor bulat hingga 1 juta',                                       skillCode: 'MAT-T5-N01' },
  { subject: 'MAT', topic: 'Pecahan',      subtopic: 'Tambah dan tolak pecahan berlainan penyebut',                       skillCode: 'MAT-T5-PC01' },
  { subject: 'MAT', topic: 'Pecahan',      subtopic: 'Darab pecahan dengan nombor bulat',                                 skillCode: 'MAT-T5-PC02' },
  { subject: 'MAT', topic: 'Perpuluhan',   subtopic: 'Perpuluhan sehingga 3 tempat perpuluhan',                           skillCode: 'MAT-T5-PP01' },
  { subject: 'MAT', topic: 'Peratusan',    subtopic: 'Menukar pecahan/perpuluhan kepada peratus',                          skillCode: 'MAT-T5-PE01' },
  { subject: 'MAT', topic: 'Peratusan',    subtopic: 'Mengira peratusan bagi suatu kuantiti',                              skillCode: 'MAT-T5-PE02' },
  { subject: 'MAT', topic: 'Nisbah',       subtopic: 'Konsep nisbah dan bentuk termudah',                                  skillCode: 'MAT-T5-NS01' },
  { subject: 'MAT', topic: 'Luas & Isipadu', subtopic: 'Luas segi tiga',                                                  skillCode: 'MAT-T5-LI01' },
  { subject: 'MAT', topic: 'Luas & Isipadu', subtopic: 'Isipadu kiub dan kuboid',                                          skillCode: 'MAT-T5-LI02' },
  { subject: 'MAT', topic: 'Statistik',    subtopic: 'Mengira min (purata)',                                               skillCode: 'MAT-T5-ST01' },
  { subject: 'MAT', topic: 'Statistik',    subtopic: 'Membaca dan menafsir carta garis',                                   skillCode: 'MAT-T5-ST02' },

  // Sains (7)
  { subject: 'SCI', topic: 'Sains Hayat',   subtopic: 'Sistem rangka manusia dan fungsinya',                              skillCode: 'SCI-T5-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',   subtopic: 'Sistem penghadaman: organ dan proses',                             skillCode: 'SCI-T5-H02' },
  { subject: 'SCI', topic: 'Sains Fizikal', subtopic: 'Cahaya: pantulan dan pembiasan',                                   skillCode: 'SCI-T5-F01' },
  { subject: 'SCI', topic: 'Sains Fizikal', subtopic: 'Elektrik: litar siri dan selari',                                  skillCode: 'SCI-T5-F02' },
  { subject: 'SCI', topic: 'Sains Fizikal', subtopic: 'Mesin mudah: tuil, pulli, satah condong, gear',                    skillCode: 'SCI-T5-F03' },
  { subject: 'SCI', topic: 'Sains Bumi',    subtopic: 'Ekosistem: rantai makanan dan siratan makanan',                    skillCode: 'SCI-T5-E01' },
  { subject: 'SCI', topic: 'Sains Bumi',    subtopic: 'Pencemaran: jenis, punca dan kesan',                               skillCode: 'SCI-T5-E02' },

  // English (6)
  { subject: 'ENG', topic: 'Reading',    subtopic: 'Membaca dan memahami teks \u2013 inferens dan penilaian',              skillCode: 'ENG-T5-R01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Ayat aktif dan ayat pasif',                                           skillCode: 'ENG-T5-G01' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Ucapan cakap ajuk dan cakap pindah',                                  skillCode: 'ENG-T5-G02' },
  { subject: 'ENG', topic: 'Grammar',    subtopic: 'Kata hubung: although, however, therefore, moreover',                  skillCode: 'ENG-T5-G03' },
  { subject: 'ENG', topic: 'Vocabulary', subtopic: 'Sinonim dan antonim peringkat menengah',                               skillCode: 'ENG-T5-V01' },
  { subject: 'ENG', topic: 'Writing',    subtopic: 'Menulis karangan berformat: e-mel, laporan, artikel',                  skillCode: 'ENG-T5-W01' },

  // Bahasa Melayu (5)
  { subject: 'BM', topic: 'Membaca',    subtopic: 'Membaca dan memahami teks \u2013 soalan KBAT',                         skillCode: 'BM-T5-MB01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Tanda Baca: koma, noktah bertindih, sempang',                          skillCode: 'BM-T5-T01' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Ayat Aktif dan Ayat Pasif',                                            skillCode: 'BM-T5-T02' },
  { subject: 'BM', topic: 'Tatabahasa', subtopic: 'Peribahasa: Perumpamaan',                                              skillCode: 'BM-T5-T03' },
  { subject: 'BM', topic: 'Penulisan',  subtopic: 'Menulis karangan perbincangan',                                        skillCode: 'BM-T5-P01' },

  // Chinese (4)
  { subject: 'ZH', topic: 'Aksara',     subtopic: 'Aksara Tahun 5 (~500 aksara kumulatif)',                                skillCode: 'ZH-T5-A01' },
  { subject: 'ZH', topic: 'Idiom',      subtopic: 'Peribahasa Cina (\u6210\u8bed): lengkap dan makna',                    skillCode: 'ZH-T5-I01' },
  { subject: 'ZH', topic: 'Tatabahasa', subtopic: 'Kenal pasti kesilapan tatabahasa dalam ayat',                          skillCode: 'ZH-T5-G01' },
  { subject: 'ZH', topic: 'Bacaan',     subtopic: 'Memahami teks fakta \u2013 soalan KBAT',                               skillCode: 'ZH-T5-B01' },

  // Geography (7)
  { subject: 'GEO', topic: 'Asia Tenggara',  subtopic: 'Ibu negeri negara ASEAN',                                        skillCode: 'GEO-T5-AT01' },
  { subject: 'GEO', topic: 'Asia Tenggara',  subtopic: 'Ciri-ciri fizikal negara ASEAN',                                 skillCode: 'GEO-T5-AT02' },
  { subject: 'GEO', topic: 'Dunia',          subtopic: 'Benua-benua dunia dan ciri-cirinya',                              skillCode: 'GEO-T5-DU01' },
  { subject: 'GEO', topic: 'Dunia',          subtopic: 'Lautan-lautan dunia',                                             skillCode: 'GEO-T5-DU02' },
  { subject: 'GEO', topic: 'Iklim Dunia',    subtopic: 'Zon iklim dunia: tropika, sederhana, kutub',                      skillCode: 'GEO-T5-IK01' },
  { subject: 'GEO', topic: 'Iklim Dunia',    subtopic: 'Garis khatulistiwa dan pengaruhnya',                              skillCode: 'GEO-T5-IK02' },
  { subject: 'GEO', topic: 'Alam Sekitar',   subtopic: 'Bencana alam: banjir, tanah runtuh, ribut',                       skillCode: 'GEO-T5-AS01' },

  // Sejarah (6)
  { subject: 'SJ', topic: 'Penjajahan',     subtopic: 'Kejatuhan Melaka kepada Portugis (1511)',                          skillCode: 'SJ-T5-PJ01' },
  { subject: 'SJ', topic: 'Penjajahan',     subtopic: 'Penjajahan Belanda di Melaka',                                     skillCode: 'SJ-T5-PJ02' },
  { subject: 'SJ', topic: 'Penjajahan',     subtopic: 'Penjajahan British: Sistem Residen',                               skillCode: 'SJ-T5-PJ03' },
  { subject: 'SJ', topic: 'Perlembagaan',   subtopic: 'Islam sebagai agama rasmi Malaysia',                               skillCode: 'SJ-T5-PM01' },
  { subject: 'SJ', topic: 'Perlembagaan',   subtopic: 'Yang di-Pertuan Agong: peranan dan kuasa',                         skillCode: 'SJ-T5-PM02' },
  { subject: 'SJ', topic: 'Perlembagaan',   subtopic: 'Hak asasi rakyat Malaysia dalam Perlembagaan',                     skillCode: 'SJ-T5-PM03' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAHUN 6 / Age 12 (44 skills)
  // ═══════════════════════════════════════════════════════════════════════════

  // Matematik (10)
  { subject: 'MAT', topic: 'Nombor & Operasi',  subtopic: 'Operasi bergabung dalam lingkungan 1 juta',                   skillCode: 'MAT-T6-N01' },
  { subject: 'MAT', topic: 'Pecahan',           subtopic: 'Bahagi pecahan dengan nombor bulat',                           skillCode: 'MAT-T6-PC01' },
  { subject: 'MAT', topic: 'Perpuluhan',        subtopic: 'Darab dan bahagi perpuluhan',                                  skillCode: 'MAT-T6-PP01' },
  { subject: 'MAT', topic: 'Peratusan',         subtopic: 'Masalah peratusan: untung dan rugi',                            skillCode: 'MAT-T6-PE01' },
  { subject: 'MAT', topic: 'Nisbah',            subtopic: 'Membahagikan kuantiti mengikut nisbah',                         skillCode: 'MAT-T6-NS01' },
  { subject: 'MAT', topic: 'Koordinat',         subtopic: 'Mengenal pasti koordinat (x, y) dalam satah Cartes',            skillCode: 'MAT-T6-KO01' },
  { subject: 'MAT', topic: 'Koordinat',         subtopic: 'Mengira jarak antara dua titik',                                skillCode: 'MAT-T6-KO02' },
  { subject: 'MAT', topic: 'Statistik',         subtopic: 'Mengira min, mod dan median',                                   skillCode: 'MAT-T6-ST01' },
  { subject: 'MAT', topic: 'Statistik',         subtopic: 'Membaca pelbagai jenis graf',                                   skillCode: 'MAT-T6-ST02' },
  { subject: 'MAT', topic: 'Kebarangkalian',    subtopic: 'Konsep kebarangkalian: pasti, mungkin, mustahil',                skillCode: 'MAT-T6-KB01' },

  // Sains (6)
  { subject: 'SCI', topic: 'Sains Hayat',   subtopic: 'Mikroorganisma: jenis, peranan dan bahaya',                       skillCode: 'SCI-T6-H01' },
  { subject: 'SCI', topic: 'Sains Hayat',   subtopic: 'Rantai makanan dan siratan makanan',                               skillCode: 'SCI-T6-H02' },
  { subject: 'SCI', topic: 'Sains Fizikal', subtopic: 'Gerhana matahari dan gerhana bulan',                               skillCode: 'SCI-T6-F01' },
  { subject: 'SCI', topic: 'Sains Fizikal', subtopic: 'Sistem suria: planet dan graviti',                                  skillCode: 'SCI-T6-F02' },
  { subject: 'SCI', topic: 'Sains Bumi',    subtopic: 'Kitaran air',                                                       skillCode: 'SCI-T6-E01' },
  { subject: 'SCI', topic: 'Sains Bumi',    subtopic: 'Isu alam sekitar: pemanasan global, penipisan ozon',                skillCode: 'SCI-T6-E02' },

  // English (5)
  { subject: 'ENG', topic: 'Reading', subtopic: 'Bacaan komprehensif \u2013 penilaian kritikal',                           skillCode: 'ENG-T6-R01' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Semua tenses \u2013 review dan penggunaan tepat',                         skillCode: 'ENG-T6-G01' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Klausa relatif (who, which, that)',                                       skillCode: 'ENG-T6-G02' },
  { subject: 'ENG', topic: 'Grammar', subtopic: 'Ayat bersyarat \u2013 if clauses (Type 1 & 2)',                           skillCode: 'ENG-T6-G03' },
  { subject: 'ENG', topic: 'Writing', subtopic: 'Menulis esei perbincangan dua pendirian',                                 skillCode: 'ENG-T6-W01' },

  // Bahasa Melayu (5)
  { subject: 'BM', topic: 'Membaca',     subtopic: 'Bacaan komprehensif: prosa klasik dan moden',                         skillCode: 'BM-T6-MB01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Kesilapan ejaan dan tatabahasa dalam ayat',                           skillCode: 'BM-T6-T01' },
  { subject: 'BM', topic: 'Tatabahasa',  subtopic: 'Peribahasa: Bidalan dan pepatah',                                     skillCode: 'BM-T6-T02' },
  { subject: 'BM', topic: 'Penulisan',   subtopic: 'Menulis karangan imaginatif dan berita',                              skillCode: 'BM-T6-P01' },
  { subject: 'BM', topic: 'Seni Bahasa', subtopic: 'Memahami dan menganalisis puisi moden',                               skillCode: 'BM-T6-SB01' },

  // Chinese (4)
  { subject: 'ZH', topic: 'Aksara',       subtopic: 'Aksara Tahun 6 (~600+ aksara kumulatif)',                             skillCode: 'ZH-T6-A01' },
  { subject: 'ZH', topic: 'Bacaan',       subtopic: 'Bacaan komprehensif \u2013 artikel fakta dan naratif',                skillCode: 'ZH-T6-B01' },
  { subject: 'ZH', topic: 'Tatabahasa',   subtopic: 'Kesilapan tatabahasa: kenal pasti dan betulkan',                     skillCode: 'ZH-T6-G01' },
  { subject: 'ZH', topic: 'Puisi Klasik', subtopic: 'Memahami puisi klasik Cina (\u53e4\u8bd7)',                          skillCode: 'ZH-T6-PK01' },

  // Geography (6)
  { subject: 'GEO', topic: 'Dunia',         subtopic: 'Zon masa dunia dan perbezaan masa',                                skillCode: 'GEO-T6-DU01' },
  { subject: 'GEO', topic: 'Dunia',         subtopic: 'Negara-negara membangun vs maju',                                  skillCode: 'GEO-T6-DU02' },
  { subject: 'GEO', topic: 'Alam Sekitar',  subtopic: 'Isu global: pemanasan global, penebangan hutan',                   skillCode: 'GEO-T6-AS01' },
  { subject: 'GEO', topic: 'Alam Sekitar',  subtopic: 'Kepentingan menjaga alam sekitar',                                 skillCode: 'GEO-T6-AS02' },
  { subject: 'GEO', topic: 'Malaysia',      subtopic: 'Pembangunan ekonomi Malaysia: pelancongan, perindustrian',          skillCode: 'GEO-T6-MY01' },
  { subject: 'GEO', topic: 'Peta',          subtopic: 'Membaca dan menafsir peta topografi',                              skillCode: 'GEO-T6-PT01' },

  // Sejarah (8)
  { subject: 'SJ', topic: 'Kemerdekaan',          subtopic: 'Perjuangan kemerdekaan Malaysia',                            skillCode: 'SJ-T6-KM01' },
  { subject: 'SJ', topic: 'Kemerdekaan',          subtopic: 'Tokoh-tokoh kemerdekaan dan sumbangan mereka',               skillCode: 'SJ-T6-KM02' },
  { subject: 'SJ', topic: 'Pembentukan Malaysia', subtopic: 'Penubuhan Malaysia 16 September 1963',                      skillCode: 'SJ-T6-PM01' },
  { subject: 'SJ', topic: 'Pembentukan Malaysia', subtopic: 'Cabaran selepas pembentukan Malaysia',                      skillCode: 'SJ-T6-PM02' },
  { subject: 'SJ', topic: 'Perlembagaan',        subtopic: 'Rukun Negara: prinsip dan maknanya',                         skillCode: 'SJ-T6-PN01' },
  { subject: 'SJ', topic: 'Perlembagaan',        subtopic: 'Struktur kerajaan: Eksekutif, Legislatif, Kehakiman',        skillCode: 'SJ-T6-PN02' },
  { subject: 'SJ', topic: 'Pencapaian',          subtopic: 'Pencapaian Malaysia selepas merdeka',                         skillCode: 'SJ-T6-PC01' },
  { subject: 'SJ', topic: 'Pencapaian',          subtopic: 'Perdana Menteri Malaysia dan sumbangan mereka',               skillCode: 'SJ-T6-PC02' },
];

// ── Derived lookup maps ────────────────────────────────────────────────────────

/** O(1) lookup: skillCode -> SkillEntry */
export const SKILL_BY_CODE: Record<string, SkillEntry> = Object.fromEntries(
  SKILL_TAXONOMY.map(s => [s.skillCode, s])
);

/**
 * Nested map: age -> subject -> topic -> SkillEntry[]
 * Useful for building topic-level weakness reports.
 */
export const SKILL_TREE: Record<number, Record<string, Record<string, SkillEntry[]>>> = {};
for (const s of SKILL_TAXONOMY) {
  const age = resolveSkillAge(s);
  if (!SKILL_TREE[age]) SKILL_TREE[age] = {};
  if (!SKILL_TREE[age][s.subject]) SKILL_TREE[age][s.subject] = {};
  if (!SKILL_TREE[age][s.subject][s.topic]) SKILL_TREE[age][s.subject][s.topic] = [];
  SKILL_TREE[age][s.subject][s.topic].push(s);
}

/** All unique topic names for a given subject (across all ages) */
export const TOPICS_BY_SUBJECT: Record<SubjectCode, string[]> = {} as any;
for (const s of SKILL_TAXONOMY) {
  if (!TOPICS_BY_SUBJECT[s.subject]) TOPICS_BY_SUBJECT[s.subject] = [];
  if (!TOPICS_BY_SUBJECT[s.subject].includes(s.topic)) {
    TOPICS_BY_SUBJECT[s.subject].push(s.topic);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Get all skills for a given age */
export function getSkillsByAge(age: number): SkillEntry[] {
  return SKILL_TAXONOMY.filter(s => resolveSkillAge(s) === age);
}

/** Get all skills for a given subject at a given age */
export function getSkillsByAgeAndSubject(age: number, subject: SubjectCode): SkillEntry[] {
  return SKILL_TAXONOMY.filter(s => resolveSkillAge(s) === age && s.subject === subject);
}

/** Get unique topics for a subject at an age */
export function getTopicsForSubject(age: number, subject: SubjectCode): string[] {
  const skills = getSkillsByAgeAndSubject(age, subject);
  return [...new Set(skills.map(s => s.topic))];
}

/** Look up a skill by its code — O(1) via SKILL_BY_CODE map */
export function getSkillByCode(code: string): SkillEntry | undefined {
  return SKILL_BY_CODE[code];
}

/** Get all skills under a specific topic at a given age and subject */
export function getSkillsByTopic(age: number, subject: SubjectCode, topic: string): SkillEntry[] {
  return SKILL_TREE[age]?.[subject]?.[topic] || [];
}

// ── Backward compat aliases (deprecated — use age-based API) ───────────────

/** @deprecated Use VALID_AGES instead */
export type KSSRLevel = string;
/** @deprecated Use VALID_AGES instead */
export const KSSR_LEVELS: string[] = VALID_AGES.map(a => AGE_INFO[a].displayLabel);
/** @deprecated Use AGE_INFO instead */
export const LEVEL_INFO: Record<string, AgeInfo & { level: string; ageRange: [number, number] }> = Object.fromEntries(
  VALID_AGES.map(a => {
    const info = AGE_INFO[a];
    return [info.displayLabel, { ...info, level: info.displayLabel, ageRange: [a, a] as [number, number] }];
  })
);

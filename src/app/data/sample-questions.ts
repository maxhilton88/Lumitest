/**
 * sample-questions.ts — Hardcoded sample question bank for MVP testing
 *
 * ~60 questions across 3 age groups (age 4, 7, 8) and all 7 subjects.
 * Each question is tagged with the KSSR skill taxonomy code.
 *
 * Structure matches the future Postgres `questions` table schema.
 * The frontend consumes these via getQuestionsByAge().
 *
 * Question format is compatible with the existing QuestionScreen component.
 */

import { ageFromSkillCode, displayLabelFromAge, type SubjectCode } from './kssr-taxonomy';

export interface TaxonomyQuestion {
  id: string;
  skillCode: string;
  age: number;
  subject: SubjectCode;
  topic: string;
  subtopic: string;
  /** Trilingual question text */
  question: { en: string; ms: string; zh: string };
  /** MCQ options — id + trilingual text */
  options: Array<{
    id: string;
    text: { en: string; ms: string; zh: string };
  }>;
  correctAnswer: string; // option id
  /** Foxy encouragement message */
  foxyMessage?: { en: string; ms: string; zh: string };
  type: 'mcq';
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
}

// ─────────────────────────────────────────────────────────────────────────────
// AGE 4
// ─────────────────────────────────────────────────────────────────────────────

const AGE4_QUESTIONS: TaxonomyQuestion[] = [
  // ── MAT: Nombor ──
  {
    id: 'q-ps-mat-01', skillCode: 'MAT-PS-N01', age: 4, subject: 'MAT',
    topic: 'Nombor', subtopic: 'Membilang objek 1-10', type: 'mcq', difficulty: 1,
    question: { en: 'How many apples are there? 🍎🍎🍎', ms: 'Berapa biji epal? 🍎🍎🍎', zh: '有多少个苹果？🍎🍎🍎' },
    options: [
      { id: 'a', text: { en: '2', ms: '2', zh: '2' } },
      { id: 'b', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'c', text: { en: '4', ms: '4', zh: '4' } },
      { id: 'd', text: { en: '5', ms: '5', zh: '5' } },
    ],
    correctAnswer: 'b',
    foxyMessage: { en: 'Count carefully!', ms: 'Kira dengan teliti!', zh: '仔细数一数！' },
  },
  {
    id: 'q-ps-mat-02', skillCode: 'MAT-PS-N02', age: 4, subject: 'MAT',
    topic: 'Nombor', subtopic: 'Mengenal nombor dan lambang angka 1-10', type: 'mcq', difficulty: 1,
    question: { en: 'Which number comes after 5?', ms: 'Nombor manakah selepas 5?', zh: '5后面是什么数字？' },
    options: [
      { id: 'a', text: { en: '4', ms: '4', zh: '4' } },
      { id: 'b', text: { en: '6', ms: '6', zh: '6' } },
      { id: 'c', text: { en: '7', ms: '7', zh: '7' } },
      { id: 'd', text: { en: '3', ms: '3', zh: '3' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-mat-03', skillCode: 'MAT-PS-N03', age: 4, subject: 'MAT',
    topic: 'Nombor', subtopic: 'Membanding lebih banyak dan lebih sedikit', type: 'mcq', difficulty: 1,
    question: { en: 'Which group has MORE? Group A: 🌟🌟🌟 or Group B: 🌟🌟🌟🌟🌟', ms: 'Kumpulan mana LEBIH BANYAK? A: 🌟🌟🌟 atau B: 🌟🌟🌟🌟🌟', zh: '哪组更多？A组：🌟🌟🌟 还是 B组：🌟🌟🌟🌟🌟' },
    options: [
      { id: 'a', text: { en: 'Group A', ms: 'Kumpulan A', zh: 'A组' } },
      { id: 'b', text: { en: 'Group B', ms: 'Kumpulan B', zh: 'B组' } },
      { id: 'c', text: { en: 'They are the same', ms: 'Sama banyak', zh: '一样多' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-mat-04', skillCode: 'MAT-PS-O01', age: 4, subject: 'MAT',
    topic: 'Operasi', subtopic: 'Menambah dengan objek hingga 5', type: 'mcq', difficulty: 1,
    question: { en: '2 balls + 1 ball = how many balls?', ms: '2 bola + 1 bola = berapa bola?', zh: '2个球 + 1个球 = 几个球？' },
    options: [
      { id: 'a', text: { en: '2', ms: '2', zh: '2' } },
      { id: 'b', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'c', text: { en: '4', ms: '4', zh: '4' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-mat-05', skillCode: 'MAT-PS-B01', age: 4, subject: 'MAT',
    topic: 'Bentuk 2D', subtopic: 'Mengenal bentuk', type: 'mcq', difficulty: 1,
    question: { en: 'What shape is a ball? ⚽', ms: 'Apakah bentuk bola? ⚽', zh: '球是什么形状？⚽' },
    options: [
      { id: 'a', text: { en: 'Circle', ms: 'Bulatan', zh: '圆形' } },
      { id: 'b', text: { en: 'Square', ms: 'Segi empat', zh: '正方形' } },
      { id: 'c', text: { en: 'Triangle', ms: 'Segi tiga', zh: '三角形' } },
    ],
    correctAnswer: 'a',
  },
  // ── SCI ──
  {
    id: 'q-ps-sci-01', skillCode: 'SCI-PS-H01', age: 4, subject: 'SCI',
    topic: 'Hidupan', subtopic: 'Benda hidup vs benda bukan hidup', type: 'mcq', difficulty: 1,
    question: { en: 'Which one is a living thing?', ms: 'Yang manakah benda hidup?', zh: '哪个是有生命的？' },
    options: [
      { id: 'a', text: { en: 'Rock', ms: 'Batu', zh: '石头' } },
      { id: 'b', text: { en: 'Cat', ms: 'Kucing', zh: '猫' } },
      { id: 'c', text: { en: 'Table', ms: 'Meja', zh: '桌子' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-sci-02', skillCode: 'SCI-PS-H02', age: 4, subject: 'SCI',
    topic: 'Hidupan', subtopic: 'Lima deria manusia', type: 'mcq', difficulty: 1,
    question: { en: 'Which body part do we use to hear sounds?', ms: 'Bahagian badan mana kita gunakan untuk mendengar bunyi?', zh: '我们用哪个身体部位听声音？' },
    options: [
      { id: 'a', text: { en: 'Eyes', ms: 'Mata', zh: '眼睛' } },
      { id: 'b', text: { en: 'Nose', ms: 'Hidung', zh: '鼻子' } },
      { id: 'c', text: { en: 'Ears', ms: 'Telinga', zh: '耳朵' } },
    ],
    correctAnswer: 'c',
  },
  {
    id: 'q-ps-sci-03', skillCode: 'SCI-PS-T01', age: 4, subject: 'SCI',
    topic: 'Tumbuhan', subtopic: 'Bahagian tumbuhan', type: 'mcq', difficulty: 1,
    question: { en: 'Which part of a plant grows underground?', ms: 'Bahagian tumbuhan mana yang tumbuh di bawah tanah?', zh: '植物的哪个部分长在地下？' },
    options: [
      { id: 'a', text: { en: 'Leaf', ms: 'Daun', zh: '叶子' } },
      { id: 'b', text: { en: 'Flower', ms: 'Bunga', zh: '花' } },
      { id: 'c', text: { en: 'Root', ms: 'Akar', zh: '根' } },
    ],
    correctAnswer: 'c',
  },
  // ── ENG ──
  {
    id: 'q-ps-eng-01', skillCode: 'ENG-PS-P01', age: 4, subject: 'ENG',
    topic: 'Phonics', subtopic: 'Mengenal huruf besar A-Z', type: 'mcq', difficulty: 1,
    question: { en: 'Which is the letter "B"?', ms: 'Yang manakah huruf "B"?', zh: '哪个是字母"B"？' },
    options: [
      { id: 'a', text: { en: 'D', ms: 'D', zh: 'D' } },
      { id: 'b', text: { en: 'B', ms: 'B', zh: 'B' } },
      { id: 'c', text: { en: 'P', ms: 'P', zh: 'P' } },
      { id: 'd', text: { en: 'R', ms: 'R', zh: 'R' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-eng-02', skillCode: 'ENG-PS-V02', age: 4, subject: 'ENG',
    topic: 'Vocabulary', subtopic: 'Warna asas', type: 'mcq', difficulty: 1,
    question: { en: 'What colour is the sky on a sunny day?', ms: 'Apakah warna langit pada hari cerah?', zh: '晴天的天空是什么颜色？' },
    options: [
      { id: 'a', text: { en: 'Red', ms: 'Merah', zh: '红色' } },
      { id: 'b', text: { en: 'Blue', ms: 'Biru', zh: '蓝色' } },
      { id: 'c', text: { en: 'Green', ms: 'Hijau', zh: '绿色' } },
    ],
    correctAnswer: 'b',
  },
  // ── BM ──
  {
    id: 'q-ps-bm-01', skillCode: 'BM-PS-F01', age: 4, subject: 'BM',
    topic: 'Fonetik', subtopic: 'Mengenal huruf vokal BM', type: 'mcq', difficulty: 1,
    question: { en: 'Which of these is a vowel (huruf vokal)?', ms: 'Yang manakah huruf vokal?', zh: '以下哪个是元音字母？' },
    options: [
      { id: 'a', text: { en: 'B', ms: 'B', zh: 'B' } },
      { id: 'b', text: { en: 'A', ms: 'A', zh: 'A' } },
      { id: 'c', text: { en: 'K', ms: 'K', zh: 'K' } },
      { id: 'd', text: { en: 'M', ms: 'M', zh: 'M' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-bm-02', skillCode: 'BM-PS-K01', age: 4, subject: 'BM',
    topic: 'Kosa Kata', subtopic: 'Kosa kata benda harian', type: 'mcq', difficulty: 1,
    question: { en: 'What is "table" in Bahasa Melayu?', ms: 'Apakah "table" dalam Bahasa Melayu?', zh: '"桌子"的马来语是什么？' },
    options: [
      { id: 'a', text: { en: 'Kerusi', ms: 'Kerusi', zh: 'Kerusi' } },
      { id: 'b', text: { en: 'Meja', ms: 'Meja', zh: 'Meja' } },
      { id: 'c', text: { en: 'Baju', ms: 'Baju', zh: 'Baju' } },
    ],
    correctAnswer: 'b',
  },
  // ── ZH ──
  {
    id: 'q-ps-zh-01', skillCode: 'ZH-PS-A01', age: 4, subject: 'ZH',
    topic: 'Aksara', subtopic: 'Membilang 1-10 dalam aksara Cina', type: 'mcq', difficulty: 1,
    question: { en: 'What is the Chinese character for "3"?', ms: 'Apakah aksara Cina untuk "3"?', zh: '"3"的汉字是什么？' },
    options: [
      { id: 'a', text: { en: '二', ms: '二', zh: '二' } },
      { id: 'b', text: { en: '三', ms: '三', zh: '三' } },
      { id: 'c', text: { en: '四', ms: '四', zh: '四' } },
    ],
    correctAnswer: 'b',
  },
  // ── GEO ──
  {
    id: 'q-ps-geo-01', skillCode: 'GEO-PS-PD01', age: 4, subject: 'GEO',
    topic: 'Persekitaran Diri', subtopic: 'Mengenal persekitaran terdekat', type: 'mcq', difficulty: 1,
    question: { en: 'Where do you learn and play with friends?', ms: 'Di manakah anda belajar dan bermain dengan kawan?', zh: '你在哪里和朋友一起学习和玩耍？' },
    options: [
      { id: 'a', text: { en: 'Hospital', ms: 'Hospital', zh: '医院' } },
      { id: 'b', text: { en: 'School', ms: 'Sekolah', zh: '学校' } },
      { id: 'c', text: { en: 'Airport', ms: 'Lapangan terbang', zh: '机场' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-geo-02', skillCode: 'GEO-PS-AS01', age: 4, subject: 'GEO',
    topic: 'Alam Sekitar', subtopic: 'Mengenal unsur alam', type: 'mcq', difficulty: 1,
    question: { en: 'Which of these do fish live in?', ms: 'Yang manakah ikan hidup di dalamnya?', zh: '鱼生活在哪里？' },
    options: [
      { id: 'a', text: { en: 'Sand', ms: 'Pasir', zh: '沙子' } },
      { id: 'b', text: { en: 'Water', ms: 'Air', zh: '水' } },
      { id: 'c', text: { en: 'Fire', ms: 'Api', zh: '火' } },
    ],
    correctAnswer: 'b',
  },
  // ── SJ ──
  {
    id: 'q-ps-sj-01', skillCode: 'SJ-PS-BP01', age: 4, subject: 'SJ',
    topic: 'Budaya & Perayaan', subtopic: 'Mengenal perayaan Malaysia', type: 'mcq', difficulty: 1,
    question: { en: 'Which celebration do Malay people celebrate?', ms: 'Perayaan manakah yang disambut oleh orang Melayu?', zh: '马来人庆祝什么节日？' },
    options: [
      { id: 'a', text: { en: 'Chinese New Year', ms: 'Tahun Baru Cina', zh: '农历新年' } },
      { id: 'b', text: { en: 'Hari Raya Aidilfitri', ms: 'Hari Raya Aidilfitri', zh: '开斋节' } },
      { id: 'c', text: { en: 'Deepavali', ms: 'Deepavali', zh: '屠妖节' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-ps-sj-02', skillCode: 'SJ-PS-SN01', age: 4, subject: 'SJ',
    topic: 'Simbol Negara', subtopic: 'Mengenal bendera Malaysia', type: 'mcq', difficulty: 1,
    question: { en: 'What is the name of the Malaysian flag?', ms: 'Apakah nama bendera Malaysia?', zh: '马来西亚国旗叫什么名字？' },
    options: [
      { id: 'a', text: { en: 'Union Jack', ms: 'Union Jack', zh: 'Union Jack' } },
      { id: 'b', text: { en: 'Jalur Gemilang', ms: 'Jalur Gemilang', zh: '辉煌条纹' } },
      { id: 'c', text: { en: 'Stars and Stripes', ms: 'Stars and Stripes', zh: '星条旗' } },
    ],
    correctAnswer: 'b',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AGE 7
// ─────────────────────────────────────────────────────────────────────────────

const AGE7_QUESTIONS: TaxonomyQuestion[] = [
  // ── MAT ──
  {
    id: 'q-t1-mat-01', skillCode: 'MAT-T1-N01', age: 7, subject: 'MAT',
    topic: 'Nombor Bulat', subtopic: 'Nilai nombor bulat hingga 100', type: 'mcq', difficulty: 1,
    question: { en: 'What number is between 48 and 50?', ms: 'Nombor manakah antara 48 dan 50?', zh: '48和50之间是什么数字？' },
    options: [
      { id: 'a', text: { en: '47', ms: '47', zh: '47' } },
      { id: 'b', text: { en: '49', ms: '49', zh: '49' } },
      { id: 'c', text: { en: '51', ms: '51', zh: '51' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t1-mat-02', skillCode: 'MAT-T1-OT01', age: 7, subject: 'MAT',
    topic: 'Operasi - Tambah', subtopic: 'Menambah dua nombor', type: 'mcq', difficulty: 1,
    question: { en: '23 + 15 = ?', ms: '23 + 15 = ?', zh: '23 + 15 = ？' },
    options: [
      { id: 'a', text: { en: '36', ms: '36', zh: '36' } },
      { id: 'b', text: { en: '38', ms: '38', zh: '38' } },
      { id: 'c', text: { en: '48', ms: '48', zh: '48' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t1-mat-03', skillCode: 'MAT-T1-OL01', age: 7, subject: 'MAT',
    topic: 'Operasi - Tolak', subtopic: 'Menolak dua nombor', type: 'mcq', difficulty: 1,
    question: { en: '50 - 23 = ?', ms: '50 - 23 = ?', zh: '50 - 23 = ？' },
    options: [
      { id: 'a', text: { en: '27', ms: '27', zh: '27' } },
      { id: 'b', text: { en: '33', ms: '33', zh: '33' } },
      { id: 'c', text: { en: '37', ms: '37', zh: '37' } },
    ],
    correctAnswer: 'a',
  },
  {
    id: 'q-t1-mat-04', skillCode: 'MAT-T1-M01', age: 7, subject: 'MAT',
    topic: 'Masa', subtopic: 'Membaca jam - tepat', type: 'mcq', difficulty: 2,
    question: { en: 'If the short hand points to 3 and the long hand points to 12, what time is it?', ms: 'Jika jarum pendek menunjuk ke 3 dan jarum panjang menunjuk ke 12, pukul berapa?', zh: '如果短针指向3，长针指向12，现在几点？' },
    options: [
      { id: 'a', text: { en: '12 o\'clock', ms: 'Pukul 12', zh: '12点' } },
      { id: 'b', text: { en: '3 o\'clock', ms: 'Pukul 3', zh: '3点' } },
      { id: 'c', text: { en: '6 o\'clock', ms: 'Pukul 6', zh: '6点' } },
    ],
    correctAnswer: 'b',
  },
  // ── SCI ──
  {
    id: 'q-t1-sci-01', skillCode: 'SCI-T1-H01', age: 7, subject: 'SCI',
    topic: 'Sains Hayat', subtopic: 'Ciri-ciri benda hidup', type: 'mcq', difficulty: 1,
    question: { en: 'Which of these can grow?', ms: 'Yang manakah boleh membesar?', zh: '以下哪个能生长？' },
    options: [
      { id: 'a', text: { en: 'A stone', ms: 'Batu', zh: '石头' } },
      { id: 'b', text: { en: 'A plant', ms: 'Tumbuhan', zh: '植物' } },
      { id: 'c', text: { en: 'A book', ms: 'Buku', zh: '书' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t1-sci-02', skillCode: 'SCI-T1-F01', age: 7, subject: 'SCI',
    topic: 'Sains Fizikal', subtopic: 'Magnet', type: 'mcq', difficulty: 2,
    question: { en: 'Which object can be attracted by a magnet?', ms: 'Objek manakah boleh ditarik oleh magnet?', zh: '哪个物体能被磁铁吸引？' },
    options: [
      { id: 'a', text: { en: 'Plastic ruler', ms: 'Pembaris plastik', zh: '塑料尺' } },
      { id: 'b', text: { en: 'Iron nail', ms: 'Paku besi', zh: '铁钉' } },
      { id: 'c', text: { en: 'Rubber band', ms: 'Getah gelang', zh: '橡皮筋' } },
    ],
    correctAnswer: 'b',
  },
  // ── ENG ──
  {
    id: 'q-t1-eng-01', skillCode: 'ENG-T1-P01', age: 7, subject: 'ENG',
    topic: 'Phonics', subtopic: 'Bunyi huruf CVC', type: 'mcq', difficulty: 1,
    question: { en: 'Which word rhymes with "cat"?', ms: 'Perkataan mana yang rima dengan "cat"?', zh: '哪个词和"cat"押韵？' },
    options: [
      { id: 'a', text: { en: 'dog', ms: 'dog', zh: 'dog' } },
      { id: 'b', text: { en: 'bat', ms: 'bat', zh: 'bat' } },
      { id: 'c', text: { en: 'cup', ms: 'cup', zh: 'cup' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t1-eng-02', skillCode: 'ENG-T1-G01', age: 7, subject: 'ENG',
    topic: 'Grammar', subtopic: 'Ayat mudah', type: 'mcq', difficulty: 2,
    question: { en: 'Choose the correct sentence:', ms: 'Pilih ayat yang betul:', zh: '选择正确的句子：' },
    options: [
      { id: 'a', text: { en: 'The cat is sleeping.', ms: 'The cat is sleeping.', zh: 'The cat is sleeping.' } },
      { id: 'b', text: { en: 'Cat the sleeping is.', ms: 'Cat the sleeping is.', zh: 'Cat the sleeping is.' } },
      { id: 'c', text: { en: 'Sleeping the cat is.', ms: 'Sleeping the cat is.', zh: 'Sleeping the cat is.' } },
    ],
    correctAnswer: 'a',
  },
  // ── BM ──
  {
    id: 'q-t1-bm-01', skillCode: 'BM-T1-T01', age: 7, subject: 'BM',
    topic: 'Tatabahasa', subtopic: 'Kata Nama Am dan Kata Nama Khas', type: 'mcq', difficulty: 1,
    question: { en: 'Which is a Kata Nama Khas (proper noun)?', ms: 'Yang manakah Kata Nama Khas?', zh: '以下哪个是专有名词？' },
    options: [
      { id: 'a', text: { en: 'kucing', ms: 'kucing', zh: 'kucing' } },
      { id: 'b', text: { en: 'Malaysia', ms: 'Malaysia', zh: 'Malaysia' } },
      { id: 'c', text: { en: 'buku', ms: 'buku', zh: 'buku' } },
    ],
    correctAnswer: 'b',
  },
  // ── ZH ──
  {
    id: 'q-t1-zh-01', skillCode: 'ZH-T1-P02', age: 7, subject: 'ZH',
    topic: 'Pinyin', subtopic: 'Pinyin 4 nada', type: 'mcq', difficulty: 2,
    question: { en: 'How many tones are there in Mandarin Pinyin?', ms: 'Berapa banyak nada dalam Pinyin Mandarin?', zh: '普通话拼音有几个声调？' },
    options: [
      { id: 'a', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'b', text: { en: '4', ms: '4', zh: '4' } },
      { id: 'c', text: { en: '5', ms: '5', zh: '5' } },
    ],
    correctAnswer: 'b',
  },
  // ── GEO ──
  {
    id: 'q-t1-geo-01', skillCode: 'GEO-T1-AR01', age: 7, subject: 'GEO',
    topic: 'Arah', subtopic: 'Mengenal arah', type: 'mcq', difficulty: 1,
    question: { en: 'If you face a mirror, your reflection raises its LEFT hand. Which hand did YOU raise?', ms: 'Jika anda menghadap cermin, bayangan anda mengangkat tangan KIRI. Tangan mana ANDA angkat?', zh: '如果你面对镜子，你的倒影举起左手。你举的是哪只手？' },
    options: [
      { id: 'a', text: { en: 'Left hand', ms: 'Tangan kiri', zh: '左手' } },
      { id: 'b', text: { en: 'Right hand', ms: 'Tangan kanan', zh: '右手' } },
    ],
    correctAnswer: 'b',
  },
  // ── SJ ──
  {
    id: 'q-t1-sj-01', skillCode: 'SJ-T1-SN01', age: 7, subject: 'SJ',
    topic: 'Simbol Negara', subtopic: 'Jalur Gemilang', type: 'mcq', difficulty: 1,
    question: { en: 'How many stripes does the Malaysian flag (Jalur Gemilang) have?', ms: 'Berapa jalur pada bendera Malaysia (Jalur Gemilang)?', zh: '马来西亚国旗有多少条纹？' },
    options: [
      { id: 'a', text: { en: '11', ms: '11', zh: '11' } },
      { id: 'b', text: { en: '14', ms: '14', zh: '14' } },
      { id: 'c', text: { en: '13', ms: '13', zh: '13' } },
    ],
    correctAnswer: 'b',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AGE 8
// ─────────────────────────────────────────────────────────────────────────────

const AGE8_QUESTIONS: TaxonomyQuestion[] = [
  // ── MAT ──
  {
    id: 'q-t2-mat-01', skillCode: 'MAT-T2-OD01', age: 8, subject: 'MAT',
    topic: 'Operasi - Darab', subtopic: 'Sifir 2, 3, 4, 5', type: 'mcq', difficulty: 1,
    question: { en: 'What is 4 × 5?', ms: 'Berapakah 4 × 5?', zh: '4 × 5 等于多少？' },
    options: [
      { id: 'a', text: { en: '15', ms: '15', zh: '15' } },
      { id: 'b', text: { en: '20', ms: '20', zh: '20' } },
      { id: 'c', text: { en: '25', ms: '25', zh: '25' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-mat-02', skillCode: 'MAT-T2-OD01', age: 8, subject: 'MAT',
    topic: 'Operasi - Darab', subtopic: 'Sifir 2, 3, 4, 5', type: 'mcq', difficulty: 2,
    question: { en: 'What is 3 × 7?', ms: 'Berapakah 3 × 7?', zh: '3 × 7 等于多少？' },
    options: [
      { id: 'a', text: { en: '18', ms: '18', zh: '18' } },
      { id: 'b', text: { en: '21', ms: '21', zh: '21' } },
      { id: 'c', text: { en: '24', ms: '24', zh: '24' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-mat-03', skillCode: 'MAT-T2-OB01', age: 8, subject: 'MAT',
    topic: 'Operasi - Bahagi', subtopic: 'Konsep bahagi sama rata', type: 'mcq', difficulty: 2,
    question: { en: '12 sweets shared equally among 3 children. How many does each get?', ms: '12 gula-gula dibahagi sama rata kepada 3 orang kanak-kanak. Berapa seorang?', zh: '12颗糖果平均分给3个孩子，每人得几颗？' },
    options: [
      { id: 'a', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'b', text: { en: '4', ms: '4', zh: '4' } },
      { id: 'c', text: { en: '6', ms: '6', zh: '6' } },
    ],
    correctAnswer: 'b',
  },
  // ── SCI ──
  {
    id: 'q-t2-sci-01', skillCode: 'SCI-T2-B01', age: 8, subject: 'SCI',
    topic: 'Sains Bahan', subtopic: 'Keadaan jirim', type: 'mcq', difficulty: 1,
    question: { en: 'Which state of matter is water when you drink it?', ms: 'Air dalam keadaan jirim apa ketika anda meminumnya?', zh: '你喝的水是什么物质状态？' },
    options: [
      { id: 'a', text: { en: 'Solid', ms: 'Pepejal', zh: '固体' } },
      { id: 'b', text: { en: 'Liquid', ms: 'Cecair', zh: '液体' } },
      { id: 'c', text: { en: 'Gas', ms: 'Gas', zh: '气体' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-sci-02', skillCode: 'SCI-T2-H01', age: 8, subject: 'SCI',
    topic: 'Sains Hayat', subtopic: 'Kitaran hidup haiwan', type: 'mcq', difficulty: 2,
    question: { en: 'What does a caterpillar turn into?', ms: 'Ulat beluncas bertukar menjadi apa?', zh: '毛毛虫会变成什么？' },
    options: [
      { id: 'a', text: { en: 'A fish', ms: 'Ikan', zh: '鱼' } },
      { id: 'b', text: { en: 'A butterfly', ms: 'Kupu-kupu', zh: '蝴蝶' } },
      { id: 'c', text: { en: 'A frog', ms: 'Katak', zh: '青蛙' } },
    ],
    correctAnswer: 'b',
  },
  // ── ENG ──
  {
    id: 'q-t2-eng-01', skillCode: 'ENG-T2-G01', age: 8, subject: 'ENG',
    topic: 'Grammar', subtopic: 'Kata nama jamak regular', type: 'mcq', difficulty: 1,
    question: { en: 'What is the plural of "box"?', ms: 'Apakah kata jamak bagi "box"?', zh: '"box"的复数是什么？' },
    options: [
      { id: 'a', text: { en: 'boxs', ms: 'boxs', zh: 'boxs' } },
      { id: 'b', text: { en: 'boxes', ms: 'boxes', zh: 'boxes' } },
      { id: 'c', text: { en: 'boxies', ms: 'boxies', zh: 'boxies' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-eng-02', skillCode: 'ENG-T2-P01', age: 8, subject: 'ENG',
    topic: 'Phonics', subtopic: 'Dwigraf: sh, ch, th, wh', type: 'mcq', difficulty: 1,
    question: { en: 'Which word starts with the "sh" sound?', ms: 'Perkataan mana bermula dengan bunyi "sh"?', zh: '哪个词以"sh"音开头？' },
    options: [
      { id: 'a', text: { en: 'chair', ms: 'chair', zh: 'chair' } },
      { id: 'b', text: { en: 'ship', ms: 'ship', zh: 'ship' } },
      { id: 'c', text: { en: 'thin', ms: 'thin', zh: 'thin' } },
    ],
    correctAnswer: 'b',
  },
  // ── BM ──
  {
    id: 'q-t2-bm-01', skillCode: 'BM-T2-T01', age: 8, subject: 'BM',
    topic: 'Tatabahasa', subtopic: 'Penjodoh Bilangan', type: 'mcq', difficulty: 2,
    question: { en: 'Which is the correct penjodoh bilangan for "kucing"?', ms: 'Penjodoh bilangan yang betul untuk "kucing" ialah?', zh: '"kucing"(猫)的正确量词是什么？' },
    options: [
      { id: 'a', text: { en: 'seekor', ms: 'seekor', zh: 'seekor' } },
      { id: 'b', text: { en: 'sebiji', ms: 'sebiji', zh: 'sebiji' } },
      { id: 'c', text: { en: 'sebuah', ms: 'sebuah', zh: 'sebuah' } },
    ],
    correctAnswer: 'a',
  },
  // ── ZH ──
  {
    id: 'q-t2-zh-01', skillCode: 'ZH-T2-R01', age: 8, subject: 'ZH',
    topic: 'Radikal', subtopic: 'Mengenal radikal asas', type: 'mcq', difficulty: 2,
    question: { en: 'Which radical (部首) means "water"?', ms: 'Radikal (部首) mana yang bermaksud "air"?', zh: '哪个部首表示"水"？' },
    options: [
      { id: 'a', text: { en: '火', ms: '火', zh: '火' } },
      { id: 'b', text: { en: '氵', ms: '氵', zh: '氵' } },
      { id: 'c', text: { en: '木', ms: '木', zh: '木' } },
    ],
    correctAnswer: 'b',
  },
  // ── GEO ──
  {
    id: 'q-t2-geo-01', skillCode: 'GEO-T2-AR01', age: 8, subject: 'GEO',
    topic: 'Peta', subtopic: 'Mengenal arah mata angin', type: 'mcq', difficulty: 1,
    question: { en: 'Which direction does the compass needle point to?', ms: 'Arah manakah jarum kompas menunjuk?', zh: '指南针指向哪个方向？' },
    options: [
      { id: 'a', text: { en: 'South', ms: 'Selatan', zh: '南' } },
      { id: 'b', text: { en: 'North', ms: 'Utara', zh: '北' } },
      { id: 'c', text: { en: 'West', ms: 'Barat', zh: '西' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-geo-02', skillCode: 'GEO-T2-MY02', age: 8, subject: 'GEO',
    topic: 'Malaysia', subtopic: 'Semenanjung vs Sabah & Sarawak', type: 'mcq', difficulty: 2,
    question: { en: 'Which sea separates Peninsular Malaysia from Sabah and Sarawak?', ms: 'Laut manakah yang memisahkan Semenanjung Malaysia daripada Sabah dan Sarawak?', zh: '哪个海将西马和沙巴砂拉越分开？' },
    options: [
      { id: 'a', text: { en: 'South China Sea', ms: 'Laut China Selatan', zh: '南中国海' } },
      { id: 'b', text: { en: 'Indian Ocean', ms: 'Lautan Hindi', zh: '印度洋' } },
      { id: 'c', text: { en: 'Pacific Ocean', ms: 'Lautan Pasifik', zh: '太平洋' } },
    ],
    correctAnswer: 'a',
  },
  // ── SJ ──
  {
    id: 'q-t2-sj-01', skillCode: 'SJ-T2-RN01', age: 8, subject: 'SJ',
    topic: 'Rukun Negara', subtopic: 'Pengenalan Rukun Negara', type: 'mcq', difficulty: 2,
    question: { en: 'How many principles are there in the Rukun Negara?', ms: 'Berapa prinsip dalam Rukun Negara?', zh: '国家原则有几条？' },
    options: [
      { id: 'a', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'b', text: { en: '5', ms: '5', zh: '5' } },
      { id: 'c', text: { en: '7', ms: '7', zh: '7' } },
    ],
    correctAnswer: 'b',
  },
  {
    id: 'q-t2-sj-02', skillCode: 'SJ-T2-BM01', age: 8, subject: 'SJ',
    topic: 'Budaya Malaysia', subtopic: 'Kepelbagaian kaum', type: 'mcq', difficulty: 1,
    question: { en: 'Which of these is NOT one of the major ethnic groups in Malaysia?', ms: 'Yang manakah BUKAN salah satu kaum utama di Malaysia?', zh: '以下哪个不是马来西亚的主要民族？' },
    options: [
      { id: 'a', text: { en: 'Malay', ms: 'Melayu', zh: '马来人' } },
      { id: 'b', text: { en: 'Japanese', ms: 'Jepun', zh: '日本人' } },
      { id: 'c', text: { en: 'Indian', ms: 'India', zh: '印度人' } },
    ],
    correctAnswer: 'b',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** All sample questions combined */
export const ALL_SAMPLE_QUESTIONS: TaxonomyQuestion[] = [
  ...AGE4_QUESTIONS,
  ...AGE7_QUESTIONS,
  ...AGE8_QUESTIONS,
];

/** Get questions filtered by age */
export function getQuestionsByAge(age: number): TaxonomyQuestion[] {
  return ALL_SAMPLE_QUESTIONS.filter(q => q.age === age);
}

/** Get questions filtered by age and subject */
export function getQuestionsByAgeAndSubject(age: number, subject: SubjectCode): TaxonomyQuestion[] {
  return ALL_SAMPLE_QUESTIONS.filter(q => q.age === age && q.subject === subject);
}

/** Get questions filtered by skill code */
export function getQuestionsBySkillCode(skillCode: string): TaxonomyQuestion[] {
  return ALL_SAMPLE_QUESTIONS.filter(q => q.skillCode === skillCode);
}

/**
 * Convert a TaxonomyQuestion to the legacy Question format used by QuestionScreen.
 * This is the adapter layer — when we move to Postgres, only this function changes.
 */
export function toQuestionScreenFormat(tq: TaxonomyQuestion): {
  id: string;
  type: 'mcq';
  question: { en: string; ms: string; zh: string };
  options: Array<{ id: string; text: { en: string; ms: string; zh: string } }>;
  correctAnswer: string;
  foxyMessage?: { en: string; ms: string; zh: string };
  /** KSSR taxonomy metadata — carried through for mastery recording */
  _taxonomy?: { skillCode: string; age: number; subject: SubjectCode; topic: string; subtopic: string };
} {
  return {
    id: tq.id,
    type: tq.type,
    question: tq.question,
    options: tq.options,
    correctAnswer: tq.correctAnswer,
    foxyMessage: tq.foxyMessage,
    _taxonomy: {
      skillCode: tq.skillCode,
      age: tq.age,
      subject: tq.subject,
      topic: tq.topic,
      subtopic: tq.subtopic,
    },
  };
}

// Backward compat aliases
/** @deprecated Use getQuestionsByAge */
export function getQuestionsByLevel(level: string): TaxonomyQuestion[] {
  // Find the age for this display label
  const ages = [4,5,6,7,8,9,10,11,12];
  const age = ages.find(a => displayLabelFromAge(a) === level) || 4;
  return getQuestionsByAge(age);
}
/** @deprecated Use getQuestionsByAgeAndSubject */
export function getQuestionsByLevelAndSubject(level: string, subject: SubjectCode): TaxonomyQuestion[] {
  const ages = [4,5,6,7,8,9,10,11,12];
  const age = ages.find(a => displayLabelFromAge(a) === level) || 4;
  return getQuestionsByAgeAndSubject(age, subject);
}
// Template generator for bulk upload

export const generateCSVTemplate = (questionType: 'mcq' | 'dragdrop' | 'hotspot' | 'sequence'): string => {
  const commonHeaders = [
    'Question (EN)',
    'Question (BM)',
    'Question (ZH)',
    'Language',
    'Age',
    'Quest',
    'Skills',
    'Tags',
    'Foxy Message (EN)',
    'Foxy Message (BM)',
    'Foxy Message (ZH)'
  ];

  let headers: string[] = [];
  let sampleRow: string[] = [];

  if (questionType === 'mcq' || questionType === 'dragdrop') {
    headers = [
      ...commonHeaders,
      'Option A (EN)', 'Option A (BM)', 'Option A (ZH)', 'Option A Image URL',
      'Option B (EN)', 'Option B (BM)', 'Option B (ZH)', 'Option B Image URL',
      'Option C (EN)', 'Option C (BM)', 'Option C (ZH)', 'Option C Image URL',
      'Option D (EN)', 'Option D (BM)', 'Option D (ZH)', 'Option D Image URL',
      'Correct Answer'
    ];

    sampleRow = [
      'What is 1 + 1?',
      'Berapa 1 + 1?',
      '1 + 1 等于几？',
      'global',
      '5',
      'numbers',
      'Numeracy',
      'Numbers 1-10',
      'Let\'s add together!',
      'Mari tambah bersama!',
      '让我们一起加！',
      '1', '1', '1', 'https://example.com/image1.png',
      '2', '2', '2', '',
      '3', '3', '3', '',
      '4', '4', '4', '',
      'B'
    ];
  }

  if (questionType === 'hotspot') {
    headers = [
      ...commonHeaders,
      'Main Image URL',
      'Area A X', 'Area A Y', 'Area A Width', 'Area A Height',
      'Area B X', 'Area B Y', 'Area B Width', 'Area B Height',
      'Area C X', 'Area C Y', 'Area C Width', 'Area C Height',
      'Area D X', 'Area D Y', 'Area D Width', 'Area D Height',
      'Correct Answer'
    ];

    sampleRow = [
      'Tap on the face',
      'Ketik pada muka',
      '点击脸部',
      'global',
      '4',
      'english',
      'General Science',
      'Body Parts',
      'Can you find the face?',
      'Bolehkah kamu cari muka?',
      '你能找到脸吗？',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800',
      '35', '15', '30', '25',
      '10', '50', '20', '20',
      '30', '45', '40', '40',
      '35', '70', '30', '25',
      'A'
    ];
  }

  if (questionType === 'sequence') {
    headers = [
      ...commonHeaders,
      'Item 1 (EN)', 'Item 1 (BM)', 'Item 1 (ZH)', 'Item 1 Image URL',
      'Item 2 (EN)', 'Item 2 (BM)', 'Item 2 (ZH)', 'Item 2 Image URL',
      'Item 3 (EN)', 'Item 3 (BM)', 'Item 3 (ZH)', 'Item 3 Image URL',
      'Item 4 (EN)', 'Item 4 (BM)', 'Item 4 (ZH)', 'Item 4 Image URL'
    ];

    sampleRow = [
      'Put these in order',
      'Susun mengikut urutan',
      '按顺序排列',
      'global',
      '5',
      'numbers',
      'Logic',
      'Numbers 1-10',
      'What comes first?',
      'Yang mana dahulu?',
      '哪个最先？',
      '🌅 Wake up', '🌅 Bangun tidur', '🌅 起床', '',
      '🍳 Breakfast', '🍳 Sarapan', '🍳 吃早餐', '',
      '🚌 School', '🚌 Sekolah', '🚌 去学校', '',
      '🌙 Sleep', '🌙 Tidur', '🌙 睡觉', ''
    ];
  }

  // Generate CSV
  const csvContent = [
    headers.join(','),
    sampleRow.join(',')
  ].join('\n');

  return csvContent;
};

export const downloadTemplate = (questionType: 'mcq' | 'dragdrop' | 'hotspot' | 'sequence', format: 'csv' | 'excel') => {
  if (format === 'csv') {
    const csv = generateCSVTemplate(questionType);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumi-${questionType}-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (format === 'excel') {
    // For Excel, we'd use a library like SheetJS
    // For now, download CSV with .xlsx extension as placeholder
    const csv = generateCSVTemplate(questionType);
    const blob = new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumi-${questionType}-template.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

export const downloadAllTemplates = (format: 'csv' | 'excel') => {
  const types: Array<'mcq' | 'dragdrop' | 'hotspot' | 'sequence'> = ['mcq', 'dragdrop', 'hotspot', 'sequence'];
  
  types.forEach((type, index) => {
    setTimeout(() => {
      downloadTemplate(type, format);
    }, index * 500); // Stagger downloads
  });
};

import React, { useState } from 'react';
import { Upload, Play, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface QuestionEditorProps {
  onSave: (question: any) => void;
  onCancel: () => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ onSave, onCancel }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState('english');
  const [questionLanguage, setQuestionLanguage] = useState<'global' | 'en' | 'ms' | 'zh'>('global');
  const [ageDifficulty, setAgeDifficulty] = useState<4 | 5 | 6 | 7>(5);
  const [questionType, setQuestionType] = useState<'mcq' | 'dragdrop' | 'hotspot' | 'sequence'>('mcq');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Question text
  const [questionText, setQuestionText] = useState({ en: '', ms: '', zh: '' });
  const [foxyMessage, setFoxyMessage] = useState({ en: '', ms: '', zh: '' });
  
  // MCQ & Drag/Drop options
  const [options, setOptions] = useState([
    { id: 'a', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'b', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'c', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'd', text: { en: '', ms: '', zh: '' }, image: '' }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string>('');

  // Hotspot specific
  const [hotspotImage, setHotspotImage] = useState<string>('');
  const [hotspotAreas, setHotspotAreas] = useState([
    { id: 'a', position: { x: 10, y: 10, width: 20, height: 20 } },
    { id: 'b', position: { x: 40, y: 10, width: 20, height: 20 } },
    { id: 'c', position: { x: 10, y: 40, width: 20, height: 20 } },
    { id: 'd', position: { x: 40, y: 40, width: 20, height: 20 } }
  ]);

  // Sequence items (order matters)
  const [sequenceItems, setSequenceItems] = useState([
    { id: 'a', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'b', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'c', text: { en: '', ms: '', zh: '' }, image: '' },
    { id: 'd', text: { en: '', ms: '', zh: '' }, image: '' }
  ]);

  const quests = [
    { id: 'english', name: 'English Forest', language: 'en' },
    { id: 'numbers', name: 'Numbers Island', language: 'global' },
    { id: 'bahasa', name: 'Rimba Bahasa', language: 'ms' },
    { id: 'mandarin', name: 'Mandarin Mountain', language: 'zh' },
    { id: 'science', name: 'Mystery Jungle', language: 'global' }
  ];

  const questionTypes = [
    { id: 'mcq', name: 'Multiple Choice' },
    { id: 'dragdrop', name: 'Drag & Drop' },
    { id: 'hotspot', name: 'Hotspot' },
    { id: 'sequence', name: 'Sequence' }
  ];

  const skills = ['Phonics', 'Logic', 'Numeracy', 'Social-Emotional', 'General Science'];

  const tags = [
    'Animals', 'Numbers 1-10', 'Numbers 11-20', 'Body Parts', 'Colors',
    'Shapes', 'Food & Drink', 'Family', 'Transportation', 'Weather'
  ];

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, optionIndex?: number, isHotspot?: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      if (isHotspot) {
        setHotspotImage(imageUrl);
      } else if (optionIndex !== undefined) {
        const newOptions = [...options];
        newOptions[optionIndex].image = imageUrl;
        setOptions(newOptions);
      }
    }
  };

  const handleSequenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const newItems = [...sequenceItems];
      newItems[itemIndex].image = imageUrl;
      setSequenceItems(newItems);
    }
  };

  const updateOptionText = (index: number, lang: 'en' | 'ms' | 'zh', value: string) => {
    const newOptions = [...options];
    newOptions[index].text[lang] = value;
    setOptions(newOptions);
  };

  const updateSequenceText = (index: number, lang: 'en' | 'ms' | 'zh', value: string) => {
    const newItems = [...sequenceItems];
    newItems[index].text[lang] = value;
    setSequenceItems(newItems);
  };

  const updateHotspotPosition = (index: number, field: 'x' | 'y' | 'width' | 'height', value: number) => {
    const newAreas = [...hotspotAreas];
    newAreas[index].position[field] = value;
    setHotspotAreas(newAreas);
  };

  const handleSave = () => {
    const questionData = {
      id: Date.now().toString(),
      quest: selectedQuest,
      language: questionLanguage,
      ageDifficulty,
      type: questionType,
      question: questionText,
      foxyMessage,
      options: questionType === 'sequence' ? sequenceItems : options,
      correctAnswer: questionType === 'sequence' ? 'a,b,c,d' : correctAnswer,
      hotspotImage: questionType === 'hotspot' ? hotspotImage : undefined,
      hotspotAreas: questionType === 'hotspot' ? hotspotAreas : undefined,
      skills: selectedSkills,
      tags: selectedTags
    };
    console.log('Saving question:', questionData);
    onSave(questionData);
  };

  // Determine which languages to show based on questionLanguage
  const languagesToShow = questionLanguage === 'global' ? ['en', 'ms', 'zh'] : [questionLanguage];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full h-[90vh] max-w-[95vw] flex overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white border-2 border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* LEFT PANEL - Settings */}
        <div className={`border-r border-gray-100 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-80'}`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
            {!isCollapsed && (
              <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!isCollapsed && (
            <div className="p-6 space-y-6">
              {/* Quest Module */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Quest Module
                </label>
                <select
                  value={selectedQuest}
                  onChange={(e) => setSelectedQuest(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                >
                  {quests.map(quest => (
                    <option key={quest.id} value={quest.id}>{quest.name}</option>
                  ))}
                </select>
              </div>

              {/* Question Language */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Question Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['global', 'en', 'ms', 'zh'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setQuestionLanguage(lang)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        questionLanguage === lang
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {lang === 'global' ? 'Global' : lang === 'en' ? 'EN' : lang === 'ms' ? 'BM' : '中文'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Difficulty */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Age Difficulty
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 5, 6, 7].map(age => (
                    <button
                      key={age}
                      onClick={() => setAgeDifficulty(age as 4 | 5 | 6 | 7)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        ageDifficulty === age
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Question Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {questionTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setQuestionType(type.id as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                        questionType === type.id
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Skills
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedSkills.includes(skill)
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Tags
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER PANEL - Question Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-3xl">
            <div className="mb-8">
              <h1 className="text-lg font-semibold text-gray-900 mb-1">Question Editor</h1>
              <p className="text-sm text-gray-500">
                {questionType === 'mcq' && 'Create a multiple choice question'}
                {questionType === 'dragdrop' && 'Create a drag & drop question'}
                {questionType === 'hotspot' && 'Create a hotspot question with clickable areas'}
                {questionType === 'sequence' && 'Create a sequence ordering question'}
              </p>
            </div>

            <div className="space-y-6">
              {/* Question Text Fields */}
              {languagesToShow.map(lang => (
                <div key={lang}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text ({lang.toUpperCase()})
                  </label>
                  <textarea
                    value={questionText[lang as keyof typeof questionText]}
                    onChange={(e) => setQuestionText(prev => ({ ...prev, [lang]: e.target.value }))}
                    placeholder="Type the question..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 resize-none h-20"
                  />
                </div>
              ))}

              {/* Foxy Message (Optional) */}
              {languagesToShow.map(lang => (
                <div key={`foxy-${lang}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foxy Message ({lang.toUpperCase()}) - Optional
                  </label>
                  <input
                    type="text"
                    value={foxyMessage[lang as keyof typeof foxyMessage]}
                    onChange={(e) => setFoxyMessage(prev => ({ ...prev, [lang]: e.target.value }))}
                    placeholder="Hint or encouragement from Foxy..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>
              ))}

              <hr className="border-gray-200" />

              {/* MCQ TYPE */}
              {questionType === 'mcq' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Answer Options</h3>
                  <div className="space-y-4">
                    {options.map((option, index) => (
                      <div key={option.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">Option {option.id.toUpperCase()}</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={correctAnswer === option.id}
                              onChange={() => setCorrectAnswer(option.id)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-600">Correct Answer</span>
                          </label>
                        </div>
                        
                        {languagesToShow.map(lang => (
                          <div key={lang} className="mb-2">
                            <input
                              type="text"
                              value={option.text[lang as keyof typeof option.text]}
                              onChange={(e) => updateOptionText(index, lang as 'en' | 'ms' | 'zh', e.target.value)}
                              placeholder={`Text (${lang.toUpperCase()})`}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                            />
                          </div>
                        ))}

                        <div className="mt-3">
                          <input
                            type="file"
                            accept="image/*"
                            id={`mcq-image-${index}`}
                            onChange={(e) => handleImageUpload(e, index)}
                            className="hidden"
                          />
                          <label
                            htmlFor={`mcq-image-${index}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            {option.image ? 'Change Image' : 'Upload Image'}
                          </label>
                          {option.image && (
                            <div className="mt-3 relative inline-block">
                              <img src={option.image} alt="" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200" />
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = [...options];
                                  newOptions[index].image = '';
                                  setOptions(newOptions);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DRAG & DROP TYPE (same as MCQ) */}
              {questionType === 'dragdrop' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Draggable Options</h3>
                  <div className="space-y-4">
                    {options.map((option, index) => (
                      <div key={option.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">Option {option.id.toUpperCase()}</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={correctAnswer === option.id}
                              onChange={() => setCorrectAnswer(option.id)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-600">Correct Answer</span>
                          </label>
                        </div>
                        
                        {languagesToShow.map(lang => (
                          <div key={lang} className="mb-2">
                            <input
                              type="text"
                              value={option.text[lang as keyof typeof option.text]}
                              onChange={(e) => updateOptionText(index, lang as 'en' | 'ms' | 'zh', e.target.value)}
                              placeholder={`Text (${lang.toUpperCase()})`}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                            />
                          </div>
                        ))}

                        <div className="mt-3">
                          <input
                            type="file"
                            accept="image/*"
                            id={`dragdrop-image-${index}`}
                            onChange={(e) => handleImageUpload(e, index)}
                            className="hidden"
                          />
                          <label
                            htmlFor={`dragdrop-image-${index}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            {option.image ? 'Change Image' : 'Upload Image'}
                          </label>
                          {option.image && (
                            <div className="mt-3 relative inline-block">
                              <img src={option.image} alt="" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200" />
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = [...options];
                                  newOptions[index].image = '';
                                  setOptions(newOptions);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HOTSPOT TYPE */}
              {questionType === 'hotspot' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Hotspot Configuration</h3>
                  
                  {/* Main Image Upload */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Main Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      id="hotspot-main-image"
                      onChange={(e) => handleImageUpload(e, undefined, true)}
                      className="hidden"
                    />
                    <label
                      htmlFor="hotspot-main-image"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {hotspotImage ? 'Change Main Image' : 'Upload Main Image'}
                    </label>
                    {hotspotImage && (
                      <div className="mt-4 relative inline-block">
                        <img src={hotspotImage} alt="Hotspot" className="w-full max-w-md rounded-lg border-2 border-gray-200" />
                        <button
                          type="button"
                          onClick={() => setHotspotImage('')}
                          className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {/* Show hotspot areas overlay */}
                        {hotspotAreas.map((area, index) => (
                          <div
                            key={area.id}
                            style={{
                              position: 'absolute',
                              left: `${area.position.x}%`,
                              top: `${area.position.y}%`,
                              width: `${area.position.width}%`,
                              height: `${area.position.height}%`,
                              border: correctAnswer === area.id ? '3px solid green' : '2px dashed blue',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0, 123, 255, 0.1)'
                            }}
                          >
                            <span className="absolute top-1 left-1 text-xs font-bold text-white bg-black rounded px-1">
                              {area.id.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hotspot Areas */}
                  <div className="space-y-4">
                    {hotspotAreas.map((area, index) => (
                      <div key={area.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">Area {area.id.toUpperCase()}</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="correctHotspot"
                              checked={correctAnswer === area.id}
                              onChange={() => setCorrectAnswer(area.id)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-600">Correct Area</span>
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">X Position (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={area.position.x}
                              onChange={(e) => updateHotspotPosition(index, 'x', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Y Position (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={area.position.y}
                              onChange={(e) => updateHotspotPosition(index, 'y', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Width (%)</label>
                            <input
                              type="number"
                              min="5"
                              max="50"
                              value={area.position.width}
                              onChange={(e) => updateHotspotPosition(index, 'width', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Height (%)</label>
                            <input
                              type="number"
                              min="5"
                              max="50"
                              value={area.position.height}
                              onChange={(e) => updateHotspotPosition(index, 'height', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEQUENCE TYPE */}
              {questionType === 'sequence' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Sequence Items</h3>
                  <p className="text-xs text-gray-500 mb-4">The order below is the CORRECT sequence (A → B → C → D)</p>
                  <div className="space-y-4">
                    {sequenceItems.map((item, index) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900">Item {item.id.toUpperCase()}</span>
                        </div>
                        
                        {languagesToShow.map(lang => (
                          <div key={lang} className="mb-2">
                            <input
                              type="text"
                              value={item.text[lang as keyof typeof item.text]}
                              onChange={(e) => updateSequenceText(index, lang as 'en' | 'ms' | 'zh', e.target.value)}
                              placeholder={`Text (${lang.toUpperCase()})`}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                            />
                          </div>
                        ))}

                        <div className="mt-3">
                          <input
                            type="file"
                            accept="image/*"
                            id={`sequence-image-${index}`}
                            onChange={(e) => handleSequenceImageUpload(e, index)}
                            className="hidden"
                          />
                          <label
                            htmlFor={`sequence-image-${index}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            {item.image ? 'Change Image' : 'Upload Image'}
                          </label>
                          {item.image && (
                            <div className="mt-3 relative inline-block">
                              <img src={item.image} alt="" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200" />
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = [...sequenceItems];
                                  newItems[index].image = '';
                                  setSequenceItems(newItems);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 pt-8 border-t border-gray-100">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Save Question
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Preview */}
        <div className="w-96 border-l border-gray-100 bg-gray-50 p-6 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Preview</h3>
          
          {/* iPhone Frame */}
          <div className="bg-black rounded-[2.5rem] p-3">
            <div className="bg-white rounded-[2rem] overflow-hidden">
              <div className="h-6 bg-gray-900" />
              
              <div className="bg-gradient-to-br from-[#7cc643] to-[#3d7c54] min-h-[600px] p-4">
                {/* Question Preview */}
                {questionText.en && (
                  <div className="bg-white/95 rounded-2xl p-4 mb-4">
                    <p className="text-sm text-gray-900 font-medium">
                      {questionText[questionLanguage === 'global' ? 'en' : questionLanguage]}
                    </p>
                  </div>
                )}

                {/* Preview based on type */}
                {questionType === 'mcq' && options.some(o => o.text.en || o.image) && (
                  <div className="grid grid-cols-2 gap-2">
                    {options.map(opt => (
                      <div key={opt.id} className="aspect-square bg-white rounded-lg p-2 flex items-center justify-center">
                        {opt.image ? (
                          <img src={opt.image} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-xs text-center">{opt.text.en || opt.text.ms || opt.text.zh}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {questionType === 'hotspot' && hotspotImage && (
                  <div className="bg-white rounded-lg p-2">
                    <img src={hotspotImage} alt="" className="w-full h-auto rounded" />
                  </div>
                )}

                {questionType === 'sequence' && sequenceItems.some(i => i.text.en) && (
                  <div className="space-y-2">
                    {sequenceItems.map((item, idx) => (
                      <div key={item.id} className="bg-white rounded-lg p-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#7cc643] text-white text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs">{item.text.en || item.text.ms || item.text.zh}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!questionText.en && (
                  <div className="text-center py-12 text-white/60 text-sm">
                    Preview will appear here
                  </div>
                )}
              </div>

              <div className="h-6 bg-white flex items-center justify-center">
                <div className="w-16 h-1 bg-gray-300 rounded-full" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-500">Quest:</span>
              <span className="font-medium text-gray-900">{quests.find(q => q.id === selectedQuest)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Language:</span>
              <span className="font-medium text-gray-900">{questionLanguage.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Age:</span>
              <span className="font-medium text-gray-900">{ageDifficulty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className="font-medium text-gray-900">{questionTypes.find(t => t.id === questionType)?.name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
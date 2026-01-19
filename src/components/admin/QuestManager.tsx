import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';

interface Quest {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  createdAt: string;
  language: 'global' | 'en' | 'ms' | 'zh';
  numberOfQuestions: number;
  skillFilters?: string[]; // Changed to array
}

interface QuestManagerProps {
  questConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>;
  setQuestConfigs: (configs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>) => void;
}

export const QuestManager: React.FC<QuestManagerProps> = ({ questConfigs, setQuestConfigs }) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  
  // Convert questConfigs to Quest format for display
  const defaultQuests: Quest[] = [
    {
      id: 'english',
      name: 'English Forest',
      icon: '🌳',
      color: '#7cc643',
      description: 'Language & Literacy',
      createdAt: '2024-01-01',
      language: questConfigs.english?.language || 'en',
      numberOfQuestions: questConfigs.english?.numberOfQuestions || 20,
      skillFilters: questConfigs.english?.skillFilters || []
    },
    {
      id: 'numbers',
      name: 'Numbers Island',
      icon: '🔢',
      color: '#4a90e2',
      description: 'Mathematics & Counting',
      createdAt: '2024-01-01',
      language: questConfigs.numbers?.language || 'global',
      numberOfQuestions: questConfigs.numbers?.numberOfQuestions || 25,
      skillFilters: questConfigs.numbers?.skillFilters || ['Numeracy']
    },
    {
      id: 'bahasa',
      name: 'Rimba Bahasa',
      icon: '🇲🇾',
      color: '#e74c3c',
      description: 'Bahasa Malaysia',
      createdAt: '2024-01-01',
      language: questConfigs.bahasa?.language || 'ms',
      numberOfQuestions: questConfigs.bahasa?.numberOfQuestions || 20,
      skillFilters: questConfigs.bahasa?.skillFilters || []
    },
    {
      id: 'mandarin',
      name: 'Mandarin Mountain',
      icon: '🏔️',
      color: '#f39c12',
      description: 'Chinese Language',
      createdAt: '2024-01-01',
      language: questConfigs.mandarin?.language || 'zh',
      numberOfQuestions: questConfigs.mandarin?.numberOfQuestions || 15,
      skillFilters: questConfigs.mandarin?.skillFilters || []
    },
    {
      id: 'science',
      name: 'Mystery Jungle',
      icon: '🔬',
      color: '#9b59b6',
      description: 'Science & Discovery',
      createdAt: '2024-01-01',
      language: questConfigs.science?.language || 'global',
      numberOfQuestions: questConfigs.science?.numberOfQuestions || 30,
      skillFilters: questConfigs.science?.skillFilters || ['General Science']
    }
  ];

  const [quests, setQuests] = useState<Quest[]>(defaultQuests);

  // Sync quests with questConfigs when props change
  useEffect(() => {
    setQuests(defaultQuests);
  }, [questConfigs]);

  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    color: '#7cc643',
    description: '',
    language: 'en',
    numberOfQuestions: 0,
    skillFilters: [] as string[]
  });

  const handleEdit = (quest: Quest) => {
    setEditingQuest(quest);
    setFormData({
      name: quest.name,
      icon: quest.icon,
      color: quest.color,
      description: quest.description,
      language: quest.language,
      numberOfQuestions: quest.numberOfQuestions,
      skillFilters: quest.skillFilters || []
    });
    setShowEditor(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this island? All associated questions will be affected.')) {
      setQuests(quests.filter(q => q.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedQuests: Quest[];
    
    if (editingQuest) {
      // Update existing quest
      updatedQuests = quests.map(q => 
        q.id === editingQuest.id 
          ? { ...q, ...formData }
          : q
      );
    } else {
      // Create new quest
      const newQuest: Quest = {
        id: formData.name.toLowerCase().replace(/\s+/g, '-'),
        ...formData,
        createdAt: new Date().toISOString().split('T')[0]
      };
      updatedQuests = [...quests, newQuest];
    }
    
    setQuests(updatedQuests);
    
    // Sync back to global questConfigs
    const updatedConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }> = {};
    updatedQuests.forEach(q => {
      updatedConfigs[q.id] = {
        language: q.language,
        numberOfQuestions: q.numberOfQuestions,
        skillFilters: q.skillFilters || []
      };
    });
    setQuestConfigs(updatedConfigs);
    
    handleCancel();
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingQuest(null);
    setFormData({
      name: '',
      icon: '',
      color: '#7cc643',
      description: '',
      language: 'en',
      numberOfQuestions: 0,
      skillFilters: []
    });
  };

  const popularEmojis = ['🌳', '🔢', '🇲🇾', '🏔️', '🔬', '🎨', '🎵', '⚽', '🌍', '🚀', '🦊', '🌊', '🏰', '🌈', '⭐', '🎯'];
  const popularColors = [
    { name: 'Green', value: '#7cc643' },
    { name: 'Blue', value: '#4a90e2' },
    { name: 'Red', value: '#e74c3c' },
    { name: 'Orange', value: '#f39c12' },
    { name: 'Purple', value: '#9b59b6' },
    { name: 'Pink', value: '#e91e63' },
    { name: 'Teal', value: '#00bcd4' },
    { name: 'Indigo', value: '#3f51b5' }
  ];

  const skills = ['Phonics', 'Logic', 'Numeracy', 'Social-Emotional', 'General Science'];

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skillFilters: prev.skillFilters.includes(skill)
        ? prev.skillFilters.filter(s => s !== skill)
        : [...prev.skillFilters, skill]
    }));
  };

  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Quest Islands</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage learning modules</p>
          </div>
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Island
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Total Islands</div>
            <div className="text-2xl font-semibold text-gray-900">{quests.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Active</div>
            <div className="text-2xl font-semibold text-gray-900">{quests.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Custom</div>
            <div className="text-2xl font-semibold text-gray-900">
              {quests.filter(q => !['english', 'numbers', 'bahasa', 'mandarin', 'science'].includes(q.id)).length}
            </div>
          </div>
        </div>

        {/* Islands Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quests.map((quest) => (
            <div
              key={quest.id}
              className="border border-gray-100 rounded-lg p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${quest.color}20` }}
                >
                  {quest.icon}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(quest)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(quest.id)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{quest.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{quest.description}</p>
              
              {/* Quest Info */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-black text-white">
                  {quest.language === 'global' ? 'Global' : quest.language.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600">
                  {quest.numberOfQuestions} questions
                </span>
              </div>
              
              {quest.skillFilters && quest.skillFilters.length > 0 && (
                <div className="text-xs text-gray-500 mb-3">
                  Skill: {quest.skillFilters.join(', ')}
                </div>
              )}
              
              <div
                className="h-1 rounded-full"
                style={{ backgroundColor: quest.color }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingQuest ? 'Edit Island' : 'Create New Island'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Design a learning module for children
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Island Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Island Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Art Adventure, Music Mountain"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Creative Arts & Expression"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Icon
                </label>
                <div className="grid grid-cols-8 gap-2 mb-3">
                  {popularEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: emoji })}
                      className={`
                        w-12 h-12 rounded-lg text-2xl flex items-center justify-center transition-all
                        ${formData.icon === emoji
                          ? 'bg-black text-white ring-2 ring-black ring-offset-2'
                          : 'bg-gray-50 hover:bg-gray-100'}
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Or type any emoji..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  maxLength={2}
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Color
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {popularColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`
                        px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                        ${formData.color === color.value
                          ? 'ring-2 ring-black ring-offset-2'
                          : 'hover:scale-105'}\
                      `}
                      style={{ backgroundColor: color.value, color: 'white' }}
                    >
                      <div className="w-4 h-4 rounded-full bg-white/30" />
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Question Pool Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Pool Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['global', 'en', 'ms', 'zh'] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setFormData({ ...formData, language: lang as any })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.language === lang
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {lang === 'global' ? 'Global' : lang === 'en' ? 'EN' : lang === 'ms' ? 'BM' : '中文'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Global: All languages | EN: English only | BM: Bahasa only | 中文: Mandarin only
                </p>
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.numberOfQuestions}
                  onChange={(e) => setFormData({ ...formData, numberOfQuestions: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Questions will be balanced across ages (4, 5, 6, 7)
                </p>
              </div>

              {/* Skill Filter (only for Global) */}
              {formData.language === 'global' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Skill (Optional)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {skills.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.skillFilters.includes(skill)
                            ? 'bg-black text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to include all global questions
                  </p>
                </div>
              )}

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="border border-gray-100 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ backgroundColor: `${formData.color}20` }}
                    >
                      {formData.icon || '?'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {formData.name || 'Island Name'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formData.description || 'Description'}
                      </p>
                      <div
                        className="mt-3 h-1 rounded-full w-24"
                        style={{ backgroundColor: formData.color }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  {editingQuest ? 'Save Changes' : 'Create Island'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
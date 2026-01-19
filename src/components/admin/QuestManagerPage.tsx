import React, { useState } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';

interface Quest {
  id: string;
  name: string;
  language: 'global' | 'en' | 'ms' | 'zh';
  numberOfQuestions: number;
  skillFilter?: string;
}

export const QuestManagerPage: React.FC = () => {
  const [quests, setQuests] = useState<Quest[]>([
    { id: 'english', name: 'English Forest', language: 'en', numberOfQuestions: 20 },
    { id: 'numbers', name: 'Numbers Island', language: 'global', numberOfQuestions: 25, skillFilter: 'Numeracy' },
    { id: 'bahasa', name: 'Rimba Bahasa', language: 'ms', numberOfQuestions: 20 },
    { id: 'mandarin', name: 'Mandarin Mountain', language: 'zh', numberOfQuestions: 15 },
    { id: 'science', name: 'Mystery Jungle', language: 'global', numberOfQuestions: 30, skillFilter: 'General Science' }
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  
  // Form state
  const [questName, setQuestName] = useState('');
  const [questLanguage, setQuestLanguage] = useState<'global' | 'en' | 'ms' | 'zh'>('global');
  const [numberOfQuestions, setNumberOfQuestions] = useState(20);
  const [skillFilter, setSkillFilter] = useState('All Skills');

  const skills = ['All Skills', 'Phonics', 'Logic', 'Numeracy', 'Social-Emotional', 'General Science'];

  const handleAddQuest = () => {
    setEditingQuest(null);
    setQuestName('');
    setQuestLanguage('global');
    setNumberOfQuestions(20);
    setSkillFilter('All Skills');
    setShowModal(true);
  };

  const handleEditQuest = (quest: Quest) => {
    setEditingQuest(quest);
    setQuestName(quest.name);
    setQuestLanguage(quest.language);
    setNumberOfQuestions(quest.numberOfQuestions);
    setSkillFilter(quest.skillFilter || 'All Skills');
    setShowModal(true);
  };

  const handleSaveQuest = () => {
    const questData: Quest = {
      id: editingQuest?.id || Date.now().toString(),
      name: questName,
      language: questLanguage,
      numberOfQuestions,
      skillFilter: questLanguage === 'global' && skillFilter !== 'All Skills' ? skillFilter : undefined
    };

    if (editingQuest) {
      // Update existing quest
      setQuests(prev => prev.map(q => q.id === editingQuest.id ? questData : q));
    } else {
      // Add new quest
      setQuests(prev => [...prev, questData]);
    }

    setShowModal(false);
  };

  const handleDeleteQuest = (questId: string) => {
    if (confirm('Are you sure you want to delete this quest?')) {
      setQuests(prev => prev.filter(q => q.id !== questId));
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quest Management</h1>
            <p className="text-sm text-gray-500 mt-1">Configure quest modules and question pools</p>
          </div>
          <button
            onClick={handleAddQuest}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Quest
          </button>
        </div>

        {/* Quest List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Quest Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Language Pool
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Skill Filter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quests.map(quest => (
                  <tr key={quest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{quest.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-black text-white">
                        {quest.language === 'global' ? 'Global' : quest.language.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {quest.skillFilter || 'All'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{quest.numberOfQuestions} questions</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditQuest(quest)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuest(quest.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Quest Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingQuest ? 'Edit Quest' : 'Add New Quest'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Quest Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quest Name
                </label>
                <input
                  type="text"
                  value={questName}
                  onChange={(e) => setQuestName(e.target.value)}
                  placeholder="e.g., English Forest"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                />
              </div>

              {/* Question Pool Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Pool Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['global', 'en', 'ms', 'zh'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setQuestLanguage(lang)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        questLanguage === lang
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {lang === 'global' ? 'Global' : lang === 'en' ? 'EN' : lang === 'ms' ? 'BM' : '中文'}
                    </button>
                  ))}
                </div>
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
                  value={numberOfQuestions}
                  onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Questions will be balanced across ages (4, 5, 6, 7)
                </p>
              </div>

              {/* Skill Filter (only for Global) */}
              {questLanguage === 'global' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Skill (Optional)
                  </label>
                  <select
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  >
                    {skills.map(skill => (
                      <option key={skill} value={skill}>{skill}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select "All Skills" to include all global questions
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuest}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {editingQuest ? 'Update Quest' : 'Create Quest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

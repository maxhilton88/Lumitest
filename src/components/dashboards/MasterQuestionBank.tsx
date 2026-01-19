import React, { useState } from 'react';
import { QuestionEditor } from '../admin/QuestionEditor';
import { Plus, Search, Edit, Trash2, Copy, ChevronRight, ArrowLeft } from 'lucide-react';

export const MasterQuestionBank: React.FC = () => {
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuest, setSelectedQuest] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'quests' | 'all'>('quests');

  const [questions, setQuestions] = useState([
    {
      id: '1',
      quest: 'english',
      language: 'en',
      difficulty: 1,
      type: 'mcq',
      voiceScript: 'Which letter comes after A?',
      skills: ['Phonics'],
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      quest: 'numbers',
      language: 'en',
      difficulty: 2,
      type: 'mcq',
      voiceScript: 'How many apples are there?',
      skills: ['Numeracy', 'Logic'],
      createdAt: '2024-01-14'
    },
    {
      id: '3',
      quest: 'english',
      language: 'ms',
      difficulty: 1,
      type: 'mcq',
      voiceScript: 'Huruf apa selepas A?',
      skills: ['Phonics'],
      createdAt: '2024-01-13'
    },
    {
      id: '4',
      quest: 'bahasa',
      language: 'ms',
      difficulty: 2,
      type: 'mcq',
      voiceScript: 'Apakah warna langit?',
      skills: ['Language'],
      createdAt: '2024-01-12'
    }
  ]);

  const quests = [
    { id: 'english', name: 'English Forest', icon: '🌳', color: '#7cc643' },
    { id: 'numbers', name: 'Numbers Island', icon: '🔢', color: '#4a90e2' },
    { id: 'bahasa', name: 'Rimba Bahasa', icon: '🇲🇾', color: '#e74c3c' },
    { id: 'mandarin', name: 'Mandarin Mountain', icon: '🏔️', color: '#f39c12' },
    { id: 'science', name: 'Mystery Jungle', icon: '🔬', color: '#9b59b6' }
  ];

  const handleSaveQuestion = (questionData: any) => {
    const newQuestion = {
      id: String(questions.length + 1),
      ...questionData,
      voiceScript: questionData.voiceScript.en || questionData.voiceScript.ms || questionData.voiceScript.zh,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setQuestions([...questions, newQuestion]);
    setShowEditor(false);
  };

  const getQuestQuestionCount = (questId: string) => {
    return questions.filter(q => q.quest === questId).length;
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.voiceScript.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesQuest = !selectedQuest || q.quest === selectedQuest;
    return matchesSearch && matchesQuest;
  });

  if (showEditor) {
    return (
      <QuestionEditor
        onSave={handleSaveQuestion}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-8 py-6">
        {/* Back button - above title */}
        {(selectedQuest || viewMode === 'all') && (
          <button
            onClick={() => {
              setSelectedQuest(null);
              setViewMode('quests');
            }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        
        {/* Title and New Question button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedQuest 
                ? quests.find(q => q.id === selectedQuest)?.name
                : viewMode === 'all'
                ? 'All Questions'
                : 'Question Bank'
              }
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {selectedQuest || viewMode === 'all'
                ? 'Manage questions'
                : 'Organize questions by quest module'
              }
            </p>
          </div>
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Question
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* QUEST LIST VIEW */}
        {viewMode === 'quests' && !selectedQuest && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-6 mb-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Questions</div>
                <div className="text-2xl font-semibold text-gray-900">{questions.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Quest Modules</div>
                <div className="text-2xl font-semibold text-gray-900">{quests.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Languages</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {new Set(questions.map(q => q.language)).size}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">
                  <button
                    onClick={() => setViewMode('all')}
                    className="text-gray-900 hover:underline font-medium"
                  >
                    View All Questions →
                  </button>
                </div>
              </div>
            </div>

            {/* Quest Cards */}
            <div className="space-y-3">
              {quests.map((quest) => {
                const questionCount = getQuestQuestionCount(quest.id);
                return (
                  <button
                    key={quest.id}
                    onClick={() => setSelectedQuest(quest.id)}
                    className="w-full border border-gray-100 rounded-lg p-6 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{quest.icon}</div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{quest.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTIONS TABLE VIEW (Selected Quest or All) */}
        {(selectedQuest || viewMode === 'all') && (
          <div>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                />
              </div>
            </div>

            {/* Stats for selected quest */}
            <div className="grid grid-cols-4 gap-6 mb-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Questions</div>
                <div className="text-2xl font-semibold text-gray-900">{filteredQuestions.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Languages</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {new Set(filteredQuestions.map(q => q.language)).size}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Foundation</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {filteredQuestions.filter(q => q.difficulty === 1).length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Advanced</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {filteredQuestions.filter(q => q.difficulty === 3).length}
                </div>
              </div>
            </div>

            {/* Questions Table */}
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Question</th>
                    {viewMode === 'all' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Quest</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Skills</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Difficulty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Language</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuestions.map((question) => (
                    <tr key={question.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-md truncate">{question.voiceScript}</div>
                        <div className="text-xs text-gray-500 mt-1">{question.createdAt}</div>
                      </td>
                      {viewMode === 'all' && (
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 capitalize">
                            {quests.find(q => q.id === question.quest)?.name}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 uppercase">{question.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {question.skills.map((skill, i) => (
                            <span key={i} className="text-xs text-gray-600">
                              {skill}{i < question.skills.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {question.difficulty === 1 ? 'Foundation' : question.difficulty === 2 ? 'Intermediate' : 'Advanced'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 uppercase">{question.language}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Edit">
                            <Edit className="w-4 h-4 text-gray-400" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Duplicate">
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredQuestions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 mb-4">No questions found</p>
                  <button
                    onClick={() => setShowEditor(true)}
                    className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Create First Question
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
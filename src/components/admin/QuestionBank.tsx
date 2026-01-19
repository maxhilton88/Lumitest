import React, { useState } from 'react';
import { Plus, Search, Download, Upload as UploadIcon, Edit, Trash2, Package } from 'lucide-react';
import { QuestionEditor } from './QuestionEditor';
import { BulkUpload } from './BulkUpload';
import { downloadAllTemplates } from '../../utils/templateGenerator';
import { toast } from 'sonner@2.0.3';
import { QuestionBankSkeleton } from '../ui/skeleton-loader';
import { useConfirmation } from '../ui/confirmation-dialog';

interface Question {
  id: string;
  type: 'mcq' | 'dragdrop' | 'hotspot' | 'sequence';
  question: { en: string; ms: string; zh: string };
  language: 'global' | 'en' | 'ms' | 'zh';
  ageDifficulty: 4 | 5 | 6 | 7;
  quest: string; // Added quest field
  skills: string[];
  tags: string[];
  createdAt: string;
}

interface LumiQuestBundle {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  language: 'global' | 'en' | 'ms' | 'zh';
  skills: string[];
  tags: string[];
  questions: Question[];
  createdAt: string;
}

interface QuestionBankProps {
  questionBank: Question[];
  setQuestionBank: (questions: Question[]) => void;
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ questionBank, setQuestionBank }) => {
  const [activeTab, setActiveTab] = useState<'lumi' | 'mine'>('lumi');
  const [showEditor, setShowEditor] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMyQuest, setSelectedMyQuest] = useState<string>('all');
  
  const { ConfirmDialog, confirm } = useConfirmation();

  // Lumi Official Quest Bundles
  const [lumiQuestBundles] = useState<LumiQuestBundle[]>([
    {
      id: 'numbers-basic',
      name: 'Numbers 1-10 Basics',
      description: 'Fundamental counting and number recognition for beginners',
      icon: '🔢',
      color: '#4a90e2',
      language: 'global',
      skills: ['Numeracy'],
      tags: ['Numbers 1-10'],
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          question: { en: 'What is 1 + 1?', ms: 'Berapa 1 + 1?', zh: '1 + 1 等于几？' },
          language: 'global',
          ageDifficulty: 5,
          quest: 'numbers',
          skills: ['Numeracy'],
          tags: ['Numbers 1-10'],
          createdAt: '2024-01-01'
        },
        {
          id: 'q2',
          type: 'mcq',
          question: { en: 'Count the apples: 🍎🍎🍎', ms: 'Kira epal: 🍎🍎🍎', zh: '数苹果：🍎🍎🍎' },
          language: 'global',
          ageDifficulty: 4,
          quest: 'numbers',
          skills: ['Numeracy'],
          tags: ['Numbers 1-10'],
          createdAt: '2024-01-01'
        },
        // More questions...
      ],
      createdAt: '2024-01-01'
    },
    {
      id: 'animals-sounds',
      name: 'Animal Sounds & Names',
      description: 'Learn animal names and their sounds in multiple languages',
      icon: '🐾',
      color: '#7cc643',
      language: 'global',
      skills: ['Phonics'],
      tags: ['Animals'],
      questions: [
        {
          id: 'q3',
          type: 'mcq',
          question: { en: 'Which animal says "Meow"?', ms: 'Haiwan apa yang kata "Meow"?', zh: '哪种动物叫"喵"？' },
          language: 'global',
          ageDifficulty: 4,
          quest: 'english',
          skills: ['Phonics'],
          tags: ['Animals'],
          createdAt: '2024-01-02'
        },
        // More questions...
      ],
      createdAt: '2024-01-02'
    },
    {
      id: 'colors-basic',
      name: 'Basic Colors Recognition',
      description: 'Identify and name primary and secondary colors',
      icon: '🌈',
      color: '#e91e63',
      language: 'global',
      skills: ['General Science'],
      tags: ['Colors'],
      questions: [],
      createdAt: '2024-01-03'
    }
  ]);

  const quests = [
    { id: 'all', name: 'All Quests', icon: '📚', color: '#gray' },
    { id: 'english', name: 'English Forest', icon: '🌳', color: '#7cc643' },
    { id: 'numbers', name: 'Numbers Island', icon: '🔢', color: '#4a90e2' },
    { id: 'bahasa', name: 'Rimba Bahasa', icon: '🇲🇾', color: '#e74c3c' },
    { id: 'mandarin', name: 'Mandarin Mountain', icon: '🏔️', color: '#f39c12' },
    { id: 'science', name: 'Mystery Jungle', icon: '🔬', color: '#9b59b6' }
  ];

  const handleImportQuest = (bundle: LumiQuestBundle) => {
    const importedQuestions = bundle.questions.map(q => ({
      ...q,
      id: `${Date.now()}-${q.id}`,
      createdAt: new Date().toISOString().split('T')[0]
    }));
    
    setQuestionBank([...questionBank, ...importedQuestions]);
    toast.success(`Successfully imported ${bundle.questions.length} questions from "${bundle.name}"!`);
  };

  const handleCreateQuestion = (questionData: any) => {
    const newQuestion: Question = {
      ...questionData,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setQuestionBank([...questionBank, newQuestion]);
    setShowEditor(false);
  };

  const handleDeleteQuestion = (id: string) => {
    confirm({
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: () => {
        setQuestionBank(questionBank.filter(q => q.id !== id));
        toast.success('Question deleted successfully');
      }
    });
  };

  const filteredBundles = lumiQuestBundles.filter(bundle => {
    const matchesSearch = bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bundle.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredMyQuestions = questionBank.filter(q => {
    const matchesSearch = q.question.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         q.question.ms.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         q.question.zh.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesQuest = selectedMyQuest === 'all' || q.quest === selectedMyQuest;
    return matchesSearch && matchesQuest;
  });

  // Group questions by quest
  const questionsByQuest = filteredMyQuestions.reduce((acc, question) => {
    const questId = question.quest || 'unassigned';
    if (!acc[questId]) {
      acc[questId] = [];
    }
    acc[questId].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Question Bank</h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'lumi' 
                ? 'Import official question bundles from Lumi Library' 
                : 'Manage your custom questions'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'mine' && (
              <>
                <button
                  onClick={() => setShowBulkUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <UploadIcon className="w-4 h-4" />
                  Bulk Upload
                </button>
                <button
                  onClick={() => downloadAllTemplates('csv')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </>
            )}
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Question
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('lumi')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'lumi'
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            📚 Lumi Library
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'mine'
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            ✏️ My Questions ({questionBank.length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'lumi' ? 'Search quest bundles...' : 'Search questions...'}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
          />
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'lumi' ? (
          // LUMI LIBRARY - Show Quest Bundles
          filteredBundles.length === 0 ? (
            <div className="text-center py-12 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-gray-500">No quest bundles found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBundles.map(bundle => (
                <div key={bundle.id} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors bg-white">
                  {/* Quest Icon & Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ backgroundColor: `${bundle.color}20` }}
                    >
                      {bundle.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{bundle.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2">{bundle.description}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 mb-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{bundle.questions.length} questions</span>
                    </div>
                    <span className="text-xs bg-gray-900 text-white px-2 py-1 rounded">
                      {bundle.language === 'global' ? 'Global' : bundle.language.toUpperCase()}
                    </span>
                  </div>

                  {/* Tags */}
                  {bundle.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {bundle.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                      {bundle.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{bundle.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Import Button */}
                  <button
                    onClick={() => handleImportQuest(bundle)}
                    className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Import Quest ({bundle.questions.length} questions)
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          // MY QUESTIONS - Show Grouped by Quest
          <div>
            {/* Quest Filter Dropdown */}
            <div className="mb-4">
              <select
                value={selectedMyQuest}
                onChange={(e) => setSelectedMyQuest(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
              >
                {quests.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.icon} {q.name}
                  </option>
                ))}
              </select>
            </div>

            {filteredMyQuestions.length === 0 ? (
              <div className="text-center py-12 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-gray-500 mb-4">
                  {selectedMyQuest === 'all' ? 'No questions created yet' : `No questions in ${quests.find(q => q.id === selectedMyQuest)?.name}`}
                </p>
                <button
                  onClick={() => setShowEditor(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Create Your First Question
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(questionsByQuest).map(([questId, questions]) => {
                  const quest = quests.find(q => q.id === questId);
                  return (
                    <div key={questId} className="border border-gray-200 rounded-lg p-4 bg-white">
                      {/* Quest Header */}
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: quest ? `${quest.color}20` : '#f3f4f6' }}
                        >
                          {quest?.icon || '📝'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {quest?.name || 'Unassigned'}
                          </h3>
                          <p className="text-xs text-gray-500">{questions.length} questions</p>
                        </div>
                      </div>

                      {/* Questions List */}
                      <div className="space-y-3">
                        {questions.map(question => (
                          <div key={question.id} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-900 text-white">
                                    {question.type.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-gray-500">Age {question.ageDifficulty}</span>
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {question.language === 'global' ? 'Global' : question.language.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                  {question.question.en}
                                </p>
                                {question.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {question.tags.map(tag => (
                                      <span key={tag} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Question Editor Modal */}
      {showEditor && (
        <QuestionEditor
          onSave={handleCreateQuestion}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUpload
          onClose={() => setShowBulkUpload(false)}
          onImport={(questions) => {
            setQuestionBank([...questionBank, ...questions]);
            setShowBulkUpload(false);
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
};
/**
 * TaxonomyManager — Superadmin KSSR Skill Taxonomy Manager
 *
 * Features:
 *   - CSV upload (parse + validate + save to KV)
 *   - Searchable/filterable skill table
 *   - Click-to-edit cells
 *   - Add / delete individual skills
 *   - CSV download
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Upload, Download, Search, Plus, Trash2, Edit3, Save, X,
  CheckCircle, AlertCircle, Filter, RefreshCw, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useTaxonomy } from '../../contexts/TaxonomyContext';
import { ageFromSkillCode, resolveSkillAge, VALID_AGES, AGE_INFO, SUBJECTS, type SubjectCode } from '../../data/kssr-taxonomy';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getFreshAdminToken } from '../../utils/supabase-client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

async function getToken(): Promise<string> {
  try {
    const fresh = await getFreshAdminToken();
    if (fresh) return fresh;
    const raw = localStorage.getItem('access_token');
    return raw || publicAnonKey;
  } catch {
    return publicAnonKey;
  }
}

interface SkillRow {
  subject: string;
  topic: string;
  subtopic: string;
  skillCode: string;
}

export function TaxonomyManager() {
  const taxonomy = useTaxonomy();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAge, setFilterAge] = useState<number | ''>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SkillRow>({ subject: '', topic: '', subtopic: '', skillCode: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSkill, setNewSkill] = useState<SkillRow>({ subject: '', topic: '', subtopic: '', skillCode: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filtered skills
  const filteredSkills = useMemo(() => {
    let skills = [...taxonomy.skills];
    if (filterAge) {
      skills = skills.filter(s => resolveSkillAge(s) === filterAge);
    }
    if (filterSubject) {
      skills = skills.filter(s => s.subject === filterSubject);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      skills = skills.filter(s =>
        s.skillCode.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.topic.toLowerCase().includes(q) ||
        s.subtopic.toLowerCase().includes(q)
      );
    }
    return skills;
  }, [taxonomy.skills, filterAge, filterSubject, searchQuery]);

  const totalPages = Math.ceil(filteredSkills.length / PAGE_SIZE);
  const pagedSkills = filteredSkills.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterAge, filterSubject, searchQuery]);

  // Upload CSV
  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const res = await fetch(`${API_BASE}/taxonomy/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }
      toast.success(data.message || `Uploaded ${data.count} skills`);
      if (data.errors?.length) {
        console.warn('[TAXONOMY] Upload warnings:', data.errors);
      }
      // Reload taxonomy
      await taxonomy.reload();
    } catch (err: any) {
      toast.error(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [taxonomy]);

  // Download CSV
  const handleDownload = useCallback(() => {
    const header = 'Subject,Topic,Subtopic,Skill Code,Age';
    const rows = taxonomy.skills.map(s =>
      `"${s.subject}","${s.topic.replace(/"/g, '""')}","${s.subtopic.replace(/"/g, '""')}","${s.skillCode}",${resolveSkillAge(s)}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kssr-taxonomy-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${taxonomy.skills.length} skills`);
  }, [taxonomy.skills]);

  // Add skill
  const handleAddSkill = useCallback(async () => {
    if (!newSkill.subject || !newSkill.skillCode) {
      toast.error('Subject and Skill Code are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/taxonomy/skill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify(newSkill),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add');
        return;
      }
      toast.success(`Added skill ${newSkill.skillCode}`);
      setNewSkill({ subject: '', topic: '', subtopic: '', skillCode: '' });
      setShowAddForm(false);
      await taxonomy.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [newSkill, taxonomy]);

  // Delete skill
  const handleDelete = useCallback(async (code: string) => {
    if (!confirm(`Delete skill ${code}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/taxonomy/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': `Bearer ${await getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Delete failed');
        return;
      }
      toast.success(`Deleted ${code}`);
      await taxonomy.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [taxonomy]);

  // Remove ALL skills
  const handleRemoveAll = useCallback(async () => {
    const count = taxonomy.skills.length;
    if (!confirm(`⚠️ Remove ALL ${count} skills from the taxonomy?\n\nThis cannot be undone. You can re-upload a corrected CSV afterwards.`)) return;
    setIsClearing(true);
    try {
      const token = await getToken();
      console.log('[TAXONOMY] Remove All — token type:', token === publicAnonKey ? 'anonKey (NO AUTH!)' : 'user token', 'length:', token.length);
      const res = await fetch(`${API_BASE}/taxonomy/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': `Bearer ${token}` },
      });
      const data = await res.json();
      console.log('[TAXONOMY] Remove All response:', res.status, data);
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove all');
        return;
      }
      toast.success(data.message || `Removed all ${count} skills`);
      await taxonomy.reload();
    } catch (err: any) {
      toast.error(`Remove all error: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  }, [taxonomy]);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingCode) return;
    try {
      const res = await fetch(`${API_BASE}/taxonomy/${encodeURIComponent(editingCode)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Update failed');
        return;
      }
      toast.success(`Updated ${editForm.skillCode}`);
      setEditingCode(null);
      await taxonomy.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [editingCode, editForm, taxonomy]);

  const inputCls = 'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  // Age stats summary
  const ageStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const s of taxonomy.skills) {
      const a = resolveSkillAge(s);
      counts[a] = (counts[a] || 0) + 1;
    }
    return counts;
  }, [taxonomy.skills]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            Skill Taxonomy Manager
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {taxonomy.skills.length} skills {taxonomy.isLive ? '(live from server)' : '(fallback)'} •
            {taxonomy.loading && ' Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => taxonomy.reload()}
            disabled={taxonomy.loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${taxonomy.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${isUploading ? 'bg-gray-100 text-gray-400' : 'bg-purple-50 hover:bg-purple-100 text-purple-700'}`}>
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Upload CSV'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
              disabled={isUploading}
            />
          </label>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
          <button
            onClick={handleRemoveAll}
            disabled={isClearing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Remove All'}
          </button>
        </div>
      </div>

      {/* Age distribution chips */}
      <div className="flex flex-wrap gap-2">
        {VALID_AGES.map(a => (
          <button
            key={a}
            onClick={() => setFilterAge(filterAge === a ? '' : a)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterAge === a
                ? 'text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            style={filterAge === a ? { background: AGE_INFO[a]?.tierColor || '#888' } : {}}
          >
            Age {a} ({ageStats[a] || 0})
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <h3 className="text-sm font-semibold text-blue-800">Add New Skill</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <select
                value={newSkill.subject}
                onChange={e => setNewSkill({ ...newSkill, subject: e.target.value })}
                className={inputCls + ' w-full'}
              >
                <option value="">Select...</option>
                {SUBJECTS.map(s => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Topic</label>
              <input
                value={newSkill.topic}
                onChange={e => setNewSkill({ ...newSkill, topic: e.target.value })}
                placeholder="e.g. Nombor"
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subtopic</label>
              <input
                value={newSkill.subtopic}
                onChange={e => setNewSkill({ ...newSkill, subtopic: e.target.value })}
                placeholder="e.g. Membilang 1-10"
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Skill Code</label>
              <input
                value={newSkill.skillCode}
                onChange={e => setNewSkill({ ...newSkill, skillCode: e.target.value })}
                placeholder="e.g. MAT-A4-N01"
                className={inputCls + ' w-full font-mono'}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddSkill}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search skill codes, topics, descriptions..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Subjects</option>
          {SUBJECTS.map(s => (
            <option key={s.code} value={s.code}>{s.code} — {s.name.en}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {filteredSkills.length} result{filteredSkills.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-16">#</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-24">Age</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-20">Subject</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Topic</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Subtopic</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-36">Skill Code</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedSkills.map((skill, idx) => {
              const isEditing = editingCode === skill.skillCode;
              const age = resolveSkillAge(skill);
              const rowNum = page * PAGE_SIZE + idx + 1;
              const ageInfo = AGE_INFO[age];

              return (
                <tr
                  key={skill.skillCode}
                  className={`border-b border-gray-100 ${isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 text-gray-400">{rowNum}</td>
                  <td className="px-3 py-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ background: ageInfo?.tierColor || '#888' }}
                    >
                      {age}
                    </span>
                  </td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.subject}
                          onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                          className="w-full px-1 py-0.5 border rounded text-xs"
                        >
                          {SUBJECTS.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.topic}
                          onChange={e => setEditForm({ ...editForm, topic: e.target.value })}
                          className="w-full px-1 py-0.5 border rounded text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.subtopic}
                          onChange={e => setEditForm({ ...editForm, subtopic: e.target.value })}
                          className="w-full px-1 py-0.5 border rounded text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.skillCode}
                          onChange={e => setEditForm({ ...editForm, skillCode: e.target.value })}
                          className="w-full px-1 py-0.5 border rounded text-xs font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingCode(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-gray-700">{skill.subject}</td>
                      <td className="px-3 py-2 text-gray-600">{skill.topic}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={skill.subtopic}>
                        {skill.subtopic}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                          {skill.skillCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => {
                              setEditingCode(skill.skillCode);
                              setEditForm({ subject: skill.subject, topic: skill.topic, subtopic: skill.subtopic, skillCode: skill.skillCode });
                            }}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(skill.skillCode)}
                            className="p-1 text-red-400 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {pagedSkills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {taxonomy.loading ? 'Loading taxonomy...' : 'No skills found matching your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-500" />
          CSV Upload Format
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          Upload a CSV with 5 columns — 4 required + Age (recommended). Headers are case-insensitive:
        </p>
        <code className="text-xs bg-white px-3 py-2 rounded border block font-mono text-gray-700">
          Subject,Topic,Subtopic,Skill Code,Age<br />
          MAT,Nombor,Membilang objek 1-10,MAT-A4-N01,4<br />
          ENG,Phonics,CVC words,ENG-T1-P01,7<br />
          BM,Membaca,Suku kata,BM-T2-M01,8
        </code>
        <p className="text-xs text-gray-400 mt-2">
          <strong>Age column</strong> (4–12) is the recommended way to set age. If omitted, age falls back to code parsing: A4=4, A5=5, A6=6, T1=7, T2=8, ... T6=12.
        </p>
      </div>
    </div>
  );
}
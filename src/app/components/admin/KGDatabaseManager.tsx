/**
 * KGDatabaseManager — Super Admin panel for managing the Kindergarten Postgres database.
 *
 * Features:
 *  - CSV bulk upload with column auto-mapping preview
 *  - Browse/search KGs with pagination, status filters
 *  - View stats (total, unclaimed, claimed, active, by state)
 *  - View & manage "KG not found" parent requests
 *  - Visualize KG territories on a map
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Search, Database, FileSpreadsheet, CheckCircle2, Clock,
  AlertCircle, MapPin, Phone, Mail, ChevronDown, ChevronUp,
  RefreshCw, Eye, Filter, Download, MessageCircle, X, Building2,
  ClipboardCopy, Users, CalendarClock, Zap, Pencil, Save, Globe, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  uploadKGCSV, fetchKGList, fetchKGStats, fetchKGRequests, updateKGRequest,
  setKGTrialDuration, bulkSetKGTrial, updateKG, createKG, deleteKG,
  fetchPendingClaims, approveClaim, rejectClaim
} from '../../utils/api';
import { Pagination } from '../Pagination';
import { KGTerritoryMap } from '../kg/KGTerritoryMap';

// ─── TYPES ────────────────────────────────────────────────────

interface KGRecord {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  state: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  principal_name: string | null;
  status: 'unclaimed' | 'claimed' | 'active' | 'suspended';
  claim_code: string | null;
  claimed_by: string | null;
  plan_tier: string;
  trial_start: string;
  trial_expires_at: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  // Postgres columns are lat/lng — mapped via fetchKGList
  lat?: number | null;
  lng?: number | null;
  territory_locked: boolean | null;
  territory_radius_km: number | null;
}

interface KGStats {
  total: number;
  unclaimed: number;
  claimed: number;
  active: number;
  pending_requests: number;
  by_state: Record<string, number>;
}

interface KGRequest {
  id: string;
  parent_id: string | null;
  kg_name: string;
  kg_location: string | null;
  kg_postcode: string | null;
  principal_name: string | null;
  principal_phone: string | null;
  principal_email: string | null;
  parent_message: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

// ─── STATUS BADGE ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    unclaimed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unclaimed' },
    claimed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Claimed' },
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active' },
    suspended: { bg: 'bg-red-50', text: 'text-red-700', label: 'Suspended' },
    new: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'New' },
    contacted: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Contacted' },
    signed_up: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Signed Up' },
    declined: { bg: 'bg-red-50', text: 'text-red-700', label: 'Declined' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  };
  const c = cfg[status] || { bg: 'bg-gray-50', text: 'text-gray-500', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

type Tab = 'overview' | 'upload' | 'browse' | 'requests' | 'claims' | 'map';

export function KGDatabaseManager() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<KGStats | null>(null);
  const [pendingClaimCount, setPendingClaimCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchKGStats();
      setStats(s);
    } catch (err: any) {
      console.error('[KG-DB] Stats load error:', err);
    }
    // Also load pending claim count
    try {
      const c = await fetchPendingClaims();
      setPendingClaimCount(c.pending_count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Database },
    { id: 'upload', label: 'CSV Upload', icon: Upload },
    { id: 'browse', label: 'Browse KGs', icon: Building2 },
    { id: 'requests', label: 'Requests', icon: MessageCircle },
    { id: 'claims', label: 'Pending Claims', icon: CheckCircle2 },
    { id: 'map', label: 'Map', icon: MapPin },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'requests' && stats?.pending_requests ? (
                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px]">
                  {stats.pending_requests}
                </span>
              ) : null}
              {t.id === 'claims' && pendingClaimCount > 0 ? (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px]">
                  {pendingClaimCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab stats={stats} onRefresh={loadStats} />}
      {tab === 'upload' && <CSVUploadTab onUploadComplete={loadStats} />}
      {tab === 'browse' && <BrowseTab />}
      {tab === 'requests' && <RequestsTab onUpdate={loadStats} />}
      {tab === 'claims' && <PendingClaimsTab onUpdate={loadStats} />}
      {tab === 'map' && <MapTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ stats, onRefresh }: { stats: KGStats | null; onRefresh: () => void }) {
  if (!stats) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading stats...</div>;
  }

  const statCards = [
    { label: 'Total KGs', value: stats.total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unclaimed', value: stats.unclaimed, icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Claimed', value: stats.claimed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active', value: stats.active, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending Requests', value: stats.pending_requests, icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const stateEntries = Object.entries(stats.by_state).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* By state breakdown */}
      {stateEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Distribution by State</h3>
            <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stateEntries.map(([state, count]) => (
              <div key={state} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-700">{state}</span>
                <span className="text-xs font-semibold text-gray-900">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CSV UPLOAD TAB
// ═══════════════════════════════════════════════════════════════

/** Parse a single CSV/TSV line respecting quoted fields (commas inside quotes) */
function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { fields.push(field.trim()); field = ''; }
      else { field += ch; }
    }
  }
  fields.push(field.trim());
  // Strip trailing empty cells
  let end = fields.length;
  while (end > 0 && fields[end - 1] === '') end--;
  return fields.slice(0, end);
}

function CSVUploadTab({ onUploadComplete }: { onUploadComplete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);

      // Auto-detect tab vs comma delimiter
      const lines = text.split('\n').filter(l => l.trim());
      const firstLine = lines[0] || '';
      const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
      // Parse preview with proper quote-aware parser
      const preview = lines.slice(0, 6).map(l => parseCSVLine(l, delim));
      setPreviewRows(preview);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvText) {
      toast.error('Please select a CSV file first');
      return;
    }
    setIsUploading(true);
    setResult(null);
    try {
      const res = await uploadKGCSV(csvText);
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`Imported ${res.inserted} kindergartens!`);
        onUploadComplete();
      }
      if (res.errors?.length > 0) {
        toast.error(`${res.errors.length} row errors. First: ${res.errors[0]?.slice(0, 120)}`);
      }
    } catch (err: any) {
      toast.error(err.message);
      setResult({ error: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">CSV Upload Guide</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>- CSV must have a header row. We auto-detect columns by name.</li>
          <li>- Required: <strong>name</strong> (or school_name, kindergarten_name, nama, nama_tadika)</li>
          <li>- Optional: address, postcode, state, city, phone, email, principal_name</li>
          <li>- <strong>Geo:</strong> latitude/lat, longitude/lng — auto-detected from Google Maps scrape data</li>
          <li>- Each KG will get a unique 8-character claim code for the owner to verify.</li>
          <li>- Duplicate uploads will create new entries (no deduplication yet).</li>
        </ul>
      </div>

      {/* File picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        >
          <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-gray-800">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {previewRows.length > 1 ? `${previewRows.length - 1} rows previewed` : 'Click to change'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-600">Click to select CSV file</p>
              <p className="text-xs text-gray-400 mt-1">Supports .csv and .txt files</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700">Preview (first 5 rows)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {previewRows[0]?.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">
                      {h || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(1, 6).map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload button */}
      {csvText && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload & Import
            </>
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className={`rounded-xl border p-4 ${result.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          {result.error ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Upload Failed</p>
                <p className="text-xs text-red-600 mt-1">{result.error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">Import Complete</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-2">
                  <div className="text-lg font-bold text-emerald-700">{result.inserted}</div>
                  <div className="text-[10px] text-gray-500">Inserted</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-500">{result.skipped}</div>
                  <div className="text-[10px] text-gray-500">Skipped</div>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <div className="text-lg font-bold text-red-500">{result.errors?.length || 0}</div>
                  <div className="text-[10px] text-gray-500">Errors</div>
                </div>
              </div>
              {result.detected_headers && (
                <p className="text-[10px] text-gray-500 mt-2">
                  Detected columns: {result.detected_headers.join(', ')}
                </p>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {result.errors.map((e: string, i: number) => <p key={i}>- {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BROWSE KGS TAB
// ═══════════════════════════════════════════════════════════════

function BrowseTab() {
  const [kgs, setKGs] = useState<KGRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  // Trial modal state
  const [trialModalKG, setTrialModalKG] = useState<KGRecord | null>(null);
  const [trialMonths, setTrialMonths] = useState(3);
  const [isSettingTrial, setIsSettingTrial] = useState(false);
  // Bulk trial state
  const [showBulkTrial, setShowBulkTrial] = useState(false);
  const [bulkTrialMonths, setBulkTrialMonths] = useState(3);
  const [bulkStatusFilter, setBulkStatusFilter] = useState('');
  const [isSettingBulkTrial, setIsSettingBulkTrial] = useState(false);
  // Edit KG state
  const [editingKgId, setEditingKgId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Delete KG state
  const [deletingKgId, setDeletingKgId] = useState<string | null>(null);
  const [isDeletingKg, setIsDeletingKg] = useState(false);
  // Create KG state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFields, setCreateFields] = useState<Record<string, string>>({
    name: '', address: '', postcode: '', state: '', city: '',
    phone: '', email: '', principal_name: '',
    latitude: '', longitude: '',
    status: 'unclaimed', plan_tier: 'free',
    territory_locked: 'false', territory_radius_km: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async (p: number, s: string, st: string) => {
    setIsLoading(true);
    try {
      const data = await fetchKGList({ search: s, status: st, page: p, limit: 30 });
      setKGs(data.kindergartens);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
    } catch (err: any) {
      console.error('[KG-DB] Load error:', err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, '', '');
  }, [load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, val, statusFilter), 400);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    load(1, search, val);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Claim code copied!');
  };

  const handleSetTrial = async () => {
    if (!trialModalKG) return;
    setIsSettingTrial(true);
    try {
      const result = await setKGTrialDuration(trialModalKG.id, trialMonths, 'trial');
      toast.success(`Trial set for "${trialModalKG.name}": ${trialMonths} month(s), expires ${new Date(result.trial_expires_at).toLocaleDateString()}`);
      setTrialModalKG(null);
      load(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSettingTrial(false);
    }
  };

  const handleBulkTrial = async () => {
    setIsSettingBulkTrial(true);
    try {
      const result = await bulkSetKGTrial(bulkTrialMonths, bulkStatusFilter || undefined, 'trial');
      toast.success(`Bulk trial set: ${result.affected} KGs updated to ${bulkTrialMonths} month(s)`);
      setShowBulkTrial(false);
      load(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSettingBulkTrial(false);
    }
  };

  const handleEditStart = (kg: KGRecord) => {
    setEditingKgId(kg.id);
    setEditFields({
      name: kg.name,
      address: kg.address || '',
      postcode: kg.postcode || '',
      state: kg.state || '',
      city: kg.city || '',
      phone: kg.phone || '',
      email: kg.email || '',
      principal_name: kg.principal_name || '',
      latitude: (kg.lat ?? kg.latitude) != null ? String(kg.lat ?? kg.latitude) : '',
      longitude: (kg.lng ?? kg.longitude) != null ? String(kg.lng ?? kg.longitude) : '',
      status: kg.status || 'unclaimed',
      plan_tier: kg.plan_tier || 'free',
      territory_locked: kg.territory_locked ? 'true' : 'false',
      territory_radius_km: kg.territory_radius_km != null ? String(kg.territory_radius_km) : '',
    });
  };

  const handleEditSave = async () => {
    if (!editingKgId) return;
    setIsSavingEdit(true);
    try {
      // Convert lat/lng to numbers or null for the API
      const payload: Record<string, any> = { ...editFields };
      // Map form field names to Postgres column names (lat/lng)
      payload.lat = editFields.latitude ? parseFloat(editFields.latitude) : null;
      payload.lng = editFields.longitude ? parseFloat(editFields.longitude) : null;
      delete payload.latitude;
      delete payload.longitude;
      payload.territory_locked = editFields.territory_locked === 'true';
      payload.territory_radius_km = editFields.territory_radius_km ? parseFloat(editFields.territory_radius_km) : null;
      const result = await updateKG(editingKgId, payload);
      toast.success(`Updated "${result.kindergarten?.name || editFields.name}"`);
      setEditingKgId(null);
      load(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditCancel = () => {
    setEditingKgId(null);
    setEditFields({});
  };

  const handleDeleteKg = async (kg: KGRecord) => {
    setIsDeletingKg(true);
    try {
      await deleteKG(kg.id);
      toast.success(`Deleted "${kg.name}" successfully`);
      setDeletingKgId(null);
      load(page, search, statusFilter);
      // Refresh stats too
      try {
        const s = await fetchKGStats();
        setStats(s.stats);
      } catch (_) {}
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete kindergarten');
    } finally {
      setIsDeletingKg(false);
    }
  };

  const handleCreateStart = () => {
    setShowCreateModal(true);
    setCreateFields({
      name: '', address: '', postcode: '', state: '', city: '',
      phone: '', email: '', principal_name: '',
      latitude: '', longitude: '',
      status: 'unclaimed', plan_tier: 'free',
      territory_locked: 'false', territory_radius_km: '',
    });
  };

  const handleCreateSave = async () => {
    setIsCreating(true);
    try {
      // Convert lat/lng to numbers or null for the API
      const payload: Record<string, any> = { ...createFields };
      // Map form field names to Postgres column names (lat/lng)
      payload.lat = createFields.latitude ? parseFloat(createFields.latitude) : null;
      payload.lng = createFields.longitude ? parseFloat(createFields.longitude) : null;
      delete payload.latitude;
      delete payload.longitude;
      payload.territory_locked = createFields.territory_locked === 'true';
      payload.territory_radius_km = createFields.territory_radius_km ? parseFloat(createFields.territory_radius_km) : null;
      const result = await createKG(payload);
      toast.success(`Created "${result.kindergarten?.name || createFields.name}"`);
      setShowCreateModal(false);
      load(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCancel = () => {
    setShowCreateModal(false);
    setCreateFields({});
  };

  return (
    <div className="space-y-3">
      {/* Search bar + filters + bulk actions */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name, postcode, email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => handleStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
        >
          <option value="">All Status</option>
          <option value="unclaimed">Unclaimed</option>
          <option value="claimed">Claimed</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          onClick={() => setShowBulkTrial(true)}
          className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
        >
          Set Bulk Trial
        </button>
        <button
          onClick={handleCreateStart}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add KG
        </button>
      </div>

      {/* Stats line */}
      <div className="text-[11px] text-gray-500">
        Showing {kgs.length} of {total.toLocaleString()} kindergartens
        {isLoading && <span className="ml-2 text-blue-500">Loading...</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Name</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Location</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Status</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Claim Code</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Plan</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {kgs.map(kg => (
                <React.Fragment key={kg.id}>
                  <tr
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === kg.id ? null : kg.id)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px]">
                      <div className="truncate">{kg.name}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <div className="truncate max-w-[150px]">
                        {[kg.city, kg.state, kg.postcode].filter(Boolean).join(', ') || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={kg.status} /></td>
                    <td className="px-3 py-2">
                      {kg.claim_code ? (
                        <button
                          onClick={e => { e.stopPropagation(); copyCode(kg.claim_code!); }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono"
                        >
                          {kg.claim_code}
                          <ClipboardCopy className="w-3 h-3" />
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 capitalize">{kg.plan_tier}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(kg.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === kg.id && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500">Address:</span>
                            <p className="text-gray-800 mt-0.5">{kg.address || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Phone:</span>
                            <p className="text-gray-800 mt-0.5">{kg.phone || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Email:</span>
                            <p className="text-gray-800 mt-0.5">{kg.email || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Principal:</span>
                            <p className="text-gray-800 mt-0.5">{kg.principal_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">ID:</span>
                            <p className="text-gray-800 mt-0.5 font-mono text-[10px]">{kg.id}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Claimed By:</span>
                            <p className="text-gray-800 mt-0.5 font-mono text-[10px]">{kg.claimed_by || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Trial Expires:</span>
                            <p className="text-gray-800 mt-0.5">
                              {kg.trial_expires_at ? new Date(kg.trial_expires_at).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Coordinates:</span>
                            <p className={`mt-0.5 font-mono text-[10px] ${(kg.lat ?? kg.latitude) != null ? 'text-emerald-700' : 'text-red-400'}`}>
                              {(kg.lat ?? kg.latitude) != null && (kg.lng ?? kg.longitude) != null
                                ? `${Number(kg.lat ?? kg.latitude).toFixed(6)}, ${Number(kg.lng ?? kg.longitude).toFixed(6)}`
                                : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Territory:</span>
                            <p className="mt-0.5">
                              {kg.territory_locked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                                  Locked ({kg.territory_radius_km || 3}km)
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">Not locked</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {/* Trial action button */}
                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); setTrialModalKG(kg); setTrialMonths(3); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200"
                          >
                            <CalendarClock className="w-3 h-3" />
                            {kg.trial_expires_at ? 'Extend Trial' : 'Set Free Trial'}
                          </button>
                          {kg.trial_expires_at && (
                            <span className={`text-[10px] ${new Date(kg.trial_expires_at) > new Date() ? 'text-emerald-600' : 'text-red-500'}`}>
                              {new Date(kg.trial_expires_at) > new Date()
                                ? `Active — expires ${new Date(kg.trial_expires_at).toLocaleDateString()}`
                                : `Expired ${new Date(kg.trial_expires_at).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                        {/* Edit & Delete action buttons */}
                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); handleEditStart(kg); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          {deletingKgId === kg.id ? (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                onClick={e => { e.stopPropagation(); setDeletingKgId(null); }}
                                disabled={isDeletingKg}
                                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteKg(kg); }}
                                disabled={isDeletingKg}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-white bg-red-600 rounded-md hover:bg-red-500 disabled:opacity-50"
                              >
                                {isDeletingKg ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                {isDeletingKg ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setDeletingKgId(kg.id); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-red-500 bg-white border border-red-200 rounded-md hover:bg-red-50 hover:border-red-300 ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {kgs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                    {search ? 'No kindergartens match your search' : 'No kindergartens in database yet. Upload a CSV to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={p => load(p, search, statusFilter)}
          />
        </div>
      )}

      {/* ── Trial Modal (per KG) ────────────────────────── */}
      {trialModalKG && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTrialModalKG(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-purple-600" />
                Set Free Trial
              </h3>
              <button onClick={() => setTrialModalKG(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-800">{trialModalKG.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {[trialModalKG.city, trialModalKG.state].filter(Boolean).join(', ') || 'No location'}
              </p>
              {trialModalKG.trial_expires_at && (
                <p className={`text-[10px] mt-1 ${new Date(trialModalKG.trial_expires_at) > new Date() ? 'text-emerald-600' : 'text-red-500'}`}>
                  Current trial: {new Date(trialModalKG.trial_expires_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <label className="block text-xs text-gray-600 mb-1.5">Trial Duration (months)</label>
            <div className="flex gap-2 mb-4">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setTrialMonths(m)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    trialMonths === m
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m}mo
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                min={1}
                max={36}
                value={trialMonths}
                onChange={e => setTrialMonths(Math.max(1, Math.min(36, parseInt(e.target.value) || 1)))}
                className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <span className="text-xs text-gray-500">
                Expires: {new Date(Date.now() + trialMonths * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTrialModalKG(null)}
                className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSetTrial}
                disabled={isSettingTrial}
                className="flex-1 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSettingTrial ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Setting...</>
                ) : (
                  <><CalendarClock className="w-3 h-3" /> Set Trial</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Trial Modal ────────────────────────────── */}
      {showBulkTrial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBulkTrial(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Bulk Set Trial
              </h3>
              <button onClick={() => setShowBulkTrial(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-[10px] text-amber-700">
                This will set/overwrite trial duration for ALL matching kindergartens in the Postgres database.
              </p>
            </div>

            <label className="block text-xs text-gray-600 mb-1.5">Filter by Status (optional)</label>
            <select
              value={bulkStatusFilter}
              onChange={e => setBulkStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white mb-3"
            >
              <option value="">All KGs</option>
              <option value="unclaimed">Unclaimed only</option>
              <option value="claimed">Claimed only</option>
              <option value="active">Active only</option>
            </select>

            <label className="block text-xs text-gray-600 mb-1.5">Trial Duration (months)</label>
            <div className="flex gap-2 mb-4">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setBulkTrialMonths(m)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    bulkTrialMonths === m
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m}mo
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkTrial(false)}
                className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTrial}
                disabled={isSettingBulkTrial}
                className="flex-1 py-2 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSettingBulkTrial ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Applying...</>
                ) : (
                  <><Zap className="w-3 h-3" /> Apply to All</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────── */}
      {editingKgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => handleEditCancel()}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-gray-700" />
                Edit Kindergarten
              </h3>
              <button onClick={() => handleEditCancel()} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-800">Kindergarten Details</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Name</label>
                <input
                  type="text"
                  value={editFields.name}
                  onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Address</label>
                <input
                  type="text"
                  value={editFields.address}
                  onChange={e => setEditFields({ ...editFields, address: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Postcode</label>
                <input
                  type="text"
                  value={editFields.postcode}
                  onChange={e => setEditFields({ ...editFields, postcode: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">State</label>
                <input
                  type="text"
                  value={editFields.state}
                  onChange={e => setEditFields({ ...editFields, state: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">City</label>
                <input
                  type="text"
                  value={editFields.city}
                  onChange={e => setEditFields({ ...editFields, city: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Phone</label>
                <input
                  type="text"
                  value={editFields.phone}
                  onChange={e => setEditFields({ ...editFields, phone: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Email</label>
                <input
                  type="text"
                  value={editFields.email}
                  onChange={e => setEditFields({ ...editFields, email: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Principal Name</label>
                <input
                  type="text"
                  value={editFields.principal_name}
                  onChange={e => setEditFields({ ...editFields, principal_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Latitude</label>
                <input
                  type="text"
                  value={editFields.latitude}
                  onChange={e => setEditFields({ ...editFields, latitude: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Longitude</label>
                <input
                  type="text"
                  value={editFields.longitude}
                  onChange={e => setEditFields({ ...editFields, longitude: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={editFields.status}
                  onChange={e => setEditFields({ ...editFields, status: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="unclaimed">Unclaimed</option>
                  <option value="claimed">Claimed</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Plan Tier</label>
                <select
                  value={editFields.plan_tier}
                  onChange={e => setEditFields({ ...editFields, plan_tier: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="free">Free</option>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="founder">Founder</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Territory Locked</label>
                <select
                  value={editFields.territory_locked}
                  onChange={e => setEditFields({ ...editFields, territory_locked: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Territory Radius (km)</label>
                <input
                  type="text"
                  value={editFields.territory_radius_km}
                  onChange={e => setEditFields({ ...editFields, territory_radius_km: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleEditCancel()}
                className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSavingEdit}
                className="flex-1 py-2 text-xs font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSavingEdit ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-3 h-3" /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => handleCreateCancel()}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-gray-700" />
                Add New Kindergarten
              </h3>
              <button onClick={() => handleCreateCancel()} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-800">Kindergarten Details</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Name</label>
                <input
                  type="text"
                  value={createFields.name}
                  onChange={e => setCreateFields({ ...createFields, name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Address</label>
                <input
                  type="text"
                  value={createFields.address}
                  onChange={e => setCreateFields({ ...createFields, address: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Postcode</label>
                <input
                  type="text"
                  value={createFields.postcode}
                  onChange={e => setCreateFields({ ...createFields, postcode: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">State</label>
                <input
                  type="text"
                  value={createFields.state}
                  onChange={e => setCreateFields({ ...createFields, state: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">City</label>
                <input
                  type="text"
                  value={createFields.city}
                  onChange={e => setCreateFields({ ...createFields, city: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Phone</label>
                <input
                  type="text"
                  value={createFields.phone}
                  onChange={e => setCreateFields({ ...createFields, phone: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Email</label>
                <input
                  type="text"
                  value={createFields.email}
                  onChange={e => setCreateFields({ ...createFields, email: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Principal Name</label>
                <input
                  type="text"
                  value={createFields.principal_name}
                  onChange={e => setCreateFields({ ...createFields, principal_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Latitude</label>
                <input
                  type="text"
                  value={createFields.latitude}
                  onChange={e => setCreateFields({ ...createFields, latitude: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Longitude</label>
                <input
                  type="text"
                  value={createFields.longitude}
                  onChange={e => setCreateFields({ ...createFields, longitude: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={createFields.status}
                  onChange={e => setCreateFields({ ...createFields, status: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="unclaimed">Unclaimed</option>
                  <option value="claimed">Claimed</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Plan Tier</label>
                <select
                  value={createFields.plan_tier}
                  onChange={e => setCreateFields({ ...createFields, plan_tier: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="free">Free</option>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="founder">Founder</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Territory Locked</label>
                <select
                  value={createFields.territory_locked}
                  onChange={e => setCreateFields({ ...createFields, territory_locked: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Territory Radius (km)</label>
                <input
                  type="text"
                  value={createFields.territory_radius_km}
                  onChange={e => setCreateFields({ ...createFields, territory_radius_km: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleCreateCancel()}
                className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSave}
                disabled={isCreating}
                className="flex-1 py-2 text-xs font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isCreating ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Creating...</>
                ) : (
                  <><Save className="w-3 h-3" /> Create KG</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  REQUESTS TAB
// ═══════════════════════════════════════════════════════════════

function RequestsTab({ onUpdate }: { onUpdate: () => void }) {
  const [requests, setRequests] = useState<KGRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchKGRequests(statusFilter || undefined);
      setRequests(data.requests);
    } catch (err: any) {
      console.error('[KG-DB] Requests load error:', err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateKGRequest(id, newStatus);
      toast.success(`Request updated to "${newStatus}"`);
      load();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="signed_up">Signed Up</option>
          <option value="declined">Declined</option>
        </select>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
        {isLoading && <span className="text-xs text-blue-500">Loading...</span>}
      </div>

      {/* Request cards */}
      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No requests found.
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">{req.kg_name}</h4>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                    {req.kg_location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {req.kg_location}
                      </div>
                    )}
                    {req.kg_postcode && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        Postcode: {req.kg_postcode}
                      </div>
                    )}
                    {req.principal_name && (
                      <div>Principal: {req.principal_name}</div>
                    )}
                    {req.principal_phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {req.principal_phone}
                      </div>
                    )}
                    {req.principal_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {req.principal_email}
                      </div>
                    )}
                  </div>
                  {req.parent_message && (
                    <p className="text-xs text-gray-500 mt-2 italic">"{req.parent_message}"</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2">
                    Submitted {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Status actions */}
                <div className="flex flex-col gap-1 ml-3">
                  {req.status === 'new' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(req.id, 'contacted')}
                        className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                      >
                        Mark Contacted
                      </button>
                      <button
                        onClick={() => handleStatusChange(req.id, 'declined')}
                        className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {req.status === 'contacted' && (
                    <button
                      onClick={() => handleStatusChange(req.id, 'signed_up')}
                      className="px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200"
                    >
                      Mark Signed Up
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PENDING CLAIMS TAB
// ═══════════════════════════════════════════════════════════════

function PendingClaimsTab({ onUpdate }: { onUpdate: () => void }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPendingClaims();
      setClaims(data.claims || []);
    } catch (err: any) {
      console.error('[KG-DB] Claims load error:', err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (code: string) => {
    setProcessingCode(code);
    try {
      const result = await approveClaim(code, notesMap[code] || undefined);
      toast.success(result.message);
      load();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingCode(null);
    }
  };

  const handleReject = async (code: string) => {
    setProcessingCode(code);
    try {
      const result = await rejectClaim(code, notesMap[code] || undefined);
      toast.success(result.message);
      load();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingCode(null);
    }
  };

  const pendingClaims = claims.filter(c => c.status === 'pending');
  const processedClaims = claims.filter(c => c.status !== 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Pending Claims
          {pendingClaims.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-medium">
              {pendingClaims.length} pending
            </span>
          )}
        </h3>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {claims.length === 0 && !isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No claims submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pending claims first */}
          {pendingClaims.map(claim => (
            <div key={claim.claim_code} className="bg-white rounded-xl border-2 border-amber-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-gray-700" />
                    <h4 className="text-sm font-semibold text-gray-900">{claim.kg_name || claim.kindergarten_name}</h4>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-medium">Pending</span>
                    {claim.type === 'new_registration' && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">New KG</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[claim.kg_city, claim.kg_state].filter(Boolean).join(', ') || 'No location'}
                  </p>
                </div>
                <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600">{claim.claim_code}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <span className="text-gray-400">Claimant</span>
                  <p className="font-medium text-gray-800">{claim.claimant_name}</p>
                </div>
                <div>
                  <span className="text-gray-400">Email</span>
                  <p className="font-medium text-gray-800">{claim.email || claim.claimant_email}</p>
                </div>
                {(claim.whatsapp || claim.claimant_whatsapp) && (
                  <div>
                    <span className="text-gray-400">WhatsApp</span>
                    <p className="font-medium text-gray-800 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-green-600" />
                      {claim.whatsapp || claim.claimant_whatsapp}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Submitted</span>
                  <p className="font-medium text-gray-800">{new Date(claim.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Admin notes */}
              <input
                type="text"
                placeholder="Admin notes (optional)..."
                value={notesMap[claim.claim_code] || ''}
                onChange={e => setNotesMap(prev => ({ ...prev, [claim.claim_code]: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg mb-3 focus:outline-none focus:border-gray-400"
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(claim.claim_code)}
                  disabled={processingCode === claim.claim_code}
                  className="flex-1 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {processingCode === claim.claim_code ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <><CheckCircle2 className="w-3 h-3" /> Approve</>
                  )}
                </button>
                <button
                  onClick={() => handleReject(claim.claim_code)}
                  disabled={processingCode === claim.claim_code}
                  className="flex-1 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
              </div>
            </div>
          ))}

          {/* Processed claims */}
          {processedClaims.length > 0 && (
            <>
              <h4 className="text-xs font-medium text-gray-500 mt-4">History</h4>
              {processedClaims.map(claim => (
                <div key={claim.claim_code} className="bg-white rounded-xl border border-gray-200 p-3 opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-800">{claim.kg_name}</span>
                      <StatusBadge status={claim.status} />
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {claim.claimant_name} ({claim.email})
                    {claim.admin_notes && <span className="ml-2 italic">— {claim.admin_notes}</span>}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAP TAB
// ═══════════════════════════════════════════════════════════════

function MapTab() {
  return (
    <div className="space-y-3">
      {/* Territory map — fetches its own data from /kg-map-nodes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 600 }}>
        <KGTerritoryMap mode="dashboard" className="h-full" />
      </div>
    </div>
  );
}
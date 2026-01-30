// API helper functions for Foxy Adventure
import { projectId, publicAnonKey } from './supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

function getAuthHeader() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    console.warn('No access token found in localStorage');
    return `Bearer ${publicAnonKey}`;
  }
  // Log first 20 chars of token for debugging (not the full token for security)
  console.log('Using access token:', token.substring(0, 20) + '...');
  return `Bearer ${token}`;
}

// Question Bank API
export async function loadQuestions() {
  const response = await fetch(`${API_BASE}/questions`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load questions');
  }

  const data = await response.json();
  return data.questions || [];
}

export async function saveQuestions(questions: any[]) {
  const response = await fetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questions }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save questions');
  }

  const data = await response.json();
  return data.questions || [];
}

export async function deleteQuestion(questionId: string) {
  const response = await fetch(`${API_BASE}/questions/${questionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete question');
  }

  return true;
}

// Leads API
export async function submitLead(leadData: {
  schoolId: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  childAge: number;
  includeMandarin: boolean;
}) {
  const response = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`, // Public endpoint
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit lead');
  }

  const data = await response.json();
  return data;
}

export async function loadLeads() {
  const response = await fetch(`${API_BASE}/leads`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Load leads error:', {
      status: response.status,
      statusText: response.statusText,
      error: error
    });
    throw new Error(error.error || `Failed to load leads (${response.status})`);
  }

  const data = await response.json();
  console.log('Leads loaded successfully:', data);
  
  // Transform database format to frontend format
  const transformedLeads = (data.leads || []).map((lead: any) => ({
    id: lead.id,
    childName: lead.child_name,
    parentName: lead.parent_name,
    whatsapp: lead.whatsapp,
    score: 0, // TODO: Add score field to database
    totalQuestions: 0, // TODO: Add total_questions field to database
    completedAt: new Date(lead.created_at).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }));
  
  return transformedLeads;
}

export async function deleteLead(leadId: string) {
  const response = await fetch(`${API_BASE}/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete lead');
  }

  return true;
}
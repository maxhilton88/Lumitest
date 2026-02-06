// Authentication utilities for Foxy Adventure
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Create Supabase client with service role (for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client with anon key (for user token validation)
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Verify JWT token and get user
export async function verifyToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', user: null };
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  
  // Use the anon key client to verify user tokens
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  
  if (error || !user) {
    console.error('Token verification failed:', error);
    return { error: 'Invalid token', user: null };
  }
  
  return { error: null, user };
}

// Get school for authenticated user
export async function getSchoolForUser(userId: string) {
  try {
    const data = await kv.get(`school:${userId}`);
    
    if (!data) {
      return { error: 'No school found for this user', school: null };
    }
    
    return { error: null, school: data };
  } catch (error) {
    return { error: error.message, school: null };
  }
}
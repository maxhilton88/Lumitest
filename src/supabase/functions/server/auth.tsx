// Authentication utilities for Foxy Adventure
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('CUSTOM_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('CUSTOM_ANON_KEY')!;

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
  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    return { error: error.message, school: null };
  }
  
  return { error: null, school: data };
}
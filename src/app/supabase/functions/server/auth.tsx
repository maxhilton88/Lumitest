// Authentication utilities for Foxy Adventure
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Create Supabase client with service role (for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Verify JWT token and get user
// Creates a FRESH client per request to avoid stale GoTrue state
// Reads the user token from X-User-Token header (since Authorization is used by the Edge Function gateway)
export async function verifyToken(userTokenHeader: string | null) {
  if (!userTokenHeader || !userTokenHeader.startsWith('Bearer ')) {
    console.log('verifyToken: Missing or invalid X-User-Token header');
    return { error: 'Missing or invalid user token header', user: null };
  }

  const token = userTokenHeader.substring(7); // Remove 'Bearer '
  
  // Skip if token is the anon key (not a user token)
  if (token === supabaseAnonKey) {
    console.log('verifyToken: Received anon key instead of user token');
    return { error: 'Anon key is not a valid user token', user: null };
  }

  try {
    // Use admin client to verify the token directly — no need for a per-request client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('verifyToken: Token verification failed:', error?.message || 'No user returned');
      return { error: `Token verification failed: ${error?.message || 'No user'}`, user: null };
    }
    
    console.log('verifyToken: Success for user:', user.id);
    return { error: null, user };
  } catch (err) {
    console.error('verifyToken: Unexpected error:', err);
    return { error: `Token verification error: ${err.message}`, user: null };
  }
}

// Get school for authenticated user
export async function getSchoolForUser(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('school_accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();
    
    if (error || !data) {
      console.log('getSchoolForUser: No school found for user:', userId);
      return { error: 'No school found for this user', school: null };
    }
    
    return { error: null, school: data };
  } catch (error) {
    console.error('getSchoolForUser: Error:', error);
    return { error: error.message, school: null };
  }
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate that environment variables are set and valid
const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch {
        return false;
    }
};

const hasValidCredentials =
    supabaseUrl &&
    supabaseAnonKey &&
    isValidUrl(supabaseUrl) &&
    !supabaseUrl.includes('your_supabase') && // Check for placeholder
    !supabaseAnonKey.includes('your_supabase');

// Only create client if credentials are valid, otherwise create a dummy
export const supabase = hasValidCredentials
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Export validation status for components to check
export const isSupabaseConfigured = hasValidCredentials;

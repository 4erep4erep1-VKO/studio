import { supabase, supabaseAdmin } from './supabase'

export async function signUp(email: string, password: string, name: string, role: 'admin' | 'installer' = 'installer') {
  console.log('🔍 signUp called with:', { email, name, role });

  const signUpData = {
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
    },
  };

  console.log('📤 Sending to Supabase:', JSON.stringify(signUpData, null, 2));

  const { data, error } = await supabase.auth.signUp(signUpData);

  if (error) {
    console.error('❌ Supabase signUp error:', error);
    throw error;
  }

  console.log('✅ Supabase signUp success:', data);
  console.log('👤 User metadata:', data.user?.user_metadata);

  return data;
}

export async function createUserWithAdmin(email: string, password: string, name: string, role: 'admin' | 'installer' = 'installer') {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }

  console.log('🔍 createUserWithAdmin called with:', { email, name, role });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      name,
      role,
    },
    email_confirm: true, // Автоматически подтверждаем email
  });

  if (error) {
    console.error('❌ Admin createUser error:', error);
    throw error;
  }

  console.log('✅ Admin createUser success:', data);

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function updateUserRole(role: 'admin' | 'installer') {
  const { data, error } = await supabase.auth.updateUser({
    data: { role },
  })

  if (error) throw error
  return data
}

export function subscribeToAuthChanges(callback: (user: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })

  return subscription
}

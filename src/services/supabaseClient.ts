import { createClient } from '@supabase/supabase-js'

// Auto-inicializa a partir das variáveis de ambiente do Vite
// Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

/** Retorna o cliente Supabase inicializado */
export function getSupabaseClient() {
  return supabase
}

/** Compatibilidade com código legado — no SaaS a init é automática */
export function initSupabase(_url: string, _anonKey: string) {
  return supabase
}

/** Testa a conexão com o Supabase (mantido para compatibilidade interna) */
export async function testConnection(
  _url: string,
  _anonKey: string
): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Supabase não configurado.' }
  const { error } = await supabase.from('profiles').select('id').limit(1)
  if (error && !error.message.includes('does not exist')) {
    return { success: false, message: error.message }
  }
  return { success: true, message: 'Conectado!' }
}

/**
 * Script SQL do schema multi-tenant.
 * Execute no SQL Editor do Supabase para criar as tabelas.
 */
export const INITIAL_SQL_SCHEMA = `-- ============================================================
-- AfiliaX SaaS — Schema Multi-Tenant (Corrigido para tabelas existentes)
-- Execute no SQL Editor do seu Supabase
-- ============================================================

-- 1. Garante a criação das tabelas
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  instance_name TEXT UNIQUE,
  instance_status TEXT DEFAULT 'disconnected',
  whatsapp_number TEXT,
  ai_provider TEXT DEFAULT 'gemini',
  ai_api_key TEXT,
  ai_model TEXT DEFAULT 'gemini-1.5-flash',
  ollama_url TEXT,
  telegram_bot_token TEXT,
  max_group_members INTEGER DEFAULT 1000,
  send_interval_minutes INTEGER DEFAULT 20,
  role TEXT DEFAULT 'user',
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  price_from NUMERIC,
  price_to NUMERIC,
  discount_pct INTEGER,
  coupon TEXT,
  image_url TEXT,
  affiliate_link TEXT,
  copy_text TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  channels JSONB,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  group_id TEXT,
  group_name TEXT,
  member_count INTEGER DEFAULT 0,
  invite_link TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adiciona a coluna user_id nas tabelas existentes e campos admin em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.groups_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 3. Ativa RLS em todas as tabelas (segurança multi-tenant)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups_history ENABLE ROW LEVEL SECURITY;

-- 4. Remove políticas antigas antes de recriar
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
DROP POLICY IF EXISTS "offers_own" ON public.offers;
DROP POLICY IF EXISTS "schedules_own" ON public.schedules;
DROP POLICY IF EXISTS "groups_own" ON public.groups_history;

-- 5. Cria políticas de isolamento por usuário
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "offers_own" ON public.offers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedules_own" ON public.schedules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "groups_own" ON public.groups_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Trigger para criar perfil automaticamente no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, instance_name)
  VALUES (
    NEW.id,
    NEW.email,
    'usr_' || REPLACE(CAST(NEW.id AS TEXT), '-', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`

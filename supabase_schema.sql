-- ================================================================
-- AfiliaX SaaS — Esquema de Banco de Dados Supabase (PostgreSQL)
-- ================================================================

-- 1. Profiles (Perfil do usuário integrado com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  instance_name TEXT,
  instance_status TEXT DEFAULT 'disconnected',
  whatsapp_number TEXT,
  whatsapp_connected BOOLEAN DEFAULT false,
  telegram_connected BOOLEAN DEFAULT false,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  ai_provider TEXT DEFAULT 'google',
  ai_api_key TEXT,
  ai_model TEXT DEFAULT 'gemini-1.5-flash',
  ollama_url TEXT,
  shopee_app_key TEXT,
  shopee_app_secret TEXT,
  max_group_members INT DEFAULT 0,
  send_interval_minutes INT DEFAULT 15,
  role TEXT DEFAULT 'user',
  plan_tier TEXT DEFAULT 'free',
  is_blocked BOOLEAN DEFAULT false,
  daily_posts_limit INT DEFAULT 5,
  daily_posts_count INT DEFAULT 0,
  last_post_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Offers (Ofertas e promoções capturadas)
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT NOT NULL,
  price_from NUMERIC(12,2),
  price_to NUMERIC(12,2),
  discount_pct NUMERIC(5,2),
  coupon TEXT,
  image_url TEXT,
  affiliate_link TEXT NOT NULL,
  copy_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Schedules (Agendamento de disparos)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  channels JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Scheduled Posts (Postagens agendadas - compatibilidade backend)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  copy_text TEXT,
  image_url TEXT,
  affiliate_link TEXT,
  channels JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Post Logs (Logs de execução de disparos)
CREATE TABLE IF NOT EXISTS public.post_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  channel TEXT,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Short Links (Links curtos rastreáveis)
CREATE TABLE IF NOT EXISTS public.short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  channel_type TEXT,
  clicks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Click Analytics (Métricas de clique por canal/origem)
CREATE TABLE IF NOT EXISTS public.click_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID REFERENCES public.short_links(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_type TEXT,
  user_agent TEXT,
  ip_address TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Affiliate Links (Links de afiliados convertidos)
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  store TEXT,
  original_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. System Config (Configurações globais do sistema)
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. User Settings (Configurações personalizadas por usuário)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Triggers Automatizados
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    role, 
    plan_tier, 
    daily_posts_limit
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email = 'hevertonsalvador.cg@gmail.com' THEN 'admin' ELSE 'user' END,
    CASE WHEN NEW.email = 'hevertonsalvador.cg@gmail.com' THEN 'agency' ELSE 'free' END,
    CASE WHEN NEW.email = 'hevertonsalvador.cg@gmail.com' THEN 99999 ELSE 5 END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN EXCLUDED.email = 'hevertonsalvador.cg@gmail.com' THEN 'admin' ELSE public.profiles.role END,
    plan_tier = CASE WHEN EXCLUDED.email = 'hevertonsalvador.cg@gmail.com' THEN 'agency' ELSE public.profiles.plan_tier END,
    daily_posts_limit = CASE WHEN EXCLUDED.email = 'hevertonsalvador.cg@gmail.com' THEN 99999 ELSE public.profiles.daily_posts_limit END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- Habilitar Row Level Security (RLS) & Políticas de Acesso
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can manage own offers" ON public.offers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own schedules" ON public.schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own scheduled_posts" ON public.scheduled_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own post logs" ON public.post_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage short_links" ON public.short_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read for short_links redirection" ON public.short_links FOR SELECT USING (true);
CREATE POLICY "Public insert for click_analytics" ON public.click_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own click_analytics" ON public.click_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage affiliate_links" ON public.affiliate_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Auth users read system_config" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Users manage user_settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

export interface AdminUser {
  id: string
  email: string
  instance_name?: string
  instance_status?: string
  whatsapp_number?: string
  role: 'admin' | 'user'
  plan_tier: 'free' | 'pro' | 'agency'
  daily_posts_limit: number
  is_blocked: boolean
  created_at: string
}

interface UserTableProps {
  users: AdminUser[]
  loading: boolean
  onToggleBlock: (userId: string, currentBlocked: boolean) => void
  onChangePlan: (userId: string, planTier: 'free' | 'pro' | 'agency') => void
  onChangeRole: (userId: string, role: 'admin' | 'user') => void
}

export default function UserTable({
  users,
  loading,
  onToggleBlock,
  onChangePlan,
  onChangeRole,
}: UserTableProps) {
  if (loading) {
    return <div className="text-center py-8 text-slate-500 text-sm">Carregando usuários do SaaS...</div>
  }

  if (users.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">Nenhum usuário cadastrado.</div>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-700/60">
          <tr>
            <th className="px-4 py-3">Usuário</th>
            <th className="px-4 py-3">Status Instância</th>
            <th className="px-4 py-3">Plano SaaS</th>
            <th className="px-4 py-3">Papel</th>
            <th className="px-4 py-3">Status Conta</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-800/30 transition-all">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-100">{user.email}</div>
                <div className="text-[10px] text-slate-500 font-mono">{user.id.slice(0, 18)}...</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${
                    user.instance_status === 'connected'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {user.instance_status === 'connected' ? '● Conectado' : 'Desconectado'}
                </span>
              </td>
              <td className="px-4 py-3">
                <select
                  value={user.plan_tier}
                  onChange={(e) => onChangePlan(user.id, e.target.value as 'free' | 'pro' | 'agency')}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="free">FREE (5 envios/dia)</option>
                  <option value="pro">PRO (100 envios/dia)</option>
                  <option value="agency">AGENCY (Ilimitado)</option>
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  onChange={(e) => onChangeRole(user.id, e.target.value as 'admin' | 'user')}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${
                    user.is_blocked
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {user.is_blocked ? 'Bloqueado' : 'Ativo'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onToggleBlock(user.id, user.is_blocked)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    user.is_blocked
                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {user.is_blocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

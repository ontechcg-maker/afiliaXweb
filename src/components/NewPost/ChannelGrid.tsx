import React from 'react'
import { MessageSquare, Send, Users } from 'lucide-react'
import type { WhatsAppGroup } from '../../services/whatsappService'
import type { DiscordChannel } from '../../services/discordService'

interface ChannelGridProps {
  availableGroups: WhatsAppGroup[]
  loadingGroups: boolean
  selectedTarget: 'all' | 'custom'
  setSelectedTarget: (target: 'all' | 'custom') => void
  selectedGroupIds: string[]
  setSelectedGroupIds: React.Dispatch<React.SetStateAction<string[]>>
  sendToTelegram: boolean
  setSendToTelegram: (val: boolean) => void
  telegramConnected: boolean
  availableDiscordChannels: DiscordChannel[]
  selectedDiscordIds: string[]
  setSelectedDiscordIds: React.Dispatch<React.SetStateAction<string[]>>
}

export default function ChannelGrid({
  availableGroups,
  loadingGroups,
  selectedTarget,
  setSelectedTarget,
  selectedGroupIds,
  setSelectedGroupIds,
  sendToTelegram,
  setSendToTelegram,
  telegramConnected,
  availableDiscordChannels,
  selectedDiscordIds,
  setSelectedDiscordIds,
}: ChannelGridProps) {
  const toggleGroupSelect = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleDiscordSelect = (id: string) => {
    setSelectedDiscordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-4">
      {/* WhatsApp */}
      <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp (Grupos)</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setSelectedTarget('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedTarget === 'all'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({availableGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTarget('custom')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedTarget === 'custom'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Selecionar
            </button>
          </div>
        </div>

        {selectedTarget === 'custom' && (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {loadingGroups ? (
              <div className="text-xs text-slate-500 py-2 text-center">Carregando grupos...</div>
            ) : availableGroups.length === 0 ? (
              <div className="text-xs text-slate-500 py-2 text-center">
                Nenhum grupo encontrado na instância.
              </div>
            ) : (
              availableGroups.map((group) => {
                const isChecked = selectedGroupIds.includes(group.id)
                return (
                  <label
                    key={group.id}
                    onClick={() => toggleGroupSelect(group.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-800/30 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{group.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {group.memberCount} membros
                    </span>
                  </label>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Telegram & Discord */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Telegram */}
        <label
          className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
            sendToTelegram
              ? 'bg-sky-950/40 border-sky-500/50 text-sky-200'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Telegram</div>
              <div className="text-[10px] text-slate-500">
                {telegramConnected ? 'Canal / Bot configurado' : 'Configurar Bot nas Configurações'}
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={sendToTelegram}
            onChange={(e) => setSendToTelegram(e.target.checked)}
            className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
          />
        </label>

        {/* Discord */}
        <div className="bg-slate-900/60 rounded-2xl p-3.5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
            <span>Discord Webhook</span>
            <span className="text-[10px] text-slate-500">{availableDiscordChannels.length} canais</span>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {availableDiscordChannels.length === 0 ? (
              <div className="text-[10px] text-slate-500 py-1">Nenhum webhook cadastrado.</div>
            ) : (
              availableDiscordChannels.map((ch) => {
                const isSelected = selectedDiscordIds.includes(ch.id)
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleDiscordSelect(ch.id)}
                    className={`w-full text-left p-1.5 rounded-lg border text-[11px] truncate transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-800/20 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    # {ch.name}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import type { CopyTone } from '../../services/aiService'

export const TONE_OPTIONS: { id: CopyTone; label: string; emoji: string }[] = [
  { id: 'urgent', label: 'Urgente 🔥', emoji: '⚡' },
  { id: 'casual', label: 'Casual / Achadinho 😄', emoji: '😄' },
  { id: 'review', label: 'Review ⭐', emoji: '⭐' },
  { id: 'short', label: 'Curto 💨', emoji: '💨' },
  { id: 'aggressive', label: 'Agressivo (PAS) 😈', emoji: '😈' },
  { id: 'funny', label: 'Engraçado 🤣', emoji: '🤣' },
]

interface ToneSelectorProps {
  selectedTone: CopyTone
  onSelectTone: (tone: CopyTone) => void
  disabled?: boolean
}

export default function ToneSelector({ selectedTone, onSelectTone, disabled }: ToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {TONE_OPTIONS.map((item) => {
        const isSelected = selectedTone === item.id
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectTone(item.id)}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all ${
              isSelected
                ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            <span>{item.emoji}</span>
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

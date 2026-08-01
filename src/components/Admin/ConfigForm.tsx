import React from 'react'

export interface AdminConfigState {
  evolutionBaseUrl: string
  evolutionApiKey: string
  openrouterApiKey: string
  geminiApiKey: string
  openaiApiKey: string
  aiProvider: string
  aiModel: string
  customModel: string
}

interface ConfigFormProps {
  config: AdminConfigState
  setConfig: React.Dispatch<React.SetStateAction<AdminConfigState>>
  onSave: () => void
  saving: boolean
  testingEvolution: boolean
  onTestEvolution: () => void
}

export default function ConfigForm({
  config,
  setConfig,
  onSave,
  saving,
  testingEvolution,
  onTestEvolution,
}: ConfigFormProps) {
  return (
    <div className="space-y-6">
      {/* Evolution API */}
      <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          📱 Configuração Global da Evolution API (WhatsApp)
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              URL Base da Evolution API
            </label>
            <input
              type="text"
              value={config.evolutionBaseUrl}
              onChange={(e) => setConfig({ ...config, evolutionBaseUrl: e.target.value })}
              placeholder="https://api.ontechcg.cloud"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              API Key Master da Evolution API
            </label>
            <input
              type="password"
              value={config.evolutionApiKey}
              onChange={(e) => setConfig({ ...config, evolutionApiKey: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onTestEvolution}
              disabled={testingEvolution}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all"
            >
              {testingEvolution ? 'Testando Conexão...' : '⚡ Testar Conexão Evolution'}
            </button>
          </div>
        </div>
      </div>

      {/* Inteligência Artificial */}
      <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          🧠 Provedores & Chaves de Inteligência Artificial
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={config.geminiApiKey}
              onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={config.openrouterApiKey}
              onChange={(e) => setConfig({ ...config, openrouterApiKey: e.target.value })}
              placeholder="sk-or-v1-..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={config.openaiApiKey}
              onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Modelo Padrão da IA
            </label>
            <input
              type="text"
              value={config.aiModel}
              onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
              placeholder="gemini-2.0-flash"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/25"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações Globais'}
        </button>
      </div>
    </div>
  )
}

import { getSystemConfig } from './systemConfigService.js'

export async function evolutionFetch(path, method = 'GET', body = null, timeoutMs = 30000) {
  const { baseUrl, apiKey } = await getSystemConfig()

  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API não configurada no servidor. Acesse o Painel Admin para configurar URL e API Key.')
  }
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    signal: AbortSignal.timeout(timeoutMs),
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${baseUrl}${path}`, opts)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { rawText: text }
  }

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || data?.response?.message || (typeof data === 'string' ? data : `HTTP ${res.status}`)
    const fullMsg = Array.isArray(errorMsg) ? errorMsg.join(', ') : String(errorMsg)
    throw new Error(`Evolution API: ${fullMsg}`)
  }

  if (data && typeof data === 'object' && data.error && data.message) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message
    throw new Error(`Evolution API: ${msg}`)
  }

  return data
}

export async function resolveTargetGroups(instanceName, groupId) {
  if (groupId === 'all' || !groupId) {
    const groupData = await evolutionFetch(
      `/group/fetchAllGroups/${instanceName}?getParticipants=false`
    ).catch(() => null)
    const list = Array.isArray(groupData) ? groupData
      : groupData?.groups || groupData?.response || groupData?.data || []
    const ids = list
      .map((g) => g.id || g.jid || g.groupJid || '')
      .filter((id) => id.includes('@g.us'))
    return Array.from(new Set(ids))
  }
  const target = groupId.includes('@') ? groupId : `${groupId}@g.us`
  return [target]
}

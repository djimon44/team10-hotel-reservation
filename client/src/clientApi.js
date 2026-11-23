import { useEffect, useState } from 'react'

export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.error || 'The hotel service could not complete your request.')
    error.status = response.status
    error.details = data?.details
    throw error
  }
  if (data === null) throw new Error('The hotel service returned an unreadable response.')
  return data
}

export function useApiData(path) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    request(path, { signal: controller.signal }).then(
      (data) => setResult({ path, revision, data }),
      (error) => {
        if (!controller.signal.aborted) setResult({ path, revision, error })
      },
    )
    return () => controller.abort()
  }, [path, revision])

  const current = result?.path === path && result.revision === revision ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(path && !current),
    reload: () => setRevision((value) => value + 1),
  }
}

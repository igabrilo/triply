import { useState, useEffect } from 'react'
import { apiClient } from '@services/api'
import { AxiosError } from 'axios'

interface UseApiOptions {
  immediate?: boolean
}

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApi<T>(
  endpoint: string,
  options: UseApiOptions = { immediate: true }
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(options.immediate || false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<T>(endpoint)
      setData(response.data)
    } catch (err) {
      const error = err as AxiosError
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (options.immediate) {
      fetchData()
    }
  }, [endpoint])

  return { data, loading, error, refetch: fetchData }
}

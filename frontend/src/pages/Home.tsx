import { useState, useEffect } from 'react'
import { apiClient } from '@services/api'

function Home() {
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/')
        setMessage(response.data.message)
      } catch (error) {
        console.error('Error fetching data:', error)
        setMessage('Failed to connect to backend')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="home">
      <h1>Welcome to Triply</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <p>Backend says: {message}</p>
      )}
    </div>
  )
}

export default Home

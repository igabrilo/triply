// Common types for the application

export interface User {
  id: string
  email: string
  name: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface ApiError {
  message: string
  status: number
}

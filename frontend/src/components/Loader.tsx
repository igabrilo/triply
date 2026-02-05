import React from 'react'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const Loader: React.FC<LoaderProps> = ({ size = 'md', text }) => {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-16 h-16 border-4',
  }
  
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`${sizes[size]} border-blue-600 border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && <p className="text-gray-600 text-sm">{text}</p>}
    </div>
  )
}

export default Loader

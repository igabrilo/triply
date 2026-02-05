# Triply Frontend

React + TypeScript frontend application built with Vite.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── services/       # API services and external integrations
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── assets/         # Static assets (images, fonts, etc.)
├── styles/         # Global styles and CSS modules
├── App.tsx         # Main App component
└── main.tsx        # Application entry point
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_API_URL` - Backend API URL

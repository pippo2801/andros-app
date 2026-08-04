import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: '20px', background: '#111', color: '#0f0', height: '100vh', fontFamily: 'monospace' }}>
      <h1>Andros OS Attivo!</h1>
      <p>Interfaccia caricata correttamente via Vite.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

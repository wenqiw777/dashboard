import { useState, useEffect } from 'react'
import { LayoutDashboard, BookOpen } from 'lucide-react'
import LearnApp from './LearnApp'
import TrackerApp from './TrackerApp'
import './learn.css'
import './app-shell.css'

type Page = 'tracker' | 'learn'

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem('app.page')
    return saved === 'learn' || saved === 'tracker' ? saved : 'tracker'
  })

  useEffect(() => {
    localStorage.setItem('app.page', page)
  }, [page])

  return (
    <div className="shell">
      <nav className="shell-rail" aria-label="App sections">
        <button
          className={`shell-rail-btn ${page === 'tracker' ? 'active' : ''}`}
          onClick={() => setPage('tracker')}
          title="Work Tracker"
        >
          <LayoutDashboard size={20} strokeWidth={1.8} />
          <span className="shell-rail-label">Tracker</span>
        </button>
        <button
          className={`shell-rail-btn ${page === 'learn' ? 'active' : ''}`}
          onClick={() => setPage('learn')}
          title="Learn"
        >
          <BookOpen size={20} strokeWidth={1.8} />
          <span className="shell-rail-label">Learn</span>
        </button>
      </nav>
      <main className="shell-main">
        <div className="shell-page" hidden={page !== 'tracker'}>
          <TrackerApp />
        </div>
        <div className="shell-page" hidden={page !== 'learn'}>
          <LearnApp />
        </div>
      </main>
    </div>
  )
}

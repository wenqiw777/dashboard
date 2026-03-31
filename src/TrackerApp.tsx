import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Settings, RefreshCw, ExternalLink,
  Activity, GitBranch, GitPullRequest, Clock, X, AlertCircle, ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import './tracker.css'

// Types
interface Repo {
  id: string
  url: string
  owner: string
  repo: string
  addedAt: string
}

interface Config {
  githubUsername: string
  hasToken: boolean
}

interface Commit {
  sha: string
  message: string
  author: string
  date: string
  url: string
  branch: string
}

interface RepoActivity {
  repo: string
  repoUrl: string
  branches: string[]
  commits: Commit[]
}

interface PR {
  number: number
  title: string
  state: string
  merged: boolean
  author: string
  branch: string
  baseBranch: string
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  closedAt: string | null
  url: string
}

interface RepoPRs {
  repo: string
  repoUrl: string
  prs: PR[]
}

type DateRange = 'today' | 'week' | 'month'
type ViewTab = 'commits' | 'prs'

// Helpers
function getDateRange(range: DateRange) {
  const now = new Date()
  let since: Date
  switch (range) {
    case 'today':
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      since = new Date(now)
      since.setDate(since.getDate() - 7)
      break
    case 'month':
      since = new Date(now)
      since.setMonth(since.getMonth() - 1)
      break
  }
  return { since: since.toISOString(), until: now.toISOString() }
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateTime(d: string, showDate: boolean) {
  return showDate ? `${formatDate(d)} ${formatTime(d)}` : formatTime(d)
}

export default function TrackerApp() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [config, setConfig] = useState<Config>({ githubUsername: '', hasToken: false })
  const [activity, setActivity] = useState<RepoActivity[]>([])
  const [prData, setPrData] = useState<RepoPRs[]>([])
  const [fetchErrors, setFetchErrors] = useState<{ repo: string; error: string }[]>([])
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [viewTab, setViewTab] = useState<ViewTab>('commits')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ githubUsername: '', githubToken: '' })
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [reposRes, configRes] = await Promise.all([
          fetch('/api/repos'), fetch('/api/config')
        ])
        const reposData = await reposRes.json()
        const configData = await configRes.json()
        setRepos(reposData)
        setConfig(configData)
        setSettingsForm({ githubUsername: configData.githubUsername || '', githubToken: '' })
        if (!configData.githubUsername) setShowSettings(true)
        setInitialized(true)
      } catch {
        setError('Failed to connect to server. Is it running?')
      }
    })()
  }, [])

  const loadActivity = useCallback(async () => {
    if (repos.length === 0) { setActivity([]); setPrData([]); return }
    setLoading(true)
    setError(null)
    try {
      const { since, until } = getDateRange(dateRange)
      const params = new URLSearchParams({ since, until })
      if (config.githubUsername) params.set('author', config.githubUsername)

      const [actRes, prRes] = await Promise.all([
        fetch(`/api/activity?${params}`),
        fetch(`/api/prs?${params}`),
      ])

      if (!actRes.ok) throw new Error('Failed to fetch activity')
      const actData = await actRes.json()
      setActivity(actData.activity || [])

      if (prRes.ok) {
        const prDataRes = await prRes.json()
        setPrData(prDataRes.prs || [])
        setFetchErrors([...(actData.errors || []), ...(prDataRes.errors || [])])
      } else {
        setFetchErrors(actData.errors || [])
      }

      setLastUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [dateRange, config.githubUsername, repos.length])

  useEffect(() => { if (initialized) loadActivity() }, [initialized, loadActivity])

  useEffect(() => {
    if (!initialized) return
    const id = setInterval(loadActivity, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [initialized, loadActivity])

  const handleAddRepo = async () => {
    const url = repoUrl.trim()
    if (!url) return
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRepoUrl('')
      setRepos(prev => [...prev, data])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add repo')
    }
  }

  const handleDeleteRepo = async (owner: string, repo: string) => {
    await fetch(`/api/repos/${owner}/${repo}`, { method: 'DELETE' })
    setRepos(prev => prev.filter(r => r.id !== `${owner}/${repo}`))
  }

  const handleSaveConfig = async () => {
    try {
      const body: Record<string, string> = { githubUsername: settingsForm.githubUsername }
      if (settingsForm.githubToken) body.githubToken = settingsForm.githubToken
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      setConfig(prev => ({
        ...prev,
        githubUsername: settingsForm.githubUsername,
        hasToken: settingsForm.githubToken ? true : prev.hasToken
      }))
      setSettingsForm(prev => ({ ...prev, githubToken: '' }))
      setShowSettings(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const activeRepos = activity.filter(a => a.commits.length > 0)
  const totalCommits = activity.reduce((sum, a) => sum + a.commits.length, 0)
  const totalPRs = prData.reduce((sum, r) => sum + r.prs.length, 0)
  const activePRRepos = prData.filter(r => r.prs.length > 0)
  const showDate = dateRange !== 'today'

  return (
    <div className="tracker">
      {/* Header */}
      <header className="t-header">
        <div className="t-header-left">
          <Link to="/" className="t-back">
            <ArrowLeft size={16} />
          </Link>
          <Activity size={20} strokeWidth={2} />
          <h1>Work Tracker</h1>
        </div>
        <div className="t-header-right">
          {lastUpdated && (
            <span className="t-updated">Updated {formatTime(lastUpdated.toISOString())}</span>
          )}
          {config.githubUsername && (
            <span className="t-username">@{config.githubUsername}</span>
          )}
          <button
            className={`t-icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Settings */}
      {showSettings && (
        <div className="t-settings">
          <div className="t-settings-head">
            <span>Settings</span>
            <button className="t-icon-btn-sm" onClick={() => setShowSettings(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="t-settings-body">
            <div className="t-field">
              <label>GitHub Username</label>
              <input
                type="text"
                value={settingsForm.githubUsername}
                onChange={e => setSettingsForm(f => ({ ...f, githubUsername: e.target.value }))}
                placeholder="your-username"
              />
              <span className="t-hint">Filter commits to show only your activity</span>
            </div>
            <div className="t-field">
              <label>GitHub Token</label>
              <input
                type="password"
                value={settingsForm.githubToken}
                onChange={e => setSettingsForm(f => ({ ...f, githubToken: e.target.value }))}
                placeholder={config.hasToken ? 'Token set — enter to replace' : 'ghp_xxxx (for private repos)'}
              />
              <span className="t-hint">
                {config.hasToken ? 'Token configured' : 'Optional — increases rate limit to 5000/hr'}
              </span>
            </div>
            <button className="t-btn t-btn-accent" onClick={handleSaveConfig}>Save</button>
          </div>
        </div>
      )}

      {/* Add Repo */}
      <div className="t-add-bar">
        <input
          type="text"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddRepo()}
          placeholder="https://github.com/owner/repo"
        />
        <button className="t-btn t-btn-accent" onClick={handleAddRepo}>
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Controls */}
      <div className="t-controls">
        <div className="t-tabs">
          {(['today', 'week', 'month'] as DateRange[]).map(r => (
            <button
              key={r}
              className={`t-tab ${dateRange === r ? 'active' : ''}`}
              onClick={() => setDateRange(r)}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
        <button className="t-icon-btn" onClick={loadActivity} disabled={loading} title="Refresh">
          <RefreshCw size={15} className={loading ? 't-spinning' : ''} />
        </button>
      </div>

      {/* View Tabs: Commits / PRs */}
      <div className="t-view-tabs">
        <button
          className={`t-view-tab ${viewTab === 'commits' ? 'active' : ''}`}
          onClick={() => setViewTab('commits')}
        >
          <GitBranch size={14} />
          Commits
          <span className="t-view-count">{totalCommits}</span>
        </button>
        <button
          className={`t-view-tab ${viewTab === 'prs' ? 'active' : ''}`}
          onClick={() => setViewTab('prs')}
        >
          <GitPullRequest size={14} />
          Pull Requests
          <span className="t-view-count">{totalPRs}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="t-stats">
        <div className="t-stat">
          <div className="t-stat-val">{viewTab === 'commits' ? activeRepos.length : activePRRepos.length}</div>
          <div className="t-stat-label">Active Repos</div>
        </div>
        <div className="t-stat">
          <div className="t-stat-val">{viewTab === 'commits' ? totalCommits : totalPRs}</div>
          <div className="t-stat-label">{viewTab === 'commits' ? 'Commits' : 'PRs'}</div>
        </div>
        <div className="t-stat">
          <div className="t-stat-val">{repos.length}</div>
          <div className="t-stat-label">Tracked</div>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="t-error">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button className="t-dismiss" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      {fetchErrors.length > 0 && (
        <div className="t-warning">
          <AlertCircle size={14} />
          <span>Failed: {fetchErrors.map(e => e.repo).join(', ')}</span>
        </div>
      )}

      {/* Commits View */}
      {viewTab === 'commits' && (
        <div className="t-feed">
          {loading && activity.length === 0 ? (
            <div className="t-empty">
              <RefreshCw size={28} className="t-spinning" />
              <p>Loading activity...</p>
            </div>
          ) : repos.length === 0 ? (
            <div className="t-empty">
              <GitBranch size={36} strokeWidth={1.5} />
              <p>Add a GitHub repo to start tracking</p>
              <span className="t-empty-hint">Paste a repo URL above and click Add</span>
            </div>
          ) : activeRepos.length === 0 && !loading ? (
            <div className="t-empty">
              <Clock size={36} strokeWidth={1.5} />
              <p>No commits {dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : 'this month'}</p>
              <span className="t-empty-hint">Try a longer time range</span>
            </div>
          ) : (
            activeRepos
              .sort((a, b) => (b.commits[0]?.date || '').localeCompare(a.commits[0]?.date || ''))
              .map(ra => (
                <div key={ra.repo} className="t-repo">
                  <div className="t-repo-head">
                    <div className="t-repo-name">
                      <GitBranch size={15} />
                      <span>{ra.repo.split('/')[1]}</span>
                      <span className="t-owner">{ra.repo.split('/')[0]}</span>
                      <span className="t-badge">{ra.commits.length}</span>
                    </div>
                    <a href={ra.repoUrl} target="_blank" rel="noopener noreferrer" className="t-ext-link">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="t-commits">
                    {ra.commits.map(c => (
                      <div key={c.sha} className="t-commit">
                        <span className="t-time">
                          {formatDateTime(c.date, showDate)}
                        </span>
                        <span className="t-branch-tag">{c.branch}</span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="t-msg"
                          title={c.message}
                        >
                          {c.message.split('\n')[0]}
                        </a>
                        <span className="t-sha">{c.sha.slice(0, 7)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* PRs View */}
      {viewTab === 'prs' && (
        <div className="t-feed">
          {loading && prData.length === 0 ? (
            <div className="t-empty">
              <RefreshCw size={28} className="t-spinning" />
              <p>Loading PRs...</p>
            </div>
          ) : repos.length === 0 ? (
            <div className="t-empty">
              <GitPullRequest size={36} strokeWidth={1.5} />
              <p>Add a GitHub repo to start tracking</p>
              <span className="t-empty-hint">Paste a repo URL above and click Add</span>
            </div>
          ) : activePRRepos.length === 0 && !loading ? (
            <div className="t-empty">
              <GitPullRequest size={36} strokeWidth={1.5} />
              <p>No PRs {dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : 'this month'}</p>
              <span className="t-empty-hint">Try a longer time range</span>
            </div>
          ) : (
            activePRRepos
              .sort((a, b) => (b.prs[0]?.updatedAt || '').localeCompare(a.prs[0]?.updatedAt || ''))
              .map(rp => (
                <div key={rp.repo} className="t-repo">
                  <div className="t-repo-head">
                    <div className="t-repo-name">
                      <GitPullRequest size={15} />
                      <span>{rp.repo.split('/')[1]}</span>
                      <span className="t-owner">{rp.repo.split('/')[0]}</span>
                      <span className="t-badge">{rp.prs.length}</span>
                    </div>
                    <a href={rp.repoUrl} target="_blank" rel="noopener noreferrer" className="t-ext-link">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="t-pr-list">
                    {rp.prs.map(pr => (
                      <div key={pr.number} className="t-pr-item">
                        <span className={`t-pr-status ${pr.merged ? 'merged' : pr.state}`}>
                          {pr.merged ? 'Merged' : pr.state === 'open' ? 'Open' : 'Closed'}
                        </span>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="t-pr-title"
                          title={pr.title}
                        >
                          {pr.title}
                        </a>
                        <span className="t-branch-tag">{pr.branch}</span>
                        <span className="t-pr-meta">
                          #{pr.number} · {formatDateTime(pr.updatedAt, showDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Tracked Repos */}
      {repos.length > 0 && (
        <div className="t-tracked">
          <h3>Tracked Repos</h3>
          <div className="t-chips">
            {repos.map(repo => (
              <div key={repo.id} className="t-chip">
                <a href={repo.url} target="_blank" rel="noopener noreferrer">{repo.id}</a>
                <button className="t-chip-x" onClick={() => handleDeleteRepo(repo.owner, repo.repo)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

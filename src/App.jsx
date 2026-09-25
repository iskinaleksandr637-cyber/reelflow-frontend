import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function App() {
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [userName, setUserName] = useState('Гость')
  const [userPhoto, setUserPhoto] = useState(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    let id = null
    let name = 'Гость'
    let photo = null

    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user
      id = String(u.id)
      name = u.first_name || 'Друг'
      photo = u.photo_url || null
      tg.ready()
      tg.expand()
    } else {
      id = new URLSearchParams(window.location.search).get('userId')
    }

    setUserId(id)
    setUserName(name)
    setUserPhoto(photo)
    if (id) loadReels(id)
    else setLoading(false)
  }, [])

  const loadReels = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/reels/${id}`)
      const data = await res.json()
      setReels(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Ошибка загрузки:', e)
    } finally {
      setLoading(false)
    }
  }

  const openReel = (url) => {
    const tg = window.Telegram?.WebApp
    if (tg) tg.openLink(url)
    else window.open(url, '_blank')
  }

  const deleteReel = async (reelId) => {
    const tg = window.Telegram?.WebApp
    const ok = tg?.showConfirm
      ? await new Promise((r) => tg.showConfirm('Удалить рилс из коллекции?', r))
      : window.confirm('Удалить рилс из коллекции?')
    if (!ok) return

    try {
      await fetch(`${API_URL}/api/reels/${userId}/${reelId}`, { method: 'DELETE' })
      setReels(reels.filter((r) => r.reel_id !== reelId))
    } catch (e) {
      console.error('Ошибка удаления:', e)
    }
  }

  const formatDate = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    if (h < 1) return 'только что'
    if (h < 24) return `${h} ч назад`
    return new Date(iso).toLocaleDateString('ru-RU')
  }

  return (
    <div className="app">
      {/* Шапка */}
      <header className="topbar">
        <div className="topbar-left">
          {userPhoto ? (
            <img src={userPhoto} className="avatar-img" alt="" />
          ) : (
            <div className="avatar-sm">{userName[0]}</div>
          )}
          <div>
            <h1>ReelFlow</h1>
            <span className="subtitle">{reels.length} рилсов в коллекции</span>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="feed">
        {loading && <div className="loader">Загрузка...</div>}

        {!loading && reels.length === 0 && (
          <div className="empty">
            <div className="empty-icon">🎬</div>
            <h2>Пока пусто</h2>
            <p>Перешли ссылку на рилс боту в Telegram — и он появится здесь</p>
          </div>
        )}

        {!loading &&
          reels.map((reel) => (
            <article className="card" key={reel.id}>
              {/* Шапка карточки */}
              <div className="card-header">
                <div className="avatar-sm">{(reel.username || 'U')[0].toUpperCase()}</div>
                <div className="card-header-text">
                  <strong>Ты сохранил это</strong>
                  <span>{formatDate(reel.saved_at)}</span>
                </div>
                <span className={`badge ${reel.platform}`}>
                  {reel.platform === 'instagram' ? 'IG' : 'TT'}
                </span>
              </div>

              {/* Превью видео */}
              <div className="video-box" onClick={() => openReel(reel.url)}>
                <div className="play-btn">▶</div>
                <span className="video-hint">
                  Открыть в {reel.platform === 'instagram' ? 'Instagram' : 'TikTok'}
                </span>
                <span className="video-emoji">
                  {reel.platform === 'instagram' ? '📸' : '🎵'}
                </span>
              </div>

              {/* Кнопки */}
              <div className="card-actions">
                <button className="btn btn-open" onClick={() => openReel(reel.url)}>
                  Открыть ↗
                </button>
                <button className="btn btn-del" onClick={() => deleteReel(reel.reel_id)}>
                  🗑
                </button>
              </div>
            </article>
          ))}
      </main>

      {/* Подсказка внизу */}
      <div className="hint-pill">📥 Кидай рилсы боту — они появятся здесь</div>
    </div>
  )
}

export default App

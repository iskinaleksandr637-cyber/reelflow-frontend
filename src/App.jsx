import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const BOT_USERNAME = 'reelflow_save_bot'

// Аватарка: фото или буква
function Avatar({ photo, name, size = 38 }) {
  if (photo) {
    return <img src={photo} className="avatar-img" style={{ width: size, height: size }} alt="" />
  }
  return (
    <div className="avatar-sm" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

// Карточка рилса
function ReelCard({ reel, curator, onDelete, onCuratorClick }) {
  const tg = window.Telegram?.WebApp

  const openReel = () => {
    if (tg) tg.openLink(reel.url)
    else window.open(reel.url, '_blank')
  }

  const formatDate = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    if (h < 1) return 'только что'
    if (h < 24) return `${h} ч назад`
    return new Date(iso).toLocaleDateString('ru-RU')
  }

  return (
    <article className="card">
      <div className="card-header">
        {curator ? (
          <>
            <div onClick={() => onCuratorClick && onCuratorClick(curator.user_id)} style={{ cursor: 'pointer' }}>
              <Avatar photo={curator.photo_url} name={curator.first_name} size={34} />
            </div>
            <div className="card-header-text">
              <strong onClick={() => onCuratorClick && onCuratorClick(curator.user_id)} style={{ cursor: 'pointer' }}>
                {curator.first_name || 'Куратор'} сохранил(а) это
              </strong>
              <span>{formatDate(reel.saved_at)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="avatar-sm">📌</div>
            <div className="card-header-text">
              <strong>Ты сохранил(а) это</strong>
              <span>{formatDate(reel.saved_at)}</span>
            </div>
          </>
        )}
        <span className={`badge ${reel.platform}`}>
          {reel.platform === 'instagram' ? 'IG' : 'TT'}
        </span>
      </div>

      <div className="video-box" onClick={openReel}>
        <div className="play-btn">▶</div>
        <span className="video-hint">
          Открыть в {reel.platform === 'instagram' ? 'Instagram' : 'TikTok'}
        </span>
        <span className="video-emoji">
          {reel.platform === 'instagram' ? '📸' : '🎵'}
        </span>
      </div>

      <div className="card-actions">
        <button className="btn btn-open" onClick={openReel}>Открыть ↗</button>
        {onDelete && (
          <button className="btn btn-del" onClick={() => onDelete(reel.reel_id)}>🗑</button>
        )}
      </div>
    </article>
  )
}

function App() {
  const tg = window.Telegram?.WebApp

  const [userId, setUserId] = useState(null)
  const [userName, setUserName] = useState('Гость')
  const [userPhoto, setUserPhoto] = useState(null)

  const [tab, setTab] = useState('feed')
  const [profileId, setProfileId] = useState(null)
  const [profile, setProfile] = useState(null)

  const [myReels, setMyReels] = useState([])
  const [feed, setFeed] = useState({ reels: [], curators: [] })
  const [people, setPeople] = useState([])
  const [mySubs, setMySubs] = useState([])
  const [loading, setLoading] = useState(true)

  // === Загрузчики ===

  const loadMySubs = async (id) => {
    try {
      const r = await fetch(`${API_URL}/api/subscriptions/${id}`)
      setMySubs(await r.json())
    } catch (e) { console.error(e) }
  }

  const loadFeed = async (id) => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/feed/${id}`)
      setFeed(await r.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadMyReels = async (id) => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/reels/${id}`)
      setMyReels(await r.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadExplore = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/explore`)
      setPeople(await r.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const loadProfile = async (id) => {
    setLoading(true)
    try {
      const [p, r] = await Promise.all([
        fetch(`${API_URL}/api/users/${id}`).then(x => x.json()),
        fetch(`${API_URL}/api/reels/${id}`).then(x => x.json())
      ])
      setProfile({ user: p.user, stats: p.stats, reels: r })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // === Старт ===

  useEffect(() => {
    let id = null, name = 'Гость', photo = null, username = null

    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user
      id = String(u.id)
      name = u.first_name || 'Друг'
      photo = u.photo_url || null
      username = u.username || null
      tg.ready()
      tg.expand()
    } else {
      id = new URLSearchParams(window.location.search).get('userId')
    }

    setUserId(id)
    setUserName(name)
    setUserPhoto(photo)

    if (!id) { setLoading(false); return }

    // Сохраняем свой профиль в базу
    fetch(`${API_URL}/api/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id, username, first_name: name, photo_url: photo })
    }).catch(() => {})

    loadMySubs(id)

    // Deep-link: ссылка на чужой профиль
    let sp = tg?.initDataUnsafe?.start_param
    
    // Fallback: пробуем из URL (для тестирования в браузере)
    if (!sp) {
      sp = new URLSearchParams(window.location.search).get('startapp')
    }
    
    console.log('[ReelFlow] start_param:', sp)
    console.log('[ReelFlow] user id:', id)
    
    if (sp && /^u\d+$/.test(sp)) {
      const target = sp.slice(1)
      console.log('[ReelFlow] opening profile:', target)
      if (target !== id) {
        setProfileId(target)
        loadProfile(target)
        return
      }
    }
  }, [])

  // Переключение вкладок
  useEffect(() => {
    if (!userId) return
    if (tab === 'feed') loadFeed(userId)
    if (tab === 'my') loadMyReels(userId)
    if (tab === 'explore') loadExplore()
  }, [tab, userId])

  // === Действия ===

  const openProfile = (id) => {
    setProfileId(id)
    loadProfile(id)
  }

  const toggleSubscribe = async (targetId) => {
    if (!userId || targetId === userId) return
    const isSub = mySubs.includes(targetId)
    try {
      if (isSub) {
        await fetch(`${API_URL}/api/subscribe/${userId}/${targetId}`, { method: 'DELETE' })
        setMySubs(mySubs.filter(x => x !== targetId))
      } else {
        await fetch(`${API_URL}/api/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriber_id: userId, target_id: targetId })
        })
        setMySubs([...mySubs, targetId])
      }
      tg?.HapticFeedback?.impactOccurred('light')
      if (profileId === targetId) loadProfile(targetId)
    } catch (e) { console.error(e) }
  }

  const deleteReel = async (reelId) => {
    const ok = tg?.showConfirm
      ? await new Promise(r => tg.showConfirm('Удалить рилс из коллекции?', r))
      : window.confirm('Удалить рилс из коллекции?')
    if (!ok) return
    try {
      await fetch(`${API_URL}/api/reels/${userId}/${reelId}`, { method: 'DELETE' })
      setMyReels(myReels.filter(r => r.reel_id !== reelId))
    } catch (e) { console.error(e) }
  }

  const shareProfile = async () => {
    const link = `https://t.me/${BOT_USERNAME}?startapp=u${userId}`
    try {
      await navigator.clipboard.writeText(link)
      if (tg) tg.showAlert('Ссылка на профиль скопирована! Отправь её друзьям 😉')
      else alert('Ссылка скопирована: ' + link)
    } catch {
      window.prompt('Скопируй ссылку:', link)
    }
  }

  // === Рендер ===

  const curatorMap = {}
  feed.curators.forEach(c => { curatorMap[c.user_id] = c })

  // Чужой/свой профиль
  if (profileId && profile) {
    const isMe = profileId === userId
    const isSub = mySubs.includes(profileId)
    return (
      <div className="app">
        <button className="back-btn" onClick={() => { setProfileId(null); setProfile(null) }}>
          ← Назад
        </button>

        <div className="profile-head">
          <Avatar photo={profile.user.photo_url} name={profile.user.first_name} size={72} />
          <div className="profile-name">{profile.user.first_name || 'Неизвестный'}</div>
          {profile.user.username && <div className="profile-username">@{profile.user.username}</div>}
          <div className="profile-stats">
            <div className="pstat"><b>{profile.stats.reels}</b><span>рилсов</span></div>
            <div className="pstat"><b>{profile.stats.followers}</b><span>подписчиков</span></div>
            <div className="pstat"><b>{profile.stats.following}</b><span>подписок</span></div>
          </div>
        </div>

        <div className="profile-actions">
          {isMe ? (
            <button className="big-btn" onClick={shareProfile}>🔗 Поделиться профилем</button>
          ) : (
            <button
              className={`big-btn ${isSub ? 'secondary' : ''}`}
              onClick={() => toggleSubscribe(profileId)}
            >
              {isSub ? '✓ Вы подписаны' : '+ Подписаться'}
            </button>
          )}
        </div>

        <main className="feed">
          {loading && <div className="loader">Загрузка...</div>}
          {!loading && profile.reels.length === 0 && (
            <div className="empty"><p>Пока нет сохранённых рилсов</p></div>
          )}
          {!loading && profile.reels.map(reel => (
            <ReelCard key={reel.id} reel={reel} />
          ))}
        </main>
      </div>
    )
  }

  // Основные вкладки
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <Avatar photo={userPhoto} name={userName} />
          <div>
            <h1>ReelFlow</h1>
            <span className="subtitle">
              {tab === 'feed' ? 'лента подписок' : tab === 'my' ? 'моя коллекция' : 'люди'}
            </span>
          </div>
        </div>
      </header>

      <main className="feed">
        {loading && <div className="loader">Загрузка...</div>}

        {/* ЛЕНТА */}
        {!loading && tab === 'feed' && (
          <>
            {mySubs.length === 0 && (
              <div className="empty">
                <div className="empty-icon">👥</div>
                <h2>Ты пока ни на кого не подписан</h2>
                <p>Загляни во вкладку «Люди» и подпишись на друзей — их рилсы появятся здесь</p>
                <button className="big-btn" style={{ marginTop: 16 }} onClick={() => setTab('explore')}>
                  Найти людей
                </button>
              </div>
            )}
            {mySubs.length > 0 && feed.reels.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🎬</div>
                <h2>В ленте пока пусто</h2>
                <p>Твои подписки ещё не сохранили ни одного рилса</p>
              </div>
            )}
            {feed.reels.map(reel => (
              <ReelCard
                key={reel.id}
                reel={reel}
                curator={curatorMap[reel.user_id]}
                onCuratorClick={openProfile}
              />
            ))}
          </>
        )}

        {/* МОИ */}
        {!loading && tab === 'my' && (
          <>
            <div className="my-actions">
              <button className="big-btn" onClick={shareProfile}>🔗 Поделиться профилем</button>
            </div>
            {myReels.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🎬</div>
                <h2>Пока пусто</h2>
                <p>Перешли ссылку на рилс боту — и он появится здесь</p>
              </div>
            )}
            {myReels.map(reel => (
              <ReelCard key={reel.id} reel={reel} onDelete={deleteReel} />
            ))}
          </>
        )}

        {/* ЛЮДИ */}
        {!loading && tab === 'explore' && (
          <div className="people-list">
            {people.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🕵️</div>
                <h2>Пока никого нет</h2>
                <p>Поделись ссылкой на бота с друзьями — они появятся здесь</p>
              </div>
            )}
            {people.map(p => (
              <div className="person-row" key={p.user_id} onClick={() => openProfile(p.user_id)}>
                <Avatar photo={p.photo_url} name={p.first_name} size={42} />
                <div className="person-info">
                  <span className="person-name">
                    {p.first_name || 'Неизвестный'}{p.user_id === userId ? ' (ты)' : ''}
                  </span>
                  <span className="person-meta">{p.reel_count} рилсов</span>
                </div>
                {p.user_id !== userId && (
                  <button
                    className={`sub-btn ${mySubs.includes(p.user_id) ? 'subscribed' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleSubscribe(p.user_id) }}
                  >
                    {mySubs.includes(p.user_id) ? '✓' : '+'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Нижняя навигация */}
      <nav className="bottom-nav">
        <button className={`nav-btn ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')}>
          <span className="nav-ico">📺</span>Лента
        </button>
        <button className={`nav-btn ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
          <span className="nav-ico">📌</span>Мои
        </button>
        <button className={`nav-btn ${tab === 'explore' ? 'active' : ''}`} onClick={() => setTab('explore')}>
          <span className="nav-ico">👥</span>Люди
        </button>
      </nav>
    </div>
  )
}

export default App
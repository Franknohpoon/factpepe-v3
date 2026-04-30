import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// Firebase 설정 (환경변수로 관리 권장)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [activeTab, setActiveTab] = useState('news'); // 기본: 팩트 뉴스

  const tabs = [
    { id: 'news', name: '팩트 뉴스', emoji: '🐸', component: FactNewsTab },
    { id: 'schedule', name: '승요체크', emoji: '📅', component: ScheduleTab },
    { id: 'chant', name: '응원가', emoji: '🎵', component: ChantTab },
    { id: 'comic', name: '4컷', emoji: '🎨', component: ComicTab },
    { id: 'lineup', name: '라인업', emoji: '📋', component: LineupTab }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-black">
      {/* 헤더 */}
      <header className="bg-gradient-to-r from-red-900 to-red-700 border-b-4 border-red-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* 로고 & 타이틀 */}
            <div className="text-center md:text-left">
              <h1 className="text-3xl lg:text-4xl font-black text-white mb-1">
                🐸 팩트페페
              </h1>
              <p className="text-red-200 text-sm">
                SSG 랜더스 팩트폭격 서비스
              </p>
            </div>

            {/* 탭 네비게이션 */}
            <nav className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide justify-center md:justify-end">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-red-700 shadow-lg scale-105'
                      : 'bg-red-800 text-red-200 hover:bg-red-700'
                  }`}
                >
                  {tab.emoji} {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {ActiveComponent && <ActiveComponent />}
      </main>

      {/* 푸터 */}
      <footer className="bg-zinc-900 border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-gray-400 text-sm mb-2">
            🐸 팩트페페 | SSG 랜더스 팬 서비스
          </p>
          <p className="text-gray-600 text-xs">
            © 2026 FactPepe. All rights reserved.
          </p>
          <div className="mt-3">
            <a 
              href="https://x.com/pepe_noh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 text-sm font-bold"
            >
              𝕏 @pepe_noh
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// 1. 팩트 뉴스 탭
const FactNewsTab = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const postsRef = ref(database, 'factNews');
    
    onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postsArray = Object.values(data)
          .sort((a, b) => b.timestamp - a.timestamp);
        setPosts(postsArray);
      }
      setLoading(false);
    });
  }, []);

  const filteredPosts = filter === 'all' 
    ? posts 
    : posts.filter(post => post.category === filter);

  const categories = [
    { id: 'all', name: '전체', emoji: '🔥' },
    { id: '경기리뷰', name: '경기리뷰', emoji: '⚾' },
    { id: '선수분석', name: '선수분석', emoji: '👤' },
    { id: '팀분석', name: '팀분석', emoji: '📊' },
    { id: '밈', name: '밈', emoji: '🐸' }
  ];

  const getCategoryColor = (category) => {
    const colors = {
      '경기리뷰': 'bg-red-900/30 border-red-600 text-red-400',
      '선수분석': 'bg-blue-900/30 border-blue-600 text-blue-400',
      '팀분석': 'bg-purple-900/30 border-purple-600 text-purple-400',
      '밈': 'bg-green-900/30 border-green-600 text-green-400'
    };
    return colors[category] || 'bg-gray-900/30 border-gray-600 text-gray-400';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div>
      {/* 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
              filter === cat.id
                ? 'bg-red-600 text-white border-2 border-red-400'
                : 'bg-zinc-800 text-gray-400 border-2 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {/* 게시물 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
            <p className="text-gray-400 mt-4">로딩 중...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
            <p className="text-gray-400 text-lg mb-2">게시물이 없습니다</p>
            <p className="text-gray-600 text-sm">곧 업데이트 예정!</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <div 
              key={post.id}
              className="bg-gradient-to-br from-zinc-900 to-black border-2 border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all duration-300 hover:scale-[1.02]"
            >
              {post.imageUrl && (
                <div className="relative aspect-video bg-zinc-900">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getCategoryColor(post.category)}`}>
                      {post.category}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="p-5">
                <h2 className="text-xl font-black text-white mb-3">
                  {post.title}
                </h2>
                
                <p className="text-gray-400 text-sm mb-4 whitespace-pre-line leading-relaxed">
                  {post.summary}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <span>📅</span>
                    <span>{formatDate(post.date)}</span>
                  </div>
                  
                  {post.tweetUrl && (
                    <a
                      href={post.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                    >
                      <span>𝕏</span>
                      <span>트윗 보기</span>
                      <span>→</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 2. 승요체크 탭
const ScheduleTab = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gamesRef = ref(database, 'schedule');
    
    onValue(gamesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const gamesArray = Object.values(data)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setGames(gamesArray);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">📅 승요체크</h2>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game, idx) => (
            <div 
              key={idx}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-red-600 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">{game.date}</p>
                  <p className="text-white font-bold text-lg">
                    SSG vs {game.opponent}
                  </p>
                  <p className="text-gray-500 text-sm">{game.location}</p>
                </div>
                {game.result && (
                  <div className={`px-4 py-2 rounded-lg font-black text-lg ${
                    game.result === '승' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-zinc-700 text-gray-400'
                  }`}>
                    {game.result}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 3. 응원가 탭
const ChantTab = () => {
  const [chants, setChants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    const chantsRef = ref(database, 'chants');
    
    onValue(chantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setChants(Object.values(data));
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">🎵 응원가</h2>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
        </div>
      ) : selectedPlayer ? (
        <div>
          <button
            onClick={() => setSelectedPlayer(null)}
            className="mb-4 text-red-500 hover:text-red-400 font-bold"
          >
            ← 목록으로
          </button>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-2xl font-black text-white mb-4">
              {selectedPlayer.name}
            </h3>
            <div className="bg-black p-6 rounded-xl">
              <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedPlayer.lyrics}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {chants.map((chant, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedPlayer(chant)}
              className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-4 hover:border-red-600 hover:scale-105 transition-all text-left"
            >
              <p className="text-white font-bold text-lg mb-1">
                {chant.name}
              </p>
              <p className="text-gray-500 text-sm">
                {chant.position}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 4. 4컷 탭
const ComicTab = () => {
  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">🎨 4컷 만화</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <p className="text-gray-400 text-lg mb-4">4컷 만화 생성기</p>
        <p className="text-gray-600 text-sm">준비 중입니다...</p>
      </div>
    </div>
  );
};

// 5. 라인업 탭
const LineupTab = () => {
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lineupRef = ref(database, 'lineup/latest');
    
    onValue(lineupRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLineup(data);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">📋 오늘의 라인업</h2>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
        </div>
      ) : lineup ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="mb-4 pb-4 border-b border-zinc-700">
            <p className="text-gray-400 text-sm mb-1">{lineup.date}</p>
            <p className="text-white font-bold text-lg">
              SSG vs {lineup.opponent}
            </p>
          </div>
          
          <div className="space-y-2">
            {lineup.players.map((player, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 bg-black p-3 rounded-lg"
              >
                <span className="text-red-500 font-black text-lg w-8">
                  {idx + 1}
                </span>
                <span className="text-white font-bold flex-1">
                  {player.name}
                </span>
                <span className="text-gray-400 text-sm">
                  {player.position}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400">라인업 정보가 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default App;

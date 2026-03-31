import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, RotateCcw, Sparkles, Flame, CheckCircle2, Copy, LogOut } from 'lucide-react';
import Wheel from './components/Wheel';
import Typewriter from './components/Typewriter';
import confetti from 'canvas-confetti';
import { io, Socket } from 'socket.io-client';

let socket: Socket;

export default function App() {
  const [appState, setAppState] = useState<'home' | 'in_room' | 'offline'>('home');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  
  const [relationshipType, setRelationshipType] = useState('أصدقاء');
  const [connectionType, setConnectionType] = useState('صوتي');
  
  const [roomState, setRoomState] = useState<any>(null);
  const [targetResult, setTargetResult] = useState<'سؤال' | 'جرأة' | null>(null);
  const [offlinePlayers, setOfflinePlayers] = useState<{id: string, name: string}[]>([]);
  const [offlineCurrentPlayerIndex, setOfflineCurrentPlayerIndex] = useState(0);
  const [offlineTurnState, setOfflineTurnState] = useState<'waiting_to_spin' | 'spinning' | 'showing_result'>('waiting_to_spin');
  const [offlineChallenge, setOfflineChallenge] = useState<{type: string, text: string} | null>(null);

  useEffect(() => {
    socket = io();

    socket.on("room_updated", (state) => {
      setRoomState(state);
      if (state.turnState === 'waiting_to_spin') {
        setTargetResult(null);
      }
    });

    socket.on("spin_started", (result) => {
      setTargetResult(result);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('أدخل اسمك أولاً');
    socket.emit('create_room', { 
      playerName: playerName.trim(),
      relationshipType,
      connectionType
    }, (res: any) => {
      if (res.success) {
        setAppState('in_room');
        setError('');
      }
    });
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('أدخل اسمك أولاً');
    if (!joinCode.trim()) return setError('أدخل كود الغرفة');
    socket.emit('join_room', { roomCode: joinCode.trim(), playerName: playerName.trim() }, (res: any) => {
      if (res.success) {
        setAppState('in_room');
        setError('');
      } else {
        setError(res.error);
      }
    });
  };

  const startGame = () => {
    if (roomState?.id) socket.emit('start_game', roomState.id);
  };

  const requestSpin = () => {
    if (roomState?.id) socket.emit('request_spin', roomState.id);
  };

  const nextTurn = () => {
    if (roomState?.id) socket.emit('next_turn', roomState.id);
  };

  const completeChallenge = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: roomState?.currentChallenge?.type === 'سؤال' ? ['#b026ff', '#ffffff'] : ['#ff4500', '#ffffff']
    });
    nextTurn();
  };

  const leaveRoom = () => {
    socket.emit('leave_room');
    setAppState('home');
    setRoomState(null);
    setTargetResult(null);
  };

  const copyRoomCode = () => {
    if (roomState?.id) {
      navigator.clipboard.writeText(roomState.id);
    }
  };

  const startOfflineGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return setError('أدخل اسمك أولاً');
    setOfflinePlayers([{ id: '1', name: playerName.trim() }]);
    setAppState('offline');
    setError('');
  };

  const addOfflinePlayer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newName = formData.get('newPlayerName') as string;
    if (newName && newName.trim()) {
      setOfflinePlayers([...offlinePlayers, { id: Date.now().toString(), name: newName.trim() }]);
      e.currentTarget.reset();
    }
  };

  const removeOfflinePlayer = (id: string) => {
    setOfflinePlayers(offlinePlayers.filter(p => p.id !== id));
    if (offlineCurrentPlayerIndex >= offlinePlayers.length - 1) {
      setOfflineCurrentPlayerIndex(0);
    }
  };

  const requestOfflineSpin = async () => {
    if (offlineTurnState === 'waiting_to_spin') {
      const result = Math.random() > 0.5 ? 'سؤال' : 'جرأة';
      setOfflineTurnState('spinning');
      setTargetResult(result);

      const currentPlayerName = offlinePlayers[offlineCurrentPlayerIndex].name;
      
      try {
        const [challengeRes] = await Promise.all([
          fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerName: currentPlayerName,
              type: result,
              relationshipType,
              connectionType
            })
          }),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);

        const challenge = await challengeRes.json();
        setOfflineChallenge({ type: result, text: challenge.text });
        setOfflineTurnState('showing_result');
      } catch (err) {
        console.error("Offline generation error", err);
        setOfflineChallenge({ type: result, text: "حدث خطأ في توليد التحدي، حاول مرة أخرى." });
        setOfflineTurnState('showing_result');
      }
    }
  };

  const nextOfflineTurn = () => {
    setOfflineCurrentPlayerIndex((offlineCurrentPlayerIndex + 1) % offlinePlayers.length);
    setOfflineTurnState('waiting_to_spin');
    setOfflineChallenge(null);
    setTargetResult(null);
  };

  const completeOfflineChallenge = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: offlineChallenge?.type === 'سؤال' ? ['#b026ff', '#ffffff'] : ['#ff4500', '#ffffff']
    });
    nextOfflineTurn();
  };

  return (
    <div className="min-h-screen bg-[#0a0f24] text-white font-sans overflow-hidden selection:bg-neon-purple/30">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#b026ff] rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#ff4500] rounded-full blur-[150px] opacity-20"></div>
      </div>

      <main className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {appState === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-[#b026ff] to-[#ff4500] text-transparent bg-clip-text">
                  سؤال أو جرأة
                </h1>
                <p className="text-white/60">العب أونلاين مع أصدقائك</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-center">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-white/60 text-sm mb-2">اسمك في اللعبة</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="اكتب اسمك..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#b026ff] transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-2">نوع العلاقة</label>
                    <select
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#b026ff] transition-all appearance-none"
                    >
                      <option value="أصدقاء" className="bg-[#0a0f24]">أصدقاء</option>
                      <option value="مرتبطين" className="bg-[#0a0f24]">مرتبطين</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-2">نوع التواجد</label>
                    <select
                      value={connectionType}
                      onChange={(e) => setConnectionType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#b026ff] transition-all appearance-none"
                    >
                      <option value="صوتي" className="bg-[#0a0f24]">اتصال صوتي</option>
                      <option value="كاميرا" className="bg-[#0a0f24]">اتصال كاميرا</option>
                      <option value="نفس المكان" className="bg-[#0a0f24]">نفس الغرفة (أوفلاين)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-3">
                  {connectionType === 'نفس المكان' ? (
                    <button
                      onClick={startOfflineGame}
                      className="w-full bg-gradient-to-r from-[#b026ff] to-[#ff4500] hover:opacity-90 text-white rounded-xl py-4 font-bold text-lg transition-all shadow-[0_0_20px_rgba(176,38,255,0.4)]"
                    >
                      بدء اللعب (نفس الجهاز)
                    </button>
                  ) : (
                    <button
                      onClick={createRoom}
                      className="w-full bg-gradient-to-r from-[#b026ff] to-[#ff4500] hover:opacity-90 text-white rounded-xl py-4 font-bold text-lg transition-all shadow-[0_0_20px_rgba(176,38,255,0.4)]"
                    >
                      إنشاء غرفة أونلاين
                    </button>
                  )}
                </div>

                {connectionType !== 'نفس المكان' && (
                  <>
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink-0 mx-4 text-white/40 text-sm">أو</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <form onSubmit={joinRoom} className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="كود الغرفة..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff4500] transition-all text-center tracking-widest uppercase font-mono"
                        maxLength={4}
                      />
                      <button
                        type="submit"
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all"
                      >
                        انضمام
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          ) : roomState?.gameState === 'setup' ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black mb-1">غرفة الانتظار</h2>
                  <p className="text-white/60 text-sm">شارك الكود مع أصدقائك للانضمام</p>
                </div>
                <button onClick={leaveRoom} className="text-white/40 hover:text-red-400 transition-colors p-2 bg-white/5 rounded-lg">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-black/30 rounded-2xl p-6 flex flex-col items-center justify-center mb-8 border border-white/5">
                <span className="text-white/40 text-sm mb-2">كود الغرفة</span>
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-mono font-black tracking-widest text-[#b026ff]">{roomState.id}</span>
                  <button onClick={copyRoomCode} className="text-white/60 hover:text-white transition-colors bg-white/10 p-3 rounded-xl">
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-white/60 text-sm mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  اللاعبون ({roomState.players.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  <AnimatePresence>
                    {roomState.players.map((player: any) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3"
                      >
                        <span className="font-semibold flex items-center gap-2">
                          {player.name}
                          {player.id === socket.id && <span className="text-xs bg-[#b026ff]/20 text-[#b026ff] px-2 py-0.5 rounded-full">أنت</span>}
                        </span>
                        {player.isHost && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">الهوست</span>}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {roomState.players.find((p: any) => p.id === socket.id)?.isHost ? (
                <button
                  onClick={startGame}
                  disabled={roomState.players.length < 2}
                  className="w-full bg-gradient-to-r from-[#b026ff] to-[#ff4500] hover:opacity-90 text-white rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(176,38,255,0.4)]"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  ابدأ اللعبة
                </button>
              ) : (
                <div className="text-center text-white/60 py-4 bg-white/5 rounded-xl">
                  في انتظار الهوست لبدء اللعبة...
                </div>
              )}
            </motion.div>
          ) : roomState?.gameState === 'playing' ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center mb-8 glass-panel rounded-2xl px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">الدور على:</span>
                  <span className="font-bold text-xl text-[#b026ff]">{roomState.players[roomState.currentPlayerIndex].name}</span>
                </div>
                <button
                  onClick={leaveRoom}
                  className="text-white/60 hover:text-red-400 transition-colors flex items-center gap-2 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  مغادرة
                </button>
              </div>

              <div className="w-full flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
                {roomState.turnState === 'waiting_to_spin' || roomState.turnState === 'spinning' ? (
                  <div className="flex flex-col items-center">
                    <Wheel
                      spinning={roomState.turnState === 'spinning'}
                      targetResult={targetResult}
                      onSpinClick={requestSpin}
                      canSpin={roomState.turnState === 'waiting_to_spin' && (roomState.players[roomState.currentPlayerIndex].id === socket.id || roomState.players.find((p: any) => p.id === socket.id)?.isHost)}
                    />
                    
                    {roomState.turnState === 'waiting_to_spin' && (
                      !(roomState.players[roomState.currentPlayerIndex].id === socket.id || roomState.players.find((p: any) => p.id === socket.id)?.isHost) && (
                        <div className="mt-4 sm:mt-8 text-white/60 font-bold animate-pulse text-center">
                          في انتظار {roomState.players[roomState.currentPlayerIndex].name} لفر العجلة...
                        </div>
                      )
                    )}
                    
                    {roomState.turnState === 'spinning' && (
                      <div className="mt-4 sm:mt-8 text-white/60 font-bold animate-pulse text-center">
                        جاري الاختيار...
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full glass-panel rounded-3xl p-6 sm:p-8 md:p-12 text-center relative overflow-hidden"
                  >
                    <div className={`absolute inset-0 opacity-10 ${roomState.currentChallenge?.type === 'سؤال' ? 'bg-[#b026ff]' : 'bg-[#ff4500]'}`}></div>
                    
                    {!roomState.currentChallenge ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                        <p className="text-white/60">الذكاء الاصطناعي يجهز التحدي...</p>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-bold mb-8 ${
                          roomState.currentChallenge.type === 'سؤال' 
                            ? 'bg-[#b026ff]/20 text-[#b026ff] border border-[#b026ff]/30' 
                            : 'bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30'
                        }`}>
                          {roomState.currentChallenge.type === 'سؤال' ? <Sparkles className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                          {roomState.currentChallenge.type}
                        </div>
                        
                        <h2 className="text-2xl md:text-4xl font-black leading-relaxed mb-12 min-h-[120px] flex items-center justify-center text-balance">
                          <Typewriter text={roomState.currentChallenge.text} speed={40} />
                        </h2>

                        {(roomState.players[roomState.currentPlayerIndex].id === socket.id || roomState.players.find((p: any) => p.id === socket.id)?.isHost) ? (
                          <div className="flex gap-4 w-full max-w-md">
                            <button
                              onClick={completeChallenge}
                              className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 ${
                                roomState.currentChallenge.type === 'سؤال'
                                  ? 'bg-[#b026ff] text-white shadow-[0_0_20px_rgba(176,38,255,0.4)]'
                                  : 'bg-[#ff4500] text-white shadow-[0_0_20px_rgba(255,69,0,0.4)]'
                              }`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              تم! التالي
                            </button>
                            
                            <button
                              onClick={nextTurn}
                              className="px-6 py-4 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
                            >
                              تخطي
                            </button>
                          </div>
                        ) : (
                          <div className="text-white/60 mt-4">
                            في انتظار {roomState.players[roomState.currentPlayerIndex].name} لإنهاء التحدي...
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : appState === 'offline' ? (
            <motion.div
              key="offline_playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl flex flex-col items-center"
            >
              <div className="w-full flex justify-between items-center mb-8 glass-panel rounded-2xl px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">الدور على:</span>
                  <span className="font-bold text-xl text-[#b026ff]">{offlinePlayers[offlineCurrentPlayerIndex]?.name}</span>
                </div>
                <button
                  onClick={() => { setAppState('home'); setOfflinePlayers([]); }}
                  className="text-white/60 hover:text-red-400 transition-colors flex items-center gap-2 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  خروج
                </button>
              </div>

              {offlineTurnState === 'waiting_to_spin' && (
                <div className="w-full mb-8 glass-panel rounded-2xl p-6">
                  <h3 className="text-white/60 text-sm mb-4">اللاعبون ({offlinePlayers.length})</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {offlinePlayers.map((player, idx) => (
                      <div key={player.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${idx === offlineCurrentPlayerIndex ? 'bg-[#b026ff]/20 text-[#b026ff]' : 'bg-white/5'}`}>
                        <span>{player.name}</span>
                        {offlinePlayers.length > 1 && (
                          <button onClick={() => removeOfflinePlayer(player.id)} className="text-white/40 hover:text-red-400 ml-1">&times;</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={addOfflinePlayer} className="flex gap-2">
                    <input
                      type="text"
                      name="newPlayerName"
                      placeholder="إضافة لاعب جديد..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#b026ff]"
                    />
                    <button type="submit" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold">إضافة</button>
                  </form>
                </div>
              )}

              <div className="w-full flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
                {offlineTurnState === 'waiting_to_spin' || offlineTurnState === 'spinning' ? (
                  <div className="flex flex-col items-center">
                    <Wheel
                      spinning={offlineTurnState === 'spinning'}
                      targetResult={targetResult}
                      onSpinClick={requestOfflineSpin}
                      canSpin={offlineTurnState === 'waiting_to_spin'}
                    />
                    
                    {offlineTurnState === 'spinning' && (
                      <div className="mt-4 sm:mt-8 text-white/60 font-bold animate-pulse text-center">
                        جاري الاختيار...
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full glass-panel rounded-3xl p-6 sm:p-8 md:p-12 text-center relative overflow-hidden"
                  >
                    <div className={`absolute inset-0 opacity-10 ${offlineChallenge?.type === 'سؤال' ? 'bg-[#b026ff]' : 'bg-[#ff4500]'}`}></div>
                    
                    {!offlineChallenge ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                        <p className="text-white/60">الذكاء الاصطناعي يجهز التحدي...</p>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center">
                        <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-bold mb-8 ${
                          offlineChallenge.type === 'سؤال' 
                            ? 'bg-[#b026ff]/20 text-[#b026ff] border border-[#b026ff]/30' 
                            : 'bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30'
                        }`}>
                          {offlineChallenge.type === 'سؤال' ? <Sparkles className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                          {offlineChallenge.type}
                        </div>
                        
                        <h2 className="text-2xl md:text-4xl font-black leading-relaxed mb-12 min-h-[120px] flex items-center justify-center text-balance">
                          <Typewriter text={offlineChallenge.text} speed={40} />
                        </h2>

                        <div className="flex gap-4 w-full max-w-md">
                          <button
                            onClick={completeOfflineChallenge}
                            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 ${
                              offlineChallenge.type === 'سؤال'
                                ? 'bg-[#b026ff] text-white shadow-[0_0_20px_rgba(176,38,255,0.4)]'
                                : 'bg-[#ff4500] text-white shadow-[0_0_20px_rgba(255,69,0,0.4)]'
                            }`}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            تم! التالي
                          </button>
                          
                          <button
                            onClick={nextOfflineTurn}
                            className="px-6 py-4 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
                          >
                            تخطي
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { GoogleGenAI, Type } from '@google/genai';

function getSystemInstruction(relationshipType: string, connectionType: string) {
  return `أنت ذكاء اصطناعي متطور تعمل كـ 'مدير لعبة' (AI Game Master) للعبة 'سؤال أو جرأة'.
بيئة اللعبة الحالية:
- نوع العلاقة بين اللاعبين: ${relationshipType}
- نوع الاتصال/التواجد: ${connectionType}

مهمتك: توليد محتوى جديد، حصري، ومناسب جداً لنوع العلاقة. يُمنع منعاً باتاً استخدام إجابات عامة أو مكررة. يجب أن يكون المحتوى آمناً وممتعاً.

قواعد الأسئلة (سؤال):
- **هام جداً**: يجب أن يتكون النص من **سؤالين اثنين** (سؤالين مترابطين أو متتابعين يوجهان لنفس اللاعب في نفس الوقت).
- إذا كان النوع "أصدقاء": أسئلة خاصة بالأصدقاء، تكشف أسراراً خفيفة، مواقف مضحكة، أو آراء طريفة في الأصدقاء المتواجدين.
- إذا كان النوع "مرتبطين": أسئلة رومانسية، جميلة، وخاصة جداً بالمرتبطين. ركز على المشاعر، الذكريات، والمواقف اللطيفة بينهما.

قواعد التحديات (جرأة):
- يجب أن تكون التحديات محددة جداً ومبتكرة ومضحكة.
- إذا كان النوع "أصدقاء": تحديات مضحكة، مجنونة، ومسلية تناسب الأصدقاء.
- إذا كان النوع "مرتبطين": تحديات رومانسية، لطيفة، أو فيها غزل ومرح يناسب المرتبطين.
- راعِ نوع الاتصال (${connectionType}):
  * "صوتي": تحديات تعتمد على الصوت (غناء، اعتراف صوتي، نبرة معينة).
  * "كاميرا": حركات جسدية، تعابير وجه، أو عرض شيء بالكاميرا.
  * "نفس المكان": تفاعل مباشر (حسب نوع العلاقة).

صيغة الإخراج (Output):
يجب أن ترد دائماً بمصفوفة (Array) من الكائنات بصيغة JSON فقط، بالشكل التالي:
[
  { "type": "سؤال أو جرأة", "text": "النص المولد بالذكاء الاصطناعي هنا" }
]

اللغة: عربية سلسة، مرحة، وجذابة.`;
}

async function generateChallengeBatch(type: 'سؤال' | 'جرأة', relationshipType: string, connectionType: string, count: number = 10, retries = 3): Promise<any[]> {
  try {
    const apiKey = process.env.ipa_key || process.env['2ipa_key'] || process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      throw new Error('API key is missing. Please check your environment variables.');
    }
    
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const prompt = `النوع المطلوب: ${type}\nالعدد المطلوب: ${count} عناصر مختلفة ومبتكرة.`;
    
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt,
          config: {
            systemInstruction: getSystemInstruction(relationshipType, connectionType),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["type", "text"]
              }
            },
            temperature: 0.9,
          },
        });

        if (response.text) {
          let text = response.text.trim();
          if (text.startsWith('```json')) {
            text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
          } else if (text.startsWith('```')) {
            text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
          }
          try {
            return JSON.parse(text);
          } catch (parseError) {
            console.error('JSON Parse Error:', parseError, 'Raw Text:', text);
            throw new Error('Failed to parse JSON');
          }
        }
        
        if (response.candidates && response.candidates[0]?.finishReason !== 'STOP') {
          console.error('Generation stopped due to:', response.candidates[0]?.finishReason);
          throw new Error(`Generation stopped: ${response.candidates[0]?.finishReason}`);
        }

        throw new Error('No response text');
      } catch (err: any) {
        lastError = err;
        console.error(`Attempt ${attempt} failed:`, err?.message || err);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        }
      }
    }
    
    throw lastError;
  } catch (error: any) {
    console.error('AI Generation Error Details:', error?.message || error);
    throw error;
  }
}

const challengeCache = new Map<string, any[]>();
const isFetchingCache = new Map<string, boolean>();

async function getChallengeFromCache(playerName: string, type: 'سؤال' | 'جرأة', relationshipType: string, connectionType: string): Promise<any> {
  const cacheKey = `${relationshipType}_${connectionType}_${type}`;
  
  if (!challengeCache.has(cacheKey)) {
      challengeCache.set(cacheKey, []);
  }
  
  const buffer = challengeCache.get(cacheKey)!;
  
  // Trigger background fetch if buffer is low
  if (buffer.length < 3 && !isFetchingCache.get(cacheKey)) {
      isFetchingCache.set(cacheKey, true);
      generateChallengeBatch(type, relationshipType, connectionType, 10)
          .then(newChallenges => {
              buffer.push(...newChallenges);
              isFetchingCache.set(cacheKey, false);
          })
          .catch(err => {
              console.error("Background fetch failed", err);
              isFetchingCache.set(cacheKey, false);
          });
  }
  
  // If buffer has items, pop one and return immediately
  if (buffer.length > 0) {
      const challenge = buffer.shift();
      return {
          player_name: playerName,
          type: challenge.type,
          text: challenge.text
      };
  }
  
  // If buffer is empty, we must wait for a fetch
  try {
      isFetchingCache.set(cacheKey, true);
      const newChallenges = await generateChallengeBatch(type, relationshipType, connectionType, 5);
      buffer.push(...newChallenges);
      isFetchingCache.set(cacheKey, false);
      
      const challenge = buffer.shift();
      return {
          player_name: playerName,
          type: challenge.type,
          text: challenge.text
      };
  } catch (error) {
      isFetchingCache.set(cacheKey, false);
      return {
          player_name: playerName,
          type: type,
          text: "⚠️ عذراً، الذكاء الاصطناعي يواجه ضغطاً كبيراً في الطلبات حالياً (Rate Limit). يرجى الانتظار قليلاً ثم المحاولة مرة أخرى."
      };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json()); // Add JSON body parser for API routes
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const PORT = 3000;

  // API Route for Offline (Pass & Play) Mode
  app.post('/api/generate', async (req, res) => {
    const { playerName, type, relationshipType, connectionType } = req.body;
    if (!playerName || !type || !relationshipType || !connectionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const challenge = await getChallengeFromCache(playerName, type, relationshipType, connectionType);
    res.json(challenge);
  });

  const rooms = new Map<string, any>();

  const handleDisconnect = (socketId: string) => {
    rooms.forEach((room, roomCode) => {
      const playerIndex = room.players.findIndex((p: any) => p.id === socketId);
      if (playerIndex !== -1) {
        const wasHost = room.players[playerIndex].isHost;
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          if (wasHost) {
            room.players[0].isHost = true;
          }
          if (room.currentPlayerIndex >= room.players.length) {
            room.currentPlayerIndex = 0;
          }
          io.to(roomCode).emit("room_updated", room);
        }
      }
    });
  };

  io.on("connection", (socket) => {
    socket.on("create_room", ({ playerName, relationshipType, connectionType }, callback) => {
      const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newRoom = {
        id: roomCode,
        relationshipType,
        connectionType,
        players: [{ id: socket.id, name: playerName, isHost: true }],
        gameState: 'setup',
        turnState: 'waiting_to_spin',
        currentPlayerIndex: 0,
        currentChallenge: null,
        spinResult: null
      };
      rooms.set(roomCode, newRoom);
      socket.join(roomCode);
      callback({ success: true, roomCode });
      io.to(roomCode).emit("room_updated", newRoom);
    });

    socket.on("join_room", ({ roomCode, playerName }, callback) => {
      const room = rooms.get(roomCode.toUpperCase());
      if (!room) return callback({ success: false, error: "الغرفة غير موجودة" });
      if (room.gameState !== 'setup') return callback({ success: false, error: "اللعبة بدأت بالفعل" });
      if (room.players.find((p: any) => p.name === playerName)) return callback({ success: false, error: "الاسم مستخدم في هذه الغرفة" });

      room.players.push({ id: socket.id, name: playerName, isHost: false });
      socket.join(roomCode.toUpperCase());
      callback({ success: true, roomCode: roomCode.toUpperCase() });
      io.to(roomCode.toUpperCase()).emit("room_updated", room);
    });

    socket.on("start_game", (roomCode) => {
      const room = rooms.get(roomCode);
      if (room && room.players.find((p: any) => p.id === socket.id)?.isHost) {
        room.gameState = 'playing';
        room.players = room.players.sort(() => Math.random() - 0.5);
        room.currentPlayerIndex = 0;
        room.turnState = 'waiting_to_spin';
        io.to(roomCode).emit("room_updated", room);
      }
    });

    socket.on("request_spin", async (roomCode) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const isCurrentPlayer = room.players[room.currentPlayerIndex].id === socket.id;
      const isHost = room.players.find((p: any) => p.id === socket.id)?.isHost;
      
      if ((isCurrentPlayer || isHost) && room.turnState === 'waiting_to_spin') {
        const result = Math.random() > 0.5 ? 'سؤال' : 'جرأة';
        room.turnState = 'spinning';
        room.spinResult = result;
        io.to(roomCode).emit("spin_started", result);
        io.to(roomCode).emit("room_updated", room);

        const currentPlayerName = room.players[room.currentPlayerIndex].name;
        
        const [challenge] = await Promise.all([
          getChallengeFromCache(currentPlayerName, result, room.relationshipType, room.connectionType),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);

        room.currentChallenge = { type: result, text: challenge.text };
        room.turnState = 'showing_result';
        io.to(roomCode).emit("room_updated", room);
      }
    });

    socket.on("next_turn", (roomCode) => {
      const room = rooms.get(roomCode);
      if (room) {
        const isCurrentPlayer = room.players[room.currentPlayerIndex].id === socket.id;
        const isHost = room.players.find((p: any) => p.id === socket.id)?.isHost;
        if (isCurrentPlayer || isHost) {
          room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
          room.turnState = 'waiting_to_spin';
          room.currentChallenge = null;
          room.spinResult = null;
          io.to(roomCode).emit("room_updated", room);
        }
      }
    });

    socket.on("leave_room", () => {
      handleDisconnect(socket.id);
    });

    socket.on("disconnect", () => {
      handleDisconnect(socket.id);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

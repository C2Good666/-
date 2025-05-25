const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 路由配置
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'views', 'about.html')));
app.get('/quiz', (req, res) => res.sendFile(path.join(__dirname, 'views', 'quiz.html')));

// 问答状态
const quizState = {
  players: {},
  quizzes: {},
  questions: [
    {
      text: "法国的首都是哪里？",
      options: ["伦敦", "巴黎", "柏林"],
      answer: 1
    },
    {
      text: "下列哪种语言在浏览器中运行？",
      options: ["Java", "C", "JavaScript"],
      answer: 2
    }
  ]
};

// Socket.IO 逻辑
io.on('connection', (socket) => {
  console.log(`新连接: ${socket.id}`);

  // 玩家注册
  socket.on('register', (name) => {
    quizState.players[socket.id] = { name, score: 0 };
    io.emit('playerList', Object.values(quizState.players));
  });

  // 处理挑战
  socket.on('challenge', (targetId) => {
    io.to(targetId).emit('challengeRequest', {
      from: socket.id,
      name: quizState.players[socket.id].name
    });
  });

  // 开始问答
  socket.on('startQuiz', ({ player1, player2 }) => {
    const quizId = `${player1}-${player2}`;
    quizState.quizzes[quizId] = {
      players: [player1, player2],
      scores: { [player1]: 0, [player2]: 0 },
      currentQuestion: 0
    };
    io.to(player1).to(player2).emit('quizStart', {
      question: quizState.questions[0]
    });
  });

  // 处理答案
  socket.on('submitAnswer', ({ quizId, answer, playerId }) => {
    const quiz = quizState.quizzes[quizId];
    const question = quizState.questions[quiz.currentQuestion];
    
    if (answer === question.answer) {
      quiz.scores[playerId] += 2;
    } else {
      const opponentId = quiz.players.find(id => id !== playerId);
      quiz.scores[opponentId] += 1;
    }
    
    io.to(quizId).emit('updateScores', quiz.scores);
  });

  // 清理断开连接
  socket.on('disconnect', () => {
    delete quizState.players[socket.id];
    io.emit('playerList', Object.values(quizState.players));
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`问答服务器已启动在端口 ${PORT}`);
});

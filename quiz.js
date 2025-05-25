const socket = io();
let currentQuizId = null;

// 调试标记
console.log("Quiz.js 已加载，Socket ID:", socket.id);

// DOM元素缓存（添加null检查）
const elements = {
  registration: document.getElementById('registration'),
  lobby: document.getElementById('lobby'),
  quiz: document.getElementById('quiz'),
  playerList: document.getElementById('player-list'),
  questionText: document.getElementById('question-text'),
  options: document.getElementById('options'),
  playerScore: document.getElementById('player-score'),
  opponentScore: document.getElementById('opponent-score')
};

// 验证DOM元素
Object.entries(elements).forEach(([key, element]) => {
  if (!element) console.error(`未找到DOM元素: ${key}`);
});

// 玩家注册（添加输入验证）
document.getElementById('register-btn')?.addEventListener('click', () => {
  const name = document.getElementById('player-name')?.value.trim();
  if (!name) return alert('请输入有效昵称');
  
  console.log("尝试注册玩家:", name);
  socket.emit('register', name, (response) => {
    if (response.success) {
      elements.registration.style.display = 'none';
      elements.lobby.style.display = 'block';
      console.log("注册成功，当前Socket ID:", socket.id);
    } else {
      alert(response.message || '注册失败');
    }
  });
});

// 玩家列表更新（修复过滤逻辑）
socket.on('playerList', (players) => {
  console.log("收到玩家列表更新:", players);
  
  if (!elements.playerList) return;
  
  // 显示所有其他玩家（包括自己但标记不同）
  elements.playerList.innerHTML = players.map(player => {
    const isSelf = player.id === socket.id;
    return `
      <li class="${isSelf ? 'self' : ''}">
        ${player.name} 
        ${!isSelf ? `<button onclick="challengePlayer('${player.id}')">挑战</button>` : '(我)'}
      </li>
    `;
  }).join('');
});

// 挑战功能（添加状态验证）
window.challengePlayer = (targetId) => {
  if (!targetId) return console.error("无效的目标ID");
  console.log(`发起挑战给: ${targetId}`);
  socket.emit('challenge', targetId, (response) => {
    if (!response.success) {
      alert(response.message || '挑战发送失败');
    }
  });
};

// 挑战请求处理（添加超时）
socket.on('challengeRequest', ({ from, fromName }) => {
  console.log(`收到挑战请求 from ${fromName} (${from})`);
  const isConfirmed = confirm(`${fromName} 向你发起挑战！接受吗？`);
  
  socket.emit('challengeResponse', {
    to: from,
    accepted: isConfirmed
  });

  if (isConfirmed) {
    currentQuizId = `${from}-${socket.id}`;
    console.log("比赛ID已设置:", currentQuizId);
  }
});

// 开始问答（添加题目验证）
socket.on('quizStart', ({ question, opponent }) => {
  console.log("比赛开始，题目:", question);
  
  if (!question?.text || !question?.options) {
    return alert('题目数据不完整');
  }

  elements.lobby.style.display = 'none';
  elements.quiz.style.display = 'block';
  elements.questionText.textContent = question.text;
  
  elements.options.innerHTML = question.options.map((option, index) => `
    <button onclick="submitAnswer(${index})" 
            class="option-btn"
            data-index="${index}">
      ${option}
    </button>
  `).join('');

  console.log(`对手: ${opponent.name}`);
});

// 提交答案（添加防重复提交）
let hasSubmitted = false;
window.submitAnswer = (answerIndex) => {
  if (hasSubmitted) return alert('请等待下一题');
  if (!currentQuizId) return console.error("无有效比赛ID");
  
  console.log(`提交答案: ${answerIndex}`);
  hasSubmitted = true;
  
  socket.emit('submitAnswer', {
    quizId: currentQuizId,
    answer: answerIndex,
    playerId: socket.id
  }, (response) => {
    if (!response.success) {
      hasSubmitted = false;
      alert(response.message);
    }
  });
};

// 分数更新（添加动画效果）
socket.on('updateScores', (scores) => {
  console.log("分数更新:", scores);
  
  if (scores[socket.id]) {
    elements.playerScore.textContent = scores[socket.id];
    elements.playerScore.classList.add('score-update');
    setTimeout(() => elements.playerScore.classList.remove('score-update'), 500);
  }
  
  Object.entries(scores).forEach(([id, score]) => {
    if (id !== socket.id && elements.opponentScore) {
      elements.opponentScore.textContent = score;
      elements.opponentScore.classList.add('score-update');
      setTimeout(() => elements.opponentScore.classList.remove('score-update'), 500);
    }
  });
});

// 连接状态监控
socket.on('connect', () => {
  console.log("Socket已连接，ID:", socket.id);
  document.getElementById('connection-status')?.textContent = "🟢 已连接";
});

socket.on('disconnect', () => {
  console.warn("Socket断开连接");
  document.getElementById('connection-status')?.textContent = "🔴 已断开";
});

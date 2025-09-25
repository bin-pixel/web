// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBW8zGpKU00e1KyKjBDEcIc-Lv4yOSFlQo",
  authDomain: "bin20703-edda7.firebaseapp.com",
  databaseURL: "https://bin20703-edda7-default-rtdb.firebaseio.com/",
  projectId: "bin20703-edda7",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// =================================================================
// 2. FIREBASE & APP INITIALIZATION
// =================================================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const functions = firebase.functions();
let currentRoomId = null;
let chatListener = null; // 현재 채팅 리스너를 저장할 변수
const myUserId = `user_${Math.random().toString(36).substr(2, 9)}`; // 임시 익명 ID 생성

// =================================================================
// 3. DOM ELEMENTS
// =================================================================
const mainPage = document.getElementById('main-page');
const debateRoomPage = document.getElementById('debate-room-page');
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const roomTitleElement = document.getElementById('room-title');
const backToMainBtn = document.getElementById('back-to-main-btn');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const memoTextarea = document.getElementById('memo-textarea');
const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
const aiResultElement = document.getElementById('ai-result');

// =================================================================
// 4. PAGE NAVIGATION LOGIC
// =================================================================
function showMainPage() {
    mainPage.style.display = 'block';
    debateRoomPage.style.display = 'none';
    currentRoomId = null;
    // 이전 방의 채팅 리스너가 있다면 제거 (메모리 누수 방지)
    if (chatListener) {
        chatListener.off();
    }
}

function showDebateRoom(roomId, roomTopic) {
    mainPage.style.display = 'none';
    debateRoomPage.style.display = 'block';
    currentRoomId = roomId;
    roomTitleElement.textContent = roomTopic;
    
    // 방에 들어왔을 때 기존 내용 초기화
    chatContainer.innerHTML = '';
    aiResultElement.textContent = '아직 분석 결과가 없습니다.';

    loadChatMessages(roomId);
    loadMemo(roomId);
}

backToMainBtn.addEventListener('click', showMainPage);

// =================================================================
// 5. MAIN PAGE LOGIC (ROOM CREATION & LISTING)
// =================================================================
createRoomBtn.addEventListener('click', () => {
    const topic = prompt("새 토론방의 주제를 입력하세요:");
    if (topic && topic.trim() !== '') {
        database.ref('rooms').push({
            topic: topic,
            moderator: myUserId,
            createdAt: new Date().toISOString(),
            // 역할 부여 시스템 데이터 구조 예시
            roles: { '찬성측': null, '반대측': null, '사회자': myUserId }
        });
    }
});

const roomsRef = database.ref('rooms');
roomsRef.on('value', (snapshot) => {
    roomListElement.innerHTML = '<h2>진행중인 토론</h2>';
    const rooms = snapshot.val();
    if (rooms) {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `
                <h3>${room.topic}</h3>
                <p>진행자: ${room.moderator}</p>
            `;
            const enterButton = document.createElement('button');
            enterButton.textContent = '입장하기';
            enterButton.onclick = () => showDebateRoom(roomId, room.topic);
            roomCard.appendChild(enterButton);
            roomListElement.appendChild(roomCard);
        }
    }
});

// =================================================================
// 6. DEBATE ROOM LOGIC (CHAT, MEMO, AI ANALYSIS)
// =================================================================
// 채팅 메시지 전송
function sendMessage() {
    const message = chatInput.value.trim();
    if (message && currentRoomId) {
        database.ref(`chats/${currentRoomId}`).push({
            userId: myUserId,
            text: message,
            timestamp: new Date().toISOString()
        });
        chatInput.value = '';
    }
}
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 실시간 채팅 메시지 로딩
function loadChatMessages(roomId) {
    const chatsRef = database.ref(`chats/${roomId}`);
    chatListener = chatsRef.orderByChild('timestamp'); // 시간순 정렬
    
    chatListener.on('child_added', (snapshot) => {
        const chat = snapshot.val();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        // 내가 보낸 메시지인지 확인하여 클래스 추가
        if (chat.userId === myUserId) {
            messageDiv.classList.add('mine');
        }
        
        messageDiv.innerHTML = `
            <div class="chat-bubble ${chat.userId === myUserId ? 'mine' : 'other'}">
                <strong>${chat.userId.substring(0, 10)}:</strong> ${chat.text}
            </div>
        `;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // 항상 맨 아래로 스크롤
    });
}

// 개인 메모장 로딩 및 저장
function loadMemo(roomId) {
    memoTextarea.value = localStorage.getItem(`memo_${roomId}`) || '';
}
memoTextarea.addEventListener('keyup', () => {
    if (currentRoomId) {
        localStorage.setItem(`memo_${currentRoomId}`, memoTextarea.value);
    }
});

// AI 분석 실행
aiAnalysisBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;

    aiResultElement.textContent = '채팅 기록을 수집하여 Gemini AI에게 분석을 요청하는 중...';
    
    // 현재 방의 채팅 기록을 DB에서 한번만 가져오기
    const chatSnapshot = await database.ref(`chats/${currentRoomId}`).once('value');
    const chats = chatSnapshot.val();

    if (!chats) {
        aiResultElement.textContent = '분석할 채팅 기록이 없습니다.';
        return;
    }

    // 채팅 기록을 텍스트로 변환
    const chatLog = Object.values(chats)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(chat => `${chat.userId}: ${chat.text}`)
        .join('\n');

    // Cloud Function 호출
    const analyzeDebate = functions.httpsCallable('analyzeDebateWithGemini');
    try {
        const result = await analyzeDebate({ chatLog: chatLog });
        aiResultElement.textContent = JSON.stringify(result.data, null, 2);
        
        // [아카이브 기능 구현 컨셉]
        // 분석이 성공하면 결과를 DB의 다른 곳에 저장
        database.ref(`archives/${currentRoomId}`).set({
            topic: roomTitleElement.textContent,
            analysis: result.data,
            chatLog: chats,
            analyzedAt: new Date().toISOString()
        });
        console.log('토론이 성공적으로 분석되고 아카이브되었습니다.');

    } catch (error) {
        console.error("AI 분석 중 오류 발생:", error);
        aiResultElement.textContent = `AI 분석에 실패했습니다: ${error.message}`;
    }
});

// 앱 시작 시 메인 페이지 보여주기
showMainPage();

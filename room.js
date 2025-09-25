// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDbrsr6g0X6vKujfqBcFY0h--Rn3y1nCEI",
    authDomain: "bin20703-edda7.firebaseapp.com",
    databaseURL: "https://bin20703-edda7-default-rtdb.firebaseio.com",
    projectId: "bin20703-edda7",
    storageBucket: "bin20703-edda7.firebasestorage.app",
    messagingSenderId: "242056223892",
    appId: "1:242056223892:web:885b9bf54aa60ce7732881",
    measurementId: "G-C2VDTXTVZQ"
};

// =================================================================
// 2. INITIALIZATION
// =================================================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const functions = firebase.functions();

let currentUser = null;
let currentRoomId = null;
let currentMemoType = 'personal';
let memoTimeout;

// DOM Elements
const roomTopicElement = document.getElementById('room-topic');
const roomOwnerInfoElement = document.getElementById('room-owner-info');
const ownerControlsElement = document.getElementById('owner-controls');
const nicknameAreaElement = document.getElementById('nickname-area');
const chatWindowElement = document.getElementById('chat-window');
const chatInputElement = document.getElementById('chat-input');
const sendBtnElement = document.getElementById('send-btn');
const memoPadElement = document.getElementById('memo-pad');
const personalMemoBtn = document.getElementById('personal-memo-btn');
const sharedMemoBtn = document.getElementById('shared-memo-btn');

// =================================================================
// 3. CORE LOGIC (PAGE LOAD & AUTH)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('id');

    if (!currentRoomId) {
        roomTopicElement.textContent = "오류: 방 ID를 찾을 수 없습니다.";
        return;
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            const userNickname = currentUser.email.split('@')[0];
            updateNicknameDisplay(userNickname);
            loadRoomInfo();
            loadChatMessages();
            setupMemoListeners();
            loadMemo('personal');
        } else {
            alert("토론방에 참여하려면 로그인이 필요합니다.");
            window.location.href = 'login.html';
        }
    });
});

// =================================================================
// 4. FEATURE IMPLEMENTATIONS
// =================================================================

// --- 닉네임 표시 (고정) ---
function updateNicknameDisplay(nickname) {
    nicknameAreaElement.innerHTML = `내 아이디: <span>${nickname}</span>`;
}

// --- 방 정보 및 채팅 로드 ---
function loadRoomInfo() {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (room) {
            roomTopicElement.textContent = room.topic;
            roomOwnerInfoElement.textContent = `진행자: ${room.ownerNickname}`;
            if (currentUser && currentUser.uid === room.ownerId) {
                ownerControlsElement.innerHTML = '<button id="ai-analysis-btn">이 토론 AI로 분석하기</button>';
                document.getElementById('ai-analysis-btn').addEventListener('click', startAiAnalysis);
            }
        } else {
            roomTopicElement.textContent = "존재하지 않는 방입니다.";
        }
    });
}

function loadChatMessages() {
    const chatRef = database.ref(`chats/${currentRoomId}`).orderByChild('timestamp');
    chatRef.on('value', (snapshot) => {
        chatWindowElement.innerHTML = '';
        const messages = snapshot.val();
        if (messages) {
            Object.values(messages).forEach(displayChatMessage);
        }
        chatWindowElement.scrollTop = chatWindowElement.scrollHeight;
    });
}

function displayChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.classList.add(message.senderId === currentUser.uid ? 'my-message' : 'other-message');
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = message.senderNickname;

    const messageP = document.createElement('p');
    messageP.className = 'message-text';
    messageP.textContent = message.text;

    messageElement.appendChild(senderSpan);
    messageElement.appendChild(messageP);
    chatWindowElement.appendChild(messageElement);
}

// --- 메시지 전송 ---
function sendMessage() {
    const messageText = chatInputElement.value.trim();
    const userNickname = currentUser.email.split('@')[0];
    if (messageText && currentUser && currentRoomId) {
        database.ref(`chats/${currentRoomId}`).push({
            senderId: currentUser.uid,
            senderNickname: userNickname,
            text: messageText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        chatInputElement.value = '';
    }
}

// --- 메모장 기능 ---
function setupMemoListeners() {
    personalMemoBtn.addEventListener('click', () => switchMemoTab('personal'));
    sharedMemoBtn.addEventListener('click', () => switchMemoTab('shared'));
    memoPadElement.addEventListener('keyup', () => {
        clearTimeout(memoTimeout);
        memoTimeout = setTimeout(saveMemo, 300);
    });
}

function switchMemoTab(type) {
    currentMemoType = type;
    personalMemoBtn.classList.toggle('active', type === 'personal');
    sharedMemoBtn.classList.toggle('active', type === 'shared');
    database.ref(getMemoPath()).off();
    loadMemo(type);
}

function getMemoPath() {
    return currentMemoType === 'personal'
        ? `memos/${currentRoomId}/personal/${currentUser.uid}`
        : `memos/${currentRoomId}/shared/default`;
}

function loadMemo(type) {
    database.ref(getMemoPath()).on('value', (snapshot) => {
        if (currentMemoType === type) {
            memoPadElement.value = snapshot.val() || '';
        }
    });
}

function saveMemo() {
    database.ref(getMemoPath()).set(memoPadElement.value);
}

// --- AI 분석 기능 ---
function startAiAnalysis() {
    alert("AI 분석을 시작합니다. 이 방의 전체 대화 내용이 Gemini로 전송됩니다.");
    const chatsRef = database.ref('chats/' + currentRoomId);
    
    chatsRef.once('value').then(snapshot => {
        const messages = snapshot.val();
        if (!messages) { return alert("분석할 대화 내용이 없습니다."); }
        let chatLog = Object.values(messages)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(msg => `${msg.senderNickname || '익명'}: ${msg.text}`)
            .join('\n');
        const analyzeDebate = functions.httpsCallable('analyzeDebateWithGemini');
        analyzeDebate({ chatLog })
            .then(result => {
                const formattedResult = JSON.stringify(result.data, null, 2);
                alert("AI 분석 완료!\n\n" + formattedResult);
            })
            .catch(error => {
                console.error("AI 분석 중 오류 발생:", error);
                alert(`AI 분석에 실패했습니다: ${error.message}`);
            });
    });
}

// --- 초기 이벤트 리스너 설정 ---
sendBtnElement.addEventListener('click', sendMessage);
chatInputElement.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendMessage();
});

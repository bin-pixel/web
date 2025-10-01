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
let currentRoomData = null;
let currentUserRole = '찬성측'; // !! 중요: 역할 시스템 구현 전 임시 역할 !!
let currentMemoType = 'personal';
let memoTimeout;

// DOM Elements
const roomTopicElement = document.getElementById('room-topic');
const roomOwnerInfoElement = document.getElementById('room-owner-info');
const ownerControlsElement = document.getElementById('owner-controls');
const nicknameAreaElement = document.getElementById('nickname-area');
const chatSection = document.getElementById('chat-section');
const memoSection = document.getElementById('memo-section');
const chatWindowElement = document.getElementById('chat-window');
const chatInputElement = document.getElementById('chat-input');
const sendBtnElement = document.getElementById('send-btn');
const memoPadElement = document.getElementById('memo-pad');
const personalMemoBtn = document.getElementById('personal-memo-btn');
const sharedMemoBtn = document.getElementById('shared-memo-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const toggleMemoBtn = document.getElementById('toggle-memo-btn');

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
            loadRoomInfo();
        } else {
            alert("토론방에 참여하려면 로그인이 필요합니다.");
            window.location.href = 'login.html';
        }
    });
});

// =================================================================
// 4. FEATURE IMPLEMENTATIONS
// =================================================================

function updateNicknameDisplay(nickname) {
    nicknameAreaElement.innerHTML = `내 아이디: <span>${nickname}</span>`;
}

function loadRoomInfo() {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.on('value', (snapshot) => {
        currentRoomData = snapshot.val();
        if (currentRoomData) {
            roomTopicElement.textContent = currentRoomData.topic;
            roomOwnerInfoElement.textContent = `진행자: ${currentRoomData.ownerNickname}`;
            
            if (currentUser && currentUser.uid === currentRoomData.ownerId) {
                ownerControlsElement.innerHTML = '<button id="ai-analysis-btn">이 토론 AI로 분석하기</button>';
                document.getElementById('ai-analysis-btn').addEventListener('click', startAiAnalysis);
            }
            
            const userNickname = currentUser.email.split('@')[0];
            updateNicknameDisplay(userNickname);
            loadChatMessages();
            setupMemoListeners();
            loadMemo('personal');

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

function sendMessage() {
    const messageText = chatInputElement.value.trim();
    const userNickname = currentUser.email.split('@')[0];
    if (messageText && currentUser && currentRoomId) {
        database.ref(`chats/${currentRoomId}`).push({
            senderId: currentUser.

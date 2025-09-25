const firebaseConfig = { /* ... 본인의 firebaseConfig 정보 ... */ };
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const functions = firebase.functions();
let currentUser = null;
let currentRoomId = null;
const roomTopicElement = document.getElementById('room-topic');
const roomOwnerInfoElement = document.getElementById('room-owner-info');
const ownerControlsElement = document.getElementById('owner-controls');
const chatWindowElement = document.getElementById('chat-window');
const chatInputElement = document.getElementById('chat-input');
const sendBtnElement = document.getElementById('send-btn');
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('id');
    if (!currentRoomId) {
        roomTopicElement.textContent = "오류: 방 ID를 찾을 수 없습니다.";
        return;
    }
    auth.signInAnonymously().then(() => {
        currentUser = auth.currentUser;
        loadRoomInfo();
        loadChatMessages();
    }).catch(error => {
        console.error("익명 로그인 실패:", error);
    });
});
function loadRoomInfo() { /* ... 이전 코드와 동일 ... */ }
function loadChatMessages() { /* ... 이전 코드와 동일 ... */ }
function displayChatMessage(message) { /* ... 이전 코드와 동일 ... */ }
function sendMessage() { /* ... 이전 코드와 동일 ... */ }
sendBtnElement.addEventListener('click', sendMessage);
chatInputElement.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});
function startAiAnalysis() { /* ... 이전 코드와 동일 ... */ }
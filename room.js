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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const functions = firebase.functions();

let currentUser = null;
let currentRoomId = null;
let currentRoomData = null;
let currentUserRoles = [];
let activeMemoPath = '';
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
const memoTabsContainer = document.getElementById('memo-tabs');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const toggleMemoBtn = document.getElementById('toggle-memo-btn');
const participantsListElement = document.getElementById('participants-list');

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
            joinRoom();
            loadRoomAndUserInfo();
        } else {
            alert("토론방에 참여하려면 로그인이 필요합니다.");
            window.location.href = 'login.html';
        }
    });
});

function joinRoom() {
    const userRef = database.ref(`rooms/${currentRoomId}/participants/${currentUser.uid}`);
    userRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            userRef.set({
                nickname: currentUser.email.split('@')[0],
                roles: ['관전자'] // 기본 역할
            });
        }
    });
}

function updateNicknameDisplay(nickname) {
    nicknameAreaElement.innerHTML = `내 아이디: <span>${nickname}</span>`;
}

function loadRoomAndUserInfo() {
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

            const myInfo = currentRoomData.participants?.[currentUser.uid];
            currentUserRoles = myInfo?.roles || (currentRoomData.roles['관전자'] ? ['관전자'] : []);

            applyPermissions();
            renderParticipants(currentRoomData.participants);
            renderMemoTabs();
            loadChatMessages();
        } else {
            roomTopicElement.textContent = "존재하지 않는 방입니다.";
        }
    });
}

function applyPermissions() {
    const finalPermissions = {
        canChat: currentUserRoles.some(role => currentRoomData.roles[role]?.canChat),
        canWriteAllSharedMemo: currentUserRoles.some(role => currentRoomData.roles[role]?.canWriteAllSharedMemo)
    };
    chatInputElement.disabled = !finalPermissions.canChat;
    chatInputElement.placeholder = finalPermissions.canChat ? "메시지를 입력하세요..." : "채팅 권한이 없습니다.";
    updateMemoWritePermission();
}

function renderParticipants(participants) {
    participantsListElement.innerHTML = '';
    for (const uid in participants) {
        const user = participants[uid];
        const userRoles = user.roles || [];
        const primaryRoleName = userRoles[0] || '관전자';
        const primaryRole = currentRoomData.roles[primaryRoleName] || { color: '#888888' };

        const li = document.createElement('li');
        li.textContent = user.nickname;
        li.style.color = primaryRole.color;
        
        if(currentUser.uid === currentRoomData.ownerId && currentUser.uid !== uid) {
            li.onclick = () => showRoleAssignment(uid, user.nickname, user.roles);
        }
        
        participantsListElement.appendChild(li);
    }
}

function showRoleAssignment(targetUid, targetNickname, currentRoles) {
    const availableRoles = Object.keys(currentRoomData.roles);
    const newRole = prompt(`${targetNickname}님에게 부여할 역할을 선택하세요:\n\n${availableRoles.join(', ')}\n\n현재 역할: ${currentRoles.join(', ')}`, currentRoles[0]);

    if (newRole && availableRoles.includes(newRole)) {
        database.ref(`rooms/${currentRoomId}/participants/${targetUid}/roles`).set([newRole]);
    } else if (newRole !== null) {
        alert("존재하지 않는 역할입니다.");
    }
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

    const senderInfo = currentRoomData.participants?.[message.senderId];
    if(senderInfo && senderInfo.roles && senderInfo.roles.length > 0) {
        const primaryRoleName = senderInfo.roles[0];
        const primaryRole = currentRoomData.roles?.[primaryRoleName];
        if(primaryRole) senderSpan.style.color = primaryRole.color;
    }

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
            senderId: currentUser.uid,
            senderNickname: userNickname,
            text: messageText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        chatInputElement.value = '';
    }
}

function setupMemoListeners() {
    toggleMemoBtn.addEventListener('click', () => {
        memoSection.classList.toggle('hidden');
        chatSection.classList.toggle('full-width');
    });

    memoPadElement.addEventListener('keyup', () => {
        clearTimeout(memoTimeout);
        memoTimeout = setTimeout(saveMemo, 300);
    });
}

function renderMemoTabs() {
    memoTabsContainer.innerHTML = '';
    const memoTabs = [
        { id: 'personal', name: '개인 메모' },
        { id: 'shared/all', name: '공유 (전체)' }
    ];

    currentUserRoles.forEach(role => {
        if (currentRoomData.roles[role]?.hasRoleSharedMemo) {
            memoTabs.push({ id: `shared/${role}`, name: `공유 (${role})` });
        }
    });

    memoTabs.forEach(tab => {
        const button = document.createElement('button');
        button.dataset.tabId = tab.id;
        button.textContent = tab.name;
        button.onclick = () => switchMemoTab(tab.id);
        memoTabsContainer.appendChild(button);
    });

    const currentTabExists = memoTabs.some(tab => getMemoPath(tab.id) === activeMemoPath);
    switchMemoTab(currentTabExists ? activeMemoPath.split('/').slice(2).join('/') : 'personal');
}

function switchMemoTab(tabId) {
    activeMemoPath = getMemoPath(tabId);
    
    memoTabsContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabId === tabId);
    });

    database.ref(activeMemoPath).off();
    loadMemo(activeMemoPath);
    updateMemoWritePermission();
}

function updateMemoWritePermission() {
    let canWrite = true;
    if (activeMemoPath.includes('/shared/all')) {
        canWrite = currentUserRoles.some(role => currentRoomData.roles[role]?.canWriteAllSharedMemo);
    } else if (activeMemoPath.includes('/shared/')) {
        const roleName = activeMemoPath.split('/').pop();
        canWrite = currentUserRoles.includes(roleName) && currentRoomData.roles[roleName]?.hasRoleSharedMemo;
    }
    memoPadElement.disabled = !canWrite;
    memoPadElement.placeholder = canWrite ? "여기에 메모를 작성하세요..." : "쓰기 권한이 없습니다.";
}

function getMemoPath(tabId) {
    if (tabId === 'personal') {
        return `memos/${currentRoomId}/personal/${currentUser.uid}`;
    } else {
        return `memos/${currentRoomId}/${tabId}`;
    }
}

function loadMemo(path) {
    database.ref(path).on('value', (snapshot) => {
        if (path === activeMemoPath) {
            memoPadElement.value = snapshot.val() || '';
        }
    });
}

function saveMemo() {
    if (activeMemoPath && !memoPadElement.disabled) {
        database.ref(activeMemoPath).set(memoPadElement.value);
    }
}

function startAiAnalysis() {
    // ... AI 분석 기능 코드는 이전과 동일
}

// --- 초기 이벤트 리스너 설정 ---
sendBtnElement.addEventListener('click', sendMessage);
chatInputElement.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendMessage();
});
leaveRoomBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

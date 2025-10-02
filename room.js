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
let activeChatChannel = 'all';
let typingTimeout;

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
const chatChannelsList = document.getElementById('chat-channels-list');
const typingIndicator = document.getElementById('typing-indicator');
const voteSection = document.getElementById('vote-section');
const inviteBtn = document.getElementById('invite-btn');

// 모달 DOM
const roomSettingsBtn = document.getElementById('room-settings-btn');
const roomSettingsModal = document.getElementById('room-settings-modal');
const roleAssignmentModal = document.getElementById('role-assignment-modal');
const aiResultModal = document.getElementById('ai-result-modal');

document.addEventListener('DOMContentLoaded', () => {
    const memoState = localStorage.getItem('memoState');
    if (memoState === 'hidden') {
        memoSection.classList.add('hidden');
        chatSection.classList.add('full-width');
    }
    
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
            setupTypingListeners();
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
            database.ref(`users/${currentUser.uid}/nickname`).once('value', (nickSnap) => {
                const nickname = nickSnap.val() || currentUser.email.split('@')[0];
                userRef.set({ nickname, roles: ['관전자'] });
            });
        }
    });
}

function loadRoomAndUserInfo() {
    const roomRef = database.ref('rooms/' + currentRoomId);
    roomRef.on('value', (snapshot) => {
        currentRoomData = snapshot.val();
        if (currentRoomData) {
            roomTopicElement.textContent = currentRoomData.topic;
            roomOwnerInfoElement.textContent = `진행자: ${currentRoomData.ownerNickname}`;
            
            const isOwner = currentUser.uid === currentRoomData.ownerId;
            ownerControlsElement.innerHTML = isOwner ? '<button id="ai-analysis-btn">이 토론 AI로 분석하기</button>' : '';
            if(isOwner) document.getElementById('ai-analysis-btn').addEventListener('click', startAiAnalysis);
            roomSettingsBtn.style.display = isOwner ? 'block' : 'none';

            const myInfo = currentRoomData.participants?.[currentUser.uid];
            if(myInfo) {
                updateNicknameDisplay(myInfo.nickname);
                currentUserRoles = myInfo.roles || (currentRoomData.roles['관전자'] ? ['관전자'] : []);
            }
            
            renderParticipants(currentRoomData.participants);
            renderChatChannels();
            renderMemoTabs();
            applyPermissions();
            loadChatMessages();
            renderVoteSection(currentRoomData.vote);
        } else {
            roomTopicElement.textContent = "존재하지 않는 방입니다.";
        }
    });

    const typingRef = database.ref(`typing/${currentRoomId}`);
    typingRef.on('value', snapshot => {
        const typingUsers = snapshot.val() || {};
        const now = Date.now();
        let indicatorText = '';
        const typers = [];
        for(const uid in typingUsers) {
            if(uid !== currentUser.uid && now - typingUsers[uid] < 3000) {
                const nickname = currentRoomData?.participants?.[uid]?.nickname || 'Someone';
                typers.push(nickname);
            }
        }
        if (typers.length > 0) {
            indicatorText = `${typers.join(', ')}님이 입력 중입니다...`;
        }
        typingIndicator.textContent = indicatorText;
    });
}

function updateNicknameDisplay(nickname) {
    nicknameAreaElement.innerHTML = `
        내 닉네임: <span>${nickname}</span>
        <button id="change-nickname-btn">변경</button>
    `;
    document.getElementById('change-nickname-btn').addEventListener('click', () => {
        const newNickname = prompt("새 닉네임을 입력하세요:", nickname);
        if (newNickname && newNickname.trim() !== '') {
            database.ref(`rooms/${currentRoomId}/participants/${currentUser.uid}/nickname`).set(newNickname.trim());
        }
    });
}

function renderParticipants(participants) {
    participantsListElement.innerHTML = '';
    const isOwner = currentUser.uid === currentRoomData.ownerId;

    for (const uid in participants) {
        const user = participants[uid];
        const userRoles = user.roles || [];
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'participant-name';
        nameSpan.textContent = user.nickname;
        
        const rolesDiv = document.createElement('div');
        rolesDiv.className = 'participant-roles';
        if (userRoles.length > 0) {
            userRoles.forEach(roleName => {
                const role = currentRoomData.roles[roleName];
                if (role) {
                    const roleTag = document.createElement('span');
                    roleTag.className = 'role-tag';
                    roleTag.textContent = roleName;
                    roleTag.style.backgroundColor = role.color;
                    rolesDiv.appendChild(roleTag);
                }
            });
            nameSpan.style.color = currentRoomData.roles[userRoles[0]]?.color || '#FFFFFF';
        } else {
            nameSpan.style.color = '#888888';
        }
        
        li.appendChild(nameSpan);
        li.appendChild(rolesDiv);
        
        if (isOwner) {
            li.onclick = () => showRoleAssignmentModal(uid, user.nickname, user.roles);
        }
        participantsListElement.appendChild(li);
    }
}

function showRoleAssignmentModal(targetUid, targetNickname, currentRoles) {
    const title = document.getElementById('role-assignment-title');
    const list = document.getElementById('role-assignment-list');
    const form = document.getElementById('role-assignment-form');
    
    title.textContent = `${targetNickname} 역할 할당`;
    list.innerHTML = '';
    const isSelf = targetUid === currentUser.uid;

    const availableRoles = Object.keys(currentRoomData.roles).filter(role => role !== '진행자');
    availableRoles.forEach(role => {
        const isChecked = currentRoles.includes(role);
        list.innerHTML += `<label><input type="checkbox" name="roles" value="${role}" ${isChecked ? 'checked' : ''}> ${role}</label>`;
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        let selectedRoles = Array.from(form.querySelectorAll('input[name="roles"]:checked')).map(cb => cb.value);
        if (isSelf) {
            selectedRoles = [...new Set(['진행자', ...selectedRoles])];
        }
        database.ref(`rooms/${currentRoomId}/participants/${targetUid}/roles`).set(selectedRoles);
        roleAssignmentModal.style.display = 'none';
    };
    
    roleAssignmentModal.querySelectorAll('.cancel-settings-btn').forEach(btn => {
        btn.onclick = () => roleAssignmentModal.style.display = 'none';
    });
    roleAssignmentModal.style.display = 'flex';
}

function setupTypingListeners() {
    chatInputElement.addEventListener('keyup', () => {
        clearTimeout(typingTimeout);
        const typingRef = database.ref(`typing/${currentRoomId}/${currentUser.uid}`);
        typingRef.set(Date.now());
        typingRef.onDisconnect().remove();
        typingTimeout = setTimeout(() => {
            typingRef.remove();
        }, 2000);
    });
}

function renderVoteSection(voteData) {
    voteSection.innerHTML = '';
    const isOwner = currentUser.uid === currentRoomData.ownerId;

    if (voteData && voteData.isActive) {
        voteSection.innerHTML = `<h5>${voteData.topic}</h5>`;
        const optionsDiv = document.createElement('div');
        optionsDiv.id = 'vote-options';
        
        for(const option in voteData.options) {
            const hasVoted = voteData.voters && voteData.voters[currentUser.uid];
            const button = document.createElement('button');
            button.textContent = option;
            button.disabled = hasVoted;
            button.onclick = () => castVote(option);
            optionsDiv.appendChild(button);

            const resultP = document.createElement('p');
            resultP.className = 'vote-result';
            resultP.textContent = `${option}: ${voteData.options[option]} 표`;
            optionsDiv.appendChild(resultP);
        }
        voteSection.appendChild(optionsDiv);
        
        if (isOwner) {
            const endBtn = document.createElement('button');
            endBtn.textContent = '투표 종료';
            endBtn.onclick = endVote;
            voteSection.appendChild(endBtn);
        }
    } else if (isOwner) {
        const startBtn = document.createElement('button');
        startBtn.textContent = '투표 시작하기';
        startBtn.onclick = startVote;
        voteSection.appendChild(startBtn);
    }
}

function startVote() {
    const topic = prompt("투표 주제를 입력하세요:");
    const optionsStr = prompt("투표 항목을 쉼표(,)로 구분하여 입력하세요:", "찬성, 반대");
    if (topic && optionsStr) {
        const options = {};
        optionsStr.split(',').forEach(opt => options[opt.trim()] = 0);
        database.ref(`rooms/${currentRoomId}/vote`).set({
            isActive: true, topic, options, voters: {}
        });
    }
}

function castVote(option) {
    const voteRef = database.ref(`rooms/${currentRoomId}/vote`);
    voteRef.transaction(currentData => {
        if (currentData && currentData.isActive && !currentData.voters?.[currentUser.uid]) {
            currentData.options[option]++;
            if (!currentData.voters) currentData.voters = {};
            currentData.voters[currentUser.uid] = true;
        }
        return currentData;
    });
}

function endVote() {
    database.ref(`rooms/${currentRoomId}/vote/isActive`).set(false);
}

function startAiAnalysis() {
    const analyzeBtn = document.getElementById('ai-analysis-btn');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';
    
    const allChatsRef = database.ref(`chats/${currentRoomId}`);
    allChatsRef.once('value').then(snapshot => {
        const allChannels = snapshot.val();
        if(!allChannels) {
            alert("분석할 대화 내용이 없습니다.");
            return;
        }
        
        let fullChatLog = "";
        // 모든 채널의 대화를 시간순으로 정렬하기 위해 배열에 담음
        let allMessages = [];
        for(const channel in allChannels) {
            for(const msgId in allChannels[channel]) {
                allMessages.push(allChannels[channel][msgId]);
            }
        }
        allMessages.sort((a,b) => a.timestamp - b.timestamp);
        fullChatLog = allMessages.map(msg => `${msg.senderNickname}: ${msg.text}`).join('\n');

        if(!fullChatLog) {
            alert("분석할 대화 내용이 없습니다.");
            return;
        }
        
        const analyzeDebate = functions.httpsCallable('analyzeDebateWithGemini');
        analyzeDebate({ chatLog: fullChatLog })
            .then(result => {
                document.getElementById('ai-result-content').textContent = result.data.summary;
                aiResultModal.style.display = 'flex';
            })
            .catch(error => alert(`AI 분석 실패: ${error.message}`))
            .finally(() => {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '이 토론 AI로 분석하기';
            });
    });
    
    document.getElementById('close-ai-result').onclick = () => {
        aiResultModal.style.display = 'none';
    };
}

toggleMemoBtn.addEventListener('click', () => {
    memoSection.classList.toggle('hidden');
    chatSection.classList.toggle('full-width');
    localStorage.setItem('memoState', memoSection.classList.contains('hidden') ? 'hidden' : 'visible');
});

inviteBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert("초대 링크가 클립보드에 복사되었습니다."))
        .catch(err => console.error('링크 복사 실패:', err));
});

// (채팅 채널, 메모장, 메시지 전송 등 나머지 함수들은 이전 답변과 동일하게 유지됩니다.)
// (이하 생략하지 않고 모두 포함)

function renderChatChannels() {
    chatChannelsList.innerHTML = '';
    const channels = [{ id: 'all', name: '💬 전체' }];
    currentUserRoles.forEach(role => {
        if (currentRoomData.roles[role]?.hasRoleChat) {
            channels.push({ id: role, name: `🔒 ${role}` });
        }
    });
    channels.forEach(channel => {
        const li = document.createElement('li');
        li.dataset.channelId = channel.id;
        li.textContent = channel.name;
        li.onclick = () => switchChatChannel(channel.id);
        chatChannelsList.appendChild(li);
    });
    updateActiveChannelStyle();
}

function switchChatChannel(channelId) {
    activeChatChannel = channelId;
    updateActiveChannelStyle();
    loadChatMessages();
    applyPermissions();
}

function updateActiveChannelStyle() {
    chatChannelsList.querySelectorAll('li').forEach(li => {
        li.classList.toggle('active', li.dataset.channelId === activeChatChannel);
    });
}

function applyPermissions() {
    let canWriteInCurrentChannel = false;
    if (activeChatChannel === 'all') {
        canWriteInCurrentChannel = currentUserRoles.some(role => currentRoomData.roles[role]?.canChat);
    } else {
        canWriteInCurrentChannel = currentUserRoles.includes(activeChatChannel) && currentRoomData.roles[activeChatChannel]?.hasRoleChat;
    }
    chatInputElement.disabled = !canWriteInCurrentChannel;
    chatInputElement.placeholder = canWriteInCurrentChannel ? `#${activeChatChannel} 채널에 메시지 보내기...` : "이 채널에 메시지를 쓸 권한이 없습니다.";
    updateMemoWritePermission();
}

function loadChatMessages() {
    database.ref().off('value'); // 모든 이전 리스너 해제
    const chatRef = database.ref(`chats/${currentRoomId}/${activeChatChannel}`).orderByChild('timestamp');
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
    if (senderInfo && senderInfo.roles && senderInfo.roles.length > 0) {
        const primaryRoleName = senderInfo.roles[0];
        const primaryRole = currentRoomData.roles?.[primaryRoleName];
        if (primaryRole) senderSpan.style.color = primaryRole.color;
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
    const myNickname = currentRoomData.participants?.[currentUser.uid]?.nickname || currentUser.email.split('@')[0];
    if (messageText && !chatInputElement.disabled) {
        database.ref(`chats/${currentRoomId}/${activeChatChannel}`).push({
            senderId: currentUser.uid,
            senderNickname: myNickname,
            text: messageText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        chatInputElement.value = '';
    }
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
    if(activeMemoPath) database.ref(activeMemoPath).off();
    activeMemoPath = getMemoPath(tabId);
    memoTabsContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tabId === tabId);
    });
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

sendBtnElement.addEventListener('click', sendMessage);
chatInputElement.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendMessage();
});
leaveRoomBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

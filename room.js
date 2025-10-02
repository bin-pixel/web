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
const roomSettingsBtn = document.getElementById('room-settings-btn');
const roomSettingsModal = document.getElementById('room-settings-modal');
const roomSettingsForm = document.getElementById('room-settings-form');
const settingsRolesList = document.getElementById('settings-roles-list');
const settingsAddRoleBtn = document.getElementById('settings-add-role-btn');
const roleAssignmentModal = document.getElementById('role-assignment-modal');
const aiResultModal = document.getElementById('ai-result-modal');

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('id');
    if (!currentRoomId) {
        roomTopicElement.textContent = "오류: 방 ID를 찾을 수 없습니다.";
        return;
    }
    
    const memoState = localStorage.getItem(`memoState_${currentRoomId}`);
    if (memoState === 'hidden') {
        memoSection.classList.add('hidden');
        chatSection.classList.add('full-width');
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
            } else {
                currentUserRoles = (currentRoomData.roles['관전자'] ? ['관전자'] : []);
            }
            
            renderParticipants(currentRoomData.participants);
            renderChatChannels();
            renderMemoTabs();
            applyPermissions();
            loadChatMessages();
            renderVoteSection(currentRoomData.vote);
        } else {
            document.body.innerHTML = '<h1>존재하지 않거나 삭제된 방입니다.</h1><a href="index.html">메인으로 돌아가기</a>';
        }
    });

    const typingRef = database.ref(`typing/${currentRoomId}`);
    typingRef.on('value', snapshot => {
        const typingUsers = snapshot.val() || {};
        const now = Date.now();
        const typers = [];
        for(const uid in typingUsers) {
            if(uid !== currentUser.uid && now - typingUsers[uid] < 3000) {
                const nickname = currentRoomData?.participants?.[uid]?.nickname || 'Someone';
                typers.push(nickname);
            }
        }
        typingIndicator.textContent = typers.length > 0 ? `${typers.join(', ')}님이 입력 중입니다...` : '';
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
            let isTaken = false;
            for(const uid in currentRoomData.participants) {
                if(currentRoomData.participants[uid].nickname === newNickname.trim()) {
                    isTaken = true;
                    break;
                }
            }
            if(isTaken) {
                alert("이미 사용 중인 닉네임입니다.");
            } else {
                database.ref(`rooms/${currentRoomId}/participants/${currentUser.uid}/nickname`).set(newNickname.trim());
            }
        }
    });
}

function renderParticipants(participants) {
    participantsListElement.innerHTML = '';
    const isOwner = currentUser.uid === currentRoomData.ownerId;
    if (!participants) return;

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
            analyzeBtn.disabled = false; analyzeBtn.textContent = '이 토론 AI로 분석하기';
            return;
        }
        
        let allMessages = [];
        for(const channel in allChannels) {
            for(const msgId in allChannels[channel]) {
                allMessages.push(allChannels[channel][msgId]);
            }
        }
        allMessages.sort((a,b) => a.timestamp - b.timestamp);
        const fullChatLog = allMessages.map(msg => `${msg.senderNickname}: ${msg.text}`).join('\n');

        if(!fullChatLog) {
            alert("분석할 대화 내용이 없습니다.");
            analyzeBtn.disabled = false; analyzeBtn.textContent = '이 토론 AI로 분석하기';
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
    localStorage.setItem(`memoState_${currentRoomId}`, memoSection.classList.contains('hidden') ? 'hidden' : 'visible');
});

inviteBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert("초대 링크가 클립보드에 복사되었습니다."))
        .catch(err => console.error('링크 복사 실패:', err));
});

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
    const chatRef = database.ref(`chats/${currentRoomId}/${activeChatChannel}`);
    chatRef.orderByChild('timestamp').on('value', (snapshot) => {
        chatWindowElement.innerHTML = '';
        const messages = snapshot.val();
        if (messages) {
            Object.values(messages).forEach(displayChatMessage);
        }
        if(chatWindowElement.scrollHeight - chatWindowElement.scrollTop < chatWindowElement.clientHeight + 200) {
            chatWindowElement.scrollTop = chatWindowElement.scrollHeight;
        }
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
        database.ref(`typing/${currentRoomId}/${currentUser.uid}`).remove();
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
    const currentTabId = activeMemoPath ? activeMemoPath.split('/').slice(2).join('/') : 'personal';
    const currentTabExists = memoTabs.some(tab => tab.id === currentTabId);
    switchMemoTab(currentTabExists ? currentTabId : 'personal');
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
    database.ref(`typing/${currentRoomId}/${currentUser.uid}`).remove();
    window.location.href = 'index.html';
});

// 방 설정 모달 로직
roomSettingsBtn.addEventListener('click', () => {
    const roles = currentRoomData.roles || {};
    settingsRolesList.innerHTML = '';
    
    for(const roleName in roles) {
        if(roleName === '진행자') continue;
        addRoleInputToSettings(roleName, roles[roleName]);
    }
    roomSettingsModal.style.display = 'flex';
});

settingsAddRoleBtn.addEventListener('click', () => {
    addRoleInputToSettings();
});

function addRoleInputToSettings(name = '', roleData = {}) {
    const permissions = {
        canChat: roleData.canChat !== false,
        canWriteAllSharedMemo: !!roleData.canWriteAllSharedMemo,
        hasRoleSharedMemo: !!roleData.hasRoleSharedMemo,
        hasRoleChat: !!roleData.hasRoleChat
    };
    const color = roleData.color || '#ffffff';
    const li = document.createElement('li');
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = color;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = '역할 이름';
    nameInput.value = name;
    nameInput.required = true;
    const permissionsDiv = document.createElement('div');
    permissionsDiv.className = 'permissions';
    permissionsDiv.innerHTML = `
        <label title="전체 채팅에 글을 쓸 수 있습니다."><input type="checkbox" class="perm-canChat" ${permissions.canChat ? 'checked' : ''}>전체 채팅</label>
        <label title="모두가 함께 쓰는 '공유 (전체)' 메모장을 수정할 수 있습니다."><input type="checkbox" class="perm-canWriteAllSharedMemo" ${permissions.canWriteAllSharedMemo ? 'checked' : ''}>전체 메모</label>
        <label title="이 역할끼리만 사용하는 별도의 공유 메모장이 생성됩니다."><input type="checkbox" class="perm-hasRoleSharedMemo" ${permissions.hasRoleSharedMemo ? 'checked' : ''}>역할 메모</label>
        <label title="이 역할끼리만 사용하는 별도의 채팅 채널이 생성됩니다."><input type="checkbox" class="perm-hasRoleChat" ${permissions.hasRoleChat ? 'checked' : ''}>역할 채팅</label>
    `;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '삭제';
    removeBtn.onclick = () => li.remove();
    li.appendChild(colorInput);
    li.appendChild(nameInput);
    li.appendChild(permissionsDiv);
    li.appendChild(removeBtn);
    settingsRolesList.appendChild(li);
}

roomSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newRoles = { ...currentRoomData.roles };
    const roleItems = settingsRolesList.querySelectorAll('li');
    const roleNamesOnScreen = new Set();
    let hasDuplicate = false;

    roleItems.forEach(item => {
        const roleName = item.querySelector('input[type="text"]').value.trim();
        if(roleNamesOnScreen.has(roleName)) {
            hasDuplicate = true;
        }
        roleNamesOnScreen.add(roleName);
    });

    if (hasDuplicate) {
        alert("중복된 역할 이름이 있습니다. 각 역할의 이름은 고유해야 합니다.");
        return;
    }

    const deletedRoles = Object.keys(newRoles).filter(role => role !== '진행자' && !roleNamesOnScreen.has(role));
    deletedRoles.forEach(roleName => delete newRoles[roleName]);

    roleItems.forEach(item => {
        const roleName = item.querySelector('input[type="text"]').value.trim();
        if (roleName) {
            newRoles[roleName] = {
                color: item.querySelector('input[type="color"]').value,
                canChat: item.querySelector('.perm-canChat').checked,
                canWriteAllSharedMemo: item.querySelector('.perm-canWriteAllSharedMemo').checked,
                hasRoleSharedMemo: item.querySelector('.perm-hasRoleSharedMemo').checked,
                hasRoleChat: item.querySelector('.perm-hasRoleChat').checked
            };
        }
    });

    await database.ref(`rooms/${currentRoomId}/roles`).set(newRoles);

    if (deletedRoles.length > 0) {
        const participantsRef = database.ref(`rooms/${currentRoomId}/participants`);
        participantsRef.transaction(participants => {
            if (participants) {
                for (const uid in participants) {
                    if (participants[uid].roles) {
                        participants[uid].roles = participants[uid].roles.filter(role => !deletedRoles.includes(role));
                    }
                }
            }
            return participants;
        });
    }
    
    roomSettingsModal.style.display = 'none';
});

roomSettingsModal.querySelectorAll('.cancel-settings-btn').forEach(btn => {
    btn.onclick = () => roomSettingsModal.style.display = 'none';
});

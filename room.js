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
let currentReplyTo = null; // *** [NEW] 답장 상태를 저장할 변수 ***

// DOM Elements
const roomContainer = document.getElementById('room-container');
const roomTopicElement = document.getElementById('room-topic');
const roomOwnerInfoElement = document.getElementById('room-owner-info');
const ownerControlsElement = document.getElementById('owner-controls');
const nicknameAreaElement = document.getElementById('nickname-area');
const chatSection = document.getElementById('chat-section');
const memoSection = document.getElementById('memo-section');
const participantsSection = document.getElementById('participants-section');
const chatWindowElement = document.getElementById('chat-window');
const chatInputElement = document.getElementById('chat-input');
const sendBtnElement = document.getElementById('send-btn');
const memoPadElement = document.getElementById('memo-pad');
const memoTabsContainer = document.getElementById('memo-tabs');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const participantsListElement = document.getElementById('participants-list');
const chatChannelsList = document.getElementById('chat-channels-list');
const typingIndicator = document.getElementById('typing-indicator');
const voteSection = document.getElementById('vote-section');
const inviteBtn = document.getElementById('invite-btn');

// 모바일 토글 버튼
const toggleParticipantsBtn = document.getElementById('toggle-participants-btn');
const toggleMemoBtnMobile = document.getElementById('toggle-memo-btn-mobile');
const toggleMemoBtnPc = document.getElementById('toggle-memo-btn-pc');

// 모달 DOM
const roomSettingsBtn = document.getElementById('room-settings-btn');
const roomSettingsModal = document.getElementById('room-settings-modal');
const roomSettingsForm = document.getElementById('room-settings-form');
const settingsRolesList = document.getElementById('settings-roles-list');
const settingsAddRoleBtn = document.getElementById('settings-add-role-btn');
const roleAssignmentModal = document.getElementById('role-assignment-modal');
const kickUserBtn = document.getElementById('kick-user-btn');

// 결론 기능 DOM
const conclusionModal = document.getElementById('conclusion-modal');
const conclusionForm = document.getElementById('conclusion-form');
const conclusionTextarea = document.getElementById('conclusion-textarea');
const conclusionSummaryBox = document.getElementById('conclusion-summary-box');
const conclusionSummaryText = document.getElementById('conclusion-summary-text');

// *** [NEW] 답장 미리보기 DOM ***
const replyPreviewBar = document.getElementById('reply-preview-bar');
const replyPreviewContent = document.getElementById('reply-preview-content');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('id');
    if (!currentRoomId) {
        roomTopicElement.textContent = "오류: 방 ID를 찾을 수 없습니다.";
        return;
    }
    
    const memoState = localStorage.getItem(`memoState_${currentRoomId}`);
    if (memoState === 'hidden' && window.innerWidth > 768) { 
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

    toggleMemoBtnMobile.addEventListener('click', toggleMemoPanel);
    toggleMemoBtnPc.addEventListener('click', toggleMemoPanel);
    toggleParticipantsBtn.addEventListener('click', toggleParticipantsPanel);

    // 결론 모달 닫기
    conclusionModal.querySelectorAll('.cancel-settings-btn').forEach(btn => {
        btn.onclick = () => conclusionModal.style.display = 'none';
    });
    conclusionForm.addEventListener('submit', handleConclusionSubmit);

    // *** [NEW] 답장 취소 이벤트 ***
    cancelReplyBtn.addEventListener('click', cancelReplyMode);
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
            const isConcluded = currentRoomData.isConcluded;

            // --- 방장 컨트롤 (결론/저장 버튼) ---
            ownerControlsElement.innerHTML = ''; // 초기화
            if (isOwner) {
                if (!isConcluded) {
                    const concludeBtn = document.createElement('button');
                    concludeBtn.id = 'conclude-btn';
                    concludeBtn.textContent = '토론 결론내기';
                    concludeBtn.onclick = () => conclusionModal.style.display = 'flex';
                    ownerControlsElement.appendChild(concludeBtn);
                }
                const downloadLogBtn = document.createElement('button');
                downloadLogBtn.id = 'download-log-btn';
                downloadLogBtn.textContent = '토론 기록 저장';
                downloadLogBtn.onclick = downloadChatLog;
                ownerControlsElement.appendChild(downloadLogBtn);
            }
            roomSettingsBtn.style.display = (isOwner && !isConcluded) ? 'block' : 'none';

            // --- 결론 요약 창 표시 ---
            if (isConcluded && currentRoomData.conclusion) {
                conclusionSummaryBox.style.display = 'block';
                conclusionSummaryText.textContent = currentRoomData.conclusion;
            } else {
                conclusionSummaryBox.style.display = 'none';
            }

            // --- 참여자 정보 및 강퇴 확인 ---
            const myInfo = currentRoomData.participants?.[currentUser.uid];
            if(myInfo) {
                updateNicknameDisplay(myInfo.nickname);
                currentUserRoles = myInfo.roles || (currentRoomData.roles['관전자'] ? ['관전자'] : []);
            } else if (currentRoomData.participants) { 
                 document.body.innerHTML = '<h1>방에서 퇴장당했습니다.</h1><a href="index.html">메인으로 돌아가기</a>';
                 return;
            } else {
                currentUserRoles = (currentRoomData.roles['관전자'] ? ['관전자'] : []);
            }
            
            renderParticipants(currentRoomData.participants);
            renderChatChannels();
            renderMemoTabs();
            applyPermissions(); // 권한 적용 (결론 상태 포함)
            loadChatMessages();
            renderVoteSection(currentRoomData.vote);

            // --- 결론난 방은 모든 기능 잠금 ---
            if (isConcluded) {
                chatInputElement.placeholder = '결론이 난 토론입니다.';
                chatInputElement.disabled = true;
                memoPadElement.placeholder = '결론이 난 토론입니다.';
                memoPadElement.disabled = true;
                cancelReplyMode(); // 답장 모드 강제 해제
            }

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
    const changeBtn = document.getElementById('change-nickname-btn');
    changeBtn.addEventListener('click', () => {
        if (currentRoomData.isConcluded) {
            alert("결론이 난 토론에서는 닉네임을 변경할 수 없습니다.");
            return;
        }
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
    if (currentRoomData.isConcluded) {
        changeBtn.disabled = true;
    }
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
        
        if (isOwner && !currentRoomData.isConcluded) {
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
    const isOwner = currentUser.uid === currentRoomData.ownerId;

    if (isOwner && !isSelf) {
        kickUserBtn.style.display = 'block';
        kickUserBtn.onclick = () => handleKickUser(targetUid, targetNickname);
    } else {
        kickUserBtn.style.display = 'none';
    }

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

function handleKickUser(targetUid, targetNickname) {
    if (confirm(`${targetNickname}님을 정말로 강퇴하시겠습니까?`)) {
        const kickUser = functions.httpsCallable('kickUser');
        kickUser({ roomId: currentRoomId, targetUid: targetUid })
            .then(result => {
                alert(result.data.message);
                roleAssignmentModal.style.display = 'none';
            })
            .catch(error => {
                alert(`강퇴 실패: ${error.message}`);
            });
    }
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
    const isConcluded = currentRoomData.isConcluded;

    if (voteData && voteData.isActive) {
        voteSection.innerHTML = `<h5>${voteData.topic}</h5>`;
        const optionsDiv = document.createElement('div');
        optionsDiv.id = 'vote-options';
        
        for(const option in voteData.options) {
            const hasVoted = voteData.voters && voteData.voters[currentUser.uid];
            const button = document.createElement('button');
            button.textContent = option;
            button.disabled = hasVoted || isConcluded;
            button.onclick = () => castVote(option);
            optionsDiv.appendChild(button);

            const resultP = document.createElement('p');
            resultP.className = 'vote-result';
            resultP.textContent = `${option}: ${voteData.options[option]} 표`;
            optionsDiv.appendChild(resultP);
        }
        voteSection.appendChild(optionsDiv);
        
        if (isOwner && !isConcluded) { 
            const endBtn = document.createElement('button');
            endBtn.textContent = '투표 종료';
            endBtn.onclick = endVote;
            voteSection.appendChild(endBtn);
        }
    } else if (isOwner && !isConcluded) { 
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

async function downloadChatLog() {
    try {
        const chatsSnapshot = await database.ref(`chats/${currentRoomId}`).once('value');
        const allChannels = chatsSnapshot.val();
        if (!allChannels) {
            alert("저장할 채팅 기록이 없습니다.");
            return;
        }

        let allMessages = [];
        for (const channelName in allChannels) {
            const messages = allChannels[channelName];
            for (const msgId in messages) {
                allMessages.push({
                    channel: channelName,
                    ...messages[msgId]
                });
            }
        }

        allMessages.sort((a, b) => a.timestamp - b.timestamp);

        let logContent = `토론 주제: ${currentRoomData.topic}\n`;
        logContent += `진행자: ${currentRoomData.ownerNickname}\n`;
        logContent += `토론 생성일: ${new Date(currentRoomData.createdAt).toLocaleString()}\n\n`;

        if (currentRoomData.isConcluded && currentRoomData.conclusion) {
            logContent += `--- 최종 결론 ---\n${currentRoomData.conclusion}\n\n`;
        }
        logContent += "--- 전체 대화 기록 ---\n";

        allMessages.forEach(msg => {
            const time = new Date(msg.timestamp).toLocaleString();
            let msgText = msg.text;
            // [NEW] 답장 기록도 로그에 추가
            if (msg.replyTo) {
                msgText = `(답장: ${msg.replyTo.senderNickname}: ${msg.replyTo.text}) ${msgText}`;
            }
            logContent += `[${time}] [${msg.channel} 채널] ${msg.senderNickname}: ${msgText}\n`;
        });

        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${currentRoomData.topic.replace(/[^a-z0-9ㄱ-힣]/gi, '_')}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("채팅 기록 저장 실패:", error);
        alert("채팅 기록을 저장하는 중 오류가 발생했습니다.");
    }
}

function handleConclusionSubmit(e) {
    e.preventDefault();
    const conclusionText = conclusionTextarea.value.trim();
    if (!conclusionText) {
        alert("결론 요약 내용을 입력해주세요.");
        return;
    }

    if (confirm("결론을 게시하면 토론방이 영구적으로 잠깁니다. 계속하시겠습니까?")) {
        database.ref(`rooms/${currentRoomId}`).update({
            isConcluded: true,
            conclusion: conclusionText
        })
        .then(() => {
            conclusionModal.style.display = 'none';
            conclusionTextarea.value = '';
        })
        .catch(error => {
            alert(`결론 게시 실패: ${error.message}`);
        });
    }
}


function toggleMemoPanel() {
    if (window.innerWidth <= 768) {
        roomContainer.classList.toggle('show-memo');
        roomContainer.classList.remove('show-participants');
    } else {
        memoSection.classList.toggle('hidden');
        chatSection.classList.toggle('full-width');
        localStorage.setItem(`memoState_${currentRoomId}`, memoSection.classList.contains('hidden') ? 'hidden' : 'visible');
    }
}

function toggleParticipantsPanel() {
    roomContainer.classList.toggle('show-participants');
    roomContainer.classList.remove('show-memo');
}

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
    if (currentRoomData.isConcluded) return; 

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
            // *** [MODIFIED] 메시지 ID를 함께 전달 ***
            Object.keys(messages).forEach(messageId => {
                displayChatMessage(messageId, messages[messageId]);
            });
        }
        if(chatWindowElement.scrollHeight - chatWindowElement.scrollTop < chatWindowElement.clientHeight + 200) {
            chatWindowElement.scrollTop = chatWindowElement.scrollHeight;
        }
    });
}

// *** [MODIFIED] 답장 UI를 표시하도록 수정 ***
function displayChatMessage(messageId, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    messageElement.classList.add(message.senderId === currentUser.uid ? 'my-message' : 'other-message');
    messageElement.id = `msg-${messageId}`; // 메시지 요소에 ID 부여

    // --- [NEW] 답장 UI 생성 ---
    if (message.replyTo) {
        const replyContext = document.createElement('div');
        replyContext.className = 'reply-context';
        replyContext.innerHTML = `
            <span class="reply-sender">Replying to ${message.replyTo.senderNickname}</span>
            <span class="reply-text">${message.replyTo.text}</span>
        `;
        // 답장 원본 메시지로 스크롤 이동 기능
        replyContext.onclick = () => {
            const originalMessage = document.getElementById(`msg-${message.replyTo.msgId}`);
            if (originalMessage) {
                originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                originalMessage.style.transition = 'background-color 0.5s';
                originalMessage.style.backgroundColor = 'rgba(137, 177, 246, 0.3)';
                setTimeout(() => {
                    originalMessage.style.backgroundColor = '';
                }, 1000);
            }
        };
        messageElement.appendChild(replyContext);
    }

    // --- 기존 메시지 UI ---
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

    // --- [NEW] 답장 버튼 생성 ---
    if (!currentRoomData.isConcluded) { // 결론난 방이 아닐 때만
        const replyBtn = document.createElement('button');
        replyBtn.className = 'reply-btn';
        replyBtn.innerHTML = '↪';
        replyBtn.title = '답장하기';
        replyBtn.onclick = () => {
            setReplyMode(messageId, message.senderNickname, message.text);
        };
        messageElement.appendChild(replyBtn);
    }

    chatWindowElement.appendChild(messageElement);
}

// *** [MODIFIED] 답장 정보를 포함하여 메시지 전송 ***
function sendMessage() {
    const messageText = chatInputElement.value.trim();
    const myNickname = currentRoomData.participants?.[currentUser.uid]?.nickname || currentUser.email.split('@')[0];
    
    if (messageText && !chatInputElement.disabled) {
        
        const messageData = {
            senderId: currentUser.uid,
            senderNickname: myNickname,
            text: messageText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        // [NEW] 답장 모드인 경우, 답장 정보 추가
        if (currentReplyTo) {
            messageData.replyTo = currentReplyTo;
        }

        database.ref(`chats/${currentRoomId}/${activeChatChannel}`).push(messageData);
        
        chatInputElement.value = '';
        database.ref(`typing/${currentRoomId}/${currentUser.uid}`).remove();
        cancelReplyMode(); // 메시지 전송 후 답장 모드 해제
    }
}

// --- [NEW] 답장 관련 함수들 ---
function setReplyMode(msgId, senderNickname, text) {
    if (!msgId || !senderNickname || !text) return;

    currentReplyTo = {
        msgId: msgId,
        senderNickname: senderNickname,
        text: text.substring(0, 50) + (text.length > 50 ? '...' : '') // 50자 미리보기
    };
    
    replyPreviewContent.innerHTML = `
        Replying to <strong>${senderNickname}</strong>
        <span>${currentReplyTo.text}</span>
    `;
    replyPreviewBar.style.display = 'flex';
    chatInputElement.focus();
}

function cancelReplyMode() {
    currentReplyTo = null;
    replyPreviewBar.style.display = 'none';
}

// (이하 나머지 함수들은 1-2단계에서 수정한 내용 그대로입니다)
// ...
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
    if (currentRoomData.isConcluded) return;

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
        return `mGemos/${currentRoomId}/personal/${currentUser.uid}`;
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

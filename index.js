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

const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const profileBtn = document.getElementById('profile-btn');
const logoutBtn = document.getElementById('logout-btn');

const createRoomModal = document.getElementById('create-room-modal');
const createRoomForm = document.getElementById('create-room-form');
const roomTopicInput = document.getElementById('room-topic-input');
const rolesList = document.getElementById('roles-list');
const addRoleBtn = document.getElementById('add-role-btn');
const cancelCreateBtn = document.getElementById('cancel-create-btn');
const isPrivateCheckbox = document.getElementById('is-private-checkbox');

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
let currentUser = null; 

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        createRoomBtn.disabled = false;
        logoutBtn.style.display = 'inline-block';
        loadRooms();
    } else {
        window.location.href = 'login.html';
    }
});

profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

createRoomBtn.addEventListener('click', () => {
    rolesList.innerHTML = '';
    addRoleInput('찬성측', '#4a90e2', { canChat: true, canWriteAllSharedMemo: true, hasRoleSharedMemo: true, hasRoleChat: true });
    addRoleInput('반대측', '#f5a623', { canChat: true, canWriteAllSharedMemo: true, hasRoleSharedMemo: true, hasRoleChat: true });
    addRoleInput('관전자', '#888888', { canChat: true, canWriteAllSharedMemo: false, hasRoleSharedMemo: false, hasRoleChat: false });
    createRoomModal.style.display = 'flex';
});

cancelCreateBtn.addEventListener('click', () => {
    createRoomModal.style.display = 'none';
});

addRoleBtn.addEventListener('click', () => {
    addRoleInput();
});

function addRoleInput(name = '', color = '#ffffff', permissions = { canChat: true, canWriteAllSharedMemo: false, hasRoleSharedMemo: false, hasRoleChat: false }) {
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
    rolesList.appendChild(li);
}

createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = roomTopicInput.value.trim();
    const isPrivate = isPrivateCheckbox.checked;
    
    database.ref(`users/${currentUser.uid}/nickname`).once('value', (snapshot) => {
        const ownerNickname = snapshot.val() || currentUser.email.split('@')[0];
        const roles = {};

        const roleInputs = rolesList.querySelectorAll('li');
        let hasDuplicate = false;
        const roleNames = new Set();
        roleInputs.forEach(item => {
            const roleName = item.querySelector('input[type="text"]').value.trim();
            if(roleNames.has(roleName)) {
                hasDuplicate = true;
            }
            roleNames.add(roleName);
        });

        if (hasDuplicate) {
            alert("중복된 역할 이름이 있습니다. 각 역할의 이름은 고유해야 합니다.");
            return;
        }

        roleInputs.forEach(item => {
            const roleName = item.querySelector('input[type="text"]').value.trim();
            if (roleName) {
                roles[roleName] = {
                    color: item.querySelector('input[type="color"]').value,
                    canChat: item.querySelector('.perm-canChat').checked,
                    canWriteAllSharedMemo: item.querySelector('.perm-canWriteAllSharedMemo').checked,
                    hasRoleSharedMemo: item.querySelector('.perm-hasRoleSharedMemo').checked,
                    hasRoleChat: item.querySelector('.perm-hasRoleChat').checked
                };
            }
        });

        if (topic && Object.keys(roles).length > 0) {
            roles['진행자'] = { color: '#aa88ff', canChat: true, canWriteAllSharedMemo: true, hasRoleSharedMemo: false, hasRoleChat: true, isOwner: true };

            database.ref('rooms').push({
                topic,
                ownerId: currentUser.uid,
                ownerNickname,
                isPrivate,
                createdAt: new Date().toISOString(),
                roles,
                participants: {
                    [currentUser.uid]: { nickname: ownerNickname, roles: ['진행자'] }
                }
            });
            createRoomModal.style.display = 'none';
            createRoomForm.reset();
        } else {
            alert("주제와 하나 이상의 역할을 입력해야 합니다.");
        }
    });
});

function deleteRoom(roomId, roomTopic) {
    if (confirm(`'${roomTopic}' 방을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        const updates = {};
        updates[`/rooms/${roomId}`] = null;
        updates[`/chats/${roomId}`] = null;
        updates[`/memos/${roomId}`] = null;
        updates[`/typing/${roomId}`] = null;
        database.ref().update(updates);
    }
}

function loadRooms() {
    const roomsRef = database.ref('rooms');
    roomsRef.on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomListElement.innerHTML = '<h2>진행중인 토론</h2>';

        if (rooms) {
            let hasRooms = false;
            for (const roomId in rooms) {
                const room = rooms[roomId];
                if (!room || typeof room !== 'object') continue;
                if (room.isPrivate) continue;

                hasRooms = true;
                const topic = room.topic || '이름 없는 토론방';
                const ownerNickname = room.ownerNickname || '알 수 없음';
                
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'room-card-info';
                infoDiv.innerHTML = `<h3>${topic}</h3><p>진행자: ${ownerNickname}</p>`;

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'room-card-buttons';
                const enterButton = document.createElement('button');
                enterButton.textContent = '입장하기';
                enterButton.onclick = () => { window.location.href = `room.html?id=${roomId}`; };
                buttonsDiv.appendChild(enterButton);

                if (currentUser && room.ownerId === currentUser.uid) {
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'delete-btn';
                    deleteButton.textContent = '삭제';
                    deleteButton.onclick = () => deleteRoom(roomId, topic);
                    buttonsDiv.appendChild(deleteButton);
                }
                
                roomCard.appendChild(infoDiv);
                roomCard.appendChild(buttonsDiv);
                roomListElement.appendChild(roomCard);
            }
            if (!hasRooms) {
                roomListElement.innerHTML += '<p>진행중인 공개 토론이 없습니다.</p>';
            }
        } else {
            roomListElement.innerHTML += '<p>진행중인 토론이 없습니다.</p>';
        }
    });
}

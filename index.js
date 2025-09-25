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
// 2. DOM ELEMENTS & INITIALIZATION
// =================================================================
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const headerElement = document.querySelector('.header');

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
let currentUser = null; 

// =================================================================
// 3. AUTHENTICATION
// =================================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        // 사용자가 로그인한 경우
        currentUser = user;
        console.log('로그인 상태:', currentUser.email);
        createRoomBtn.disabled = false;
        loadRooms();
        addLogoutButton();
    } else {
        // 사용자가 로그아웃했거나, 로그인하지 않은 경우
        console.log('로그아웃 상태 또는 로그인 필요');
        window.location.href = 'login.html'; // 로그인 페이지로 리디렉션
    }
});

function addLogoutButton() {
    // 로그아웃 버튼이 이미 있는지 확인하여 중복 생성 방지
    if (document.getElementById('logout-btn')) return;

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.onclick = () => auth.signOut();
    headerElement.appendChild(logoutBtn);
}

// =================================================================
// 4. ROOM MANAGEMENT FUNCTIONS
// =================================================================
createRoomBtn.addEventListener('click', () => {
    const topic = prompt("새 토론방의 주제를 입력하세요:");
    const ownerNickname = currentUser.email.split('@')[0];

    if (topic && topic.trim() !== '') {
        database.ref('rooms').push({
            topic: topic,
            ownerId: currentUser.uid, 
            ownerNickname: ownerNickname,
            createdAt: new Date().toISOString()
        });
    } else if (topic !== null) {
        alert("토론 주제를 입력해야 합니다.");
    }
});

function deleteRoom(roomId, roomTopic) {
    if (confirm(`'${roomTopic}' 방을 정말 삭제하시겠습니까?`)) {
        database.ref('rooms/' + roomId).remove();
    }
}

// =================================================================
// 5. DATA READING (DISPLAY ROOMS)
// =================================================================
function loadRooms() {
    const roomsRef = database.ref('rooms');
    roomsRef.on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomListElement.innerHTML = '<h2>진행중인 토론</h2>';

        if (rooms) {
            for (const roomId in rooms) {
                const room = rooms[roomId];

                if (!room || typeof room !== 'object') continue;

                const topic = room.topic || '이름 없는 토론방';
                const ownerNickname = room.ownerNickname || '알 수 없음';
                
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'room-card-info';
                infoDiv.innerHTML = `<h3>${topic}</h3><p>진행자: ${ownerNickname}</p>`;

                const buttonsDiv = document.createElement('div');

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
        } else {
            roomListElement.innerHTML += '<p>진행중인 토론이 없습니다. 첫 토론방을 만들어보세요!</p>';
        }
    });
}

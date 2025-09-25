// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = { /* ... 본인의 firebaseConfig 정보 ... */ };


// =================================================================
// 2. DOM ELEMENTS & INITIALIZATION
// =================================================================
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
let currentUser = null; 

auth.signInAnonymously()
  .then(() => {
    currentUser = auth.currentUser;
    console.log('익명 로그인 성공! UID:', currentUser.uid);
    createRoomBtn.disabled = false;
    loadRooms(); 
  })
  .catch((error) => {
    console.error("Firebase 익명 로그인 실패:", error);
    alert("Firebase 인증에 실패했습니다. Config 정보가 올바른지 다시 확인해주세요.");
  });


// =================================================================
// 3. ROOM MANAGEMENT FUNCTIONS
// =================================================================
createRoomBtn.addEventListener('click', () => {
    const topic = prompt("새 토론방의 주제를 입력하세요:");
    if (topic && topic.trim() !== '') {
        database.ref('rooms').push({
            topic: topic,
            ownerId: currentUser.uid, 
            ownerNickname: "익명의 진행자",
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
// 4. DATA READING (DISPLAY ROOMS) - **수정된 핵심 부분**
// =================================================================
function loadRooms() {
    const roomsRef = database.ref('rooms');
    roomsRef.on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomListElement.innerHTML = '<h2>진행중인 토론</h2>';

        if (rooms) {
            for (const roomId in rooms) {
                const room = rooms[roomId];

                // **[방어 코드 1]** room 데이터가 객체가 아니거나 비어있으면 건너뜁니다.
                if (!room || typeof room !== 'object') {
                    continue; 
                }

                // **[방어 코드 2]** 각 데이터가 없을 경우를 대비해 기본값을 설정합니다.
                const topic = room.topic || '이름 없는 토론방';
                const ownerNickname = room.ownerNickname || '알 수 없음';
                const ownerId = room.ownerId || null;

                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'room-card-info';
                infoDiv.innerHTML = `
                    <h3>${topic}</h3>
                    <p>진행자: ${ownerNickname}</p>
                `;

                const buttonsDiv = document.createElement('div');

                const enterButton = document.createElement('button');
                enterButton.textContent = '입장하기';
                enterButton.onclick = () => {
                    window.location.href = `room.html?id=${roomId}`;
                };
                buttonsDiv.appendChild(enterButton);

                // **[방어 코드 3]** ownerId가 존재할 경우에만 삭제 버튼을 비교하고 추가합니다.
                if (currentUser && ownerId && ownerId === currentUser.uid) {
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

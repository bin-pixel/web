// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDbrsr6g0X6vKujfqBcFY0h-Rn3y1nCEI", // 스크린샷의 '웹 API 키'
  authDomain: "bin20703-edda7.firebaseapp.com",
  databaseURL: "https://bin20703-edda7-default-rtdb.firebaseio.com",
  projectId: "bin20703-edda7", // 스크린샷의 '프로젝트 ID'
  storageBucket: "bin20703-edda7.appspot.com",
  messagingSenderId: "242056223892", // 스크린샷의 '프로젝트 번호'
  appId: "YOUR_APP_ID" // Firebase 콘솔의 Config에서 직접 확인해주세요.
};

// =================================================================
// 2. DOM ELEMENTS
// =================================================================
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');

// =================================================================
// 3. FIREBASE INITIALIZATION & AUTHENTICATION
// =================================================================
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
    alert("Firebase 인증에 실패했습니다. Firebase Console에서 익명 로그인이 활성화되었는지, Config 정보가 올바른지 확인해주세요.");
  });

// =================================================================
// 4. ROOM MANAGEMENT FUNCTIONS
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
    } else if (topic !== null) { // 사용자가 취소(null) 누른게 아니라면
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
                
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'room-card-info';
                infoDiv.innerHTML = `
                    <h3>${room.topic}</h3>
                    <p>진행자: ${room.ownerNickname}</p>
                `;

                const buttonsDiv = document.createElement('div');

                const enterButton = document.createElement('button');
                enterButton.textContent = '입장하기';
                enterButton.onclick = () => {
                    window.location.href = `room.html?id=${roomId}`;
                };
                buttonsDiv.appendChild(enterButton);

                if (currentUser && room.ownerId === currentUser.uid) {
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'delete-btn';
                    deleteButton.textContent = '삭제';
                    deleteButton.onclick = () => deleteRoom(roomId, room.topic);
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


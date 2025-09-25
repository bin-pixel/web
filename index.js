// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "https://bin20703-edda7-default-rtdb.firebaseio.com/",
  projectId: "bin20703-edda7",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};


// =================================================================
// 2. FIREBASE INITIALIZATION & AUTHENTICATION
// =================================================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const functions = firebase.functions();
const auth = firebase.auth();

let currentUser = null; // 현재 사용자 정보를 저장할 변수

// 익명으로 로그인하여 모든 사용자에게 고유 ID(uid)를 부여합니다.
auth.signInAnonymously()
  .then(() => {
    currentUser = auth.currentUser;
    console.log('익명 로그인 성공! UID:', currentUser.uid);
    // 로그인이 성공한 후에 방 목록을 가져오도록 호출
    loadRooms(); 
  })
  .catch((error) => {
    console.error("익명 로그인 실패:", error);
  });


// =================================================================
// 3. DOM ELEMENTS
// =================================================================
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
const aiResultElement = document.getElementById('ai-result');


// =================================================================
// 4. DATA WRITING (CREATE & DELETE ROOM)
// =================================================================
createRoomBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert("사용자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    const topic = prompt("새 토론방의 주제를 입력하세요:");

    if (topic && topic.trim() !== '') {
        database.ref('rooms').push({
            topic: topic,
            ownerId: currentUser.uid, // **중요: 방장의 고유 ID를 저장**
            ownerNickname: "익명의 진행자",
            createdAt: new Date().toISOString()
        });
    } else {
        alert("토론 주제를 입력해야 합니다.");
    }
});

function deleteRoom(roomId, roomTopic) {
    if (confirm(`'${roomTopic}' 방을 정말 삭제하시겠습니까?`)) {
        database.ref('rooms/' + roomId).remove()
            .then(() => console.log('방 삭제 성공:', roomId))
            .catch((error) => console.error('방 삭제 실패:', error));
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
                
                let cardHTML = `
                    <h3>${room.topic}</h3>
                    <p>진행자: ${room.ownerNickname} (ID: ...${room.ownerId.slice(-6)})</p>
                    <button onclick="alert('입장 기능은 곧 추가될 예정입니다!')">입장하기</button>
                `;

                // **중요: 현재 사용자가 방장일 경우에만 삭제 버튼을 추가**
                if (currentUser && room.ownerId === currentUser.uid) {
                    // onclick 이벤트에서 roomId와 room.topic을 문자열로 전달해야 함
                    cardHTML += `<button class="delete-btn" onclick="deleteRoom('${roomId}', '${room.topic.replace(/'/g, "\\'")}')">삭제</button>`;
                }
                
                roomCard.innerHTML = cardHTML;
                roomListElement.appendChild(roomCard);
            }
        } else {
            roomListElement.innerHTML += '<p>진행중인 토론이 없습니다. 첫 토론방을 만들어보세요!</p>';
        }
    });
}


// =================================================================
// 6. AI ANALYSIS (CALL CLOUD FUNCTION)
// =================================================================
aiAnalysisBtn.addEventListener('click', () => {
    const exampleChatLog = `진행자: '부먹'과 '찍먹' 토론 시작...`; // (내용은 이전과 동일)
    aiResultElement.textContent = 'Gemini AI에게 분석을 요청하는 중...';

    const analyzeDebate = functions.httpsCallable('analyzeDebateWithGemini');
    analyzeDebate({ chatLog: exampleChatLog })
      .then((result) => {
        console.log("Gemini 분석 결과:", result.data);
        aiResultElement.textContent = JSON.stringify(result.data, null, 2);
      })
      .catch((error) => {
        console.error("AI 분석 중 오류 발생:", error);
        aiResultElement.textContent = `AI 분석에 실패했습니다: ${error.message}`;
      });
});

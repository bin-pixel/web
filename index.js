// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
// TODO: Firebase Console에서 복사한 본인의 설정 코드를 여기에 붙여넣으세요.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "https://bin20703-edda7-default-rtdb.firebaseio.com/", // 본인의 데이터베이스 URL
  projectId: "bin20703-edda7",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};


// =================================================================
// 2. FIREBASE INITIALIZATION
// =================================================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const functions = firebase.functions(); // Firebase Functions 초기화
console.log('Firebase가 성공적으로 연결되었습니다.');


// =================================================================
// 3. DOM ELEMENTS
// =================================================================
const createRoomBtn = document.getElementById('create-room-btn');
const roomListElement = document.getElementById('room-list');
const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
const aiResultElement = document.getElementById('ai-result');


// =================================================================
// 4. DATA WRITING (CREATE ROOM)
// =================================================================
createRoomBtn.addEventListener('click', () => {
    const topic = prompt("새 토론방의 주제를 입력하세요:");

    if (topic && topic.trim() !== '') {
        database.ref('rooms').push({
            topic: topic,
            moderator: "익명의 진행자",
            createdAt: new Date().toISOString()
        });
    } else {
        alert("토론 주제를 입력해야 합니다.");
    }
});


// =================================================================
// 5. DATA READING (DISPLAY ROOMS)
// =================================================================
const roomsRef = database.ref('rooms');
roomsRef.on('value', (snapshot) => {
    const rooms = snapshot.val();
    roomListElement.innerHTML = '<h2>진행중인 토론</h2>';

    if (rooms) {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `
                <h3>${room.topic}</h3>
                <p>진행자: ${room.moderator}</p>
                <button onclick="alert('입장 기능은 곧 추가될 예정입니다!')">입장하기</button>
            `;
            roomListElement.appendChild(roomCard);
        }
    } else {
        roomListElement.innerHTML += '<p>진행중인 토론이 없습니다. 첫 토론방을 만들어보세요!</p>';
    }
});


// =================================================================
// 6. AI ANALYSIS (CALL CLOUD FUNCTION)
// =================================================================
aiAnalysisBtn.addEventListener('click', () => {
    // 1. 분석할 채팅 로그 (지금은 테스트를 위해 하드코딩)
    // TODO: 나중에는 실제 토론방에서 채팅 기록을 가져와야 합니다.
    const exampleChatLog = `
      진행자: '부먹'과 '찍먹' 중 무엇이 더 나은 방식인가에 대한 토론을 시작하겠습니다.
      찬성측(부먹): 소스가 튀김에 미리 스며들어야 진정한 탕수육의 맛을 느낄 수 있습니다. 바삭함과 눅눅함의 조화가 핵심입니다.
      반대측(찍먹): 말도 안됩니다. 탕수육의 생명은 바삭함인데, 소스를 부으면 그 장점이 사라집니다. 먹는 사람의 선택권을 존중해야죠.
      찬성측(부먹): 원래 중국 본토 요리법도 소스를 부어 볶아내는 방식이었습니다. 그것이 원조입니다.
      반대측(찍먹): 전통이 항상 옳은 것은 아닙니다. 시대가 변하면서 소비자 입맛도 변했습니다. 바삭함을 유지하며 소스 양을 조절하는 것이 현대적인 방식입니다.
    `;

    aiResultElement.textContent = 'Gemini AI에게 분석을 요청하는 중...';

    // 2. 'analyzeDebateWithGemini'라는 이름의 Cloud Function을 호출
    const analyzeDebate = functions.httpsCallable('analyzeDebateWithGemini');
    analyzeDebate({ chatLog: exampleChatLog })
      .then((result) => {
        // 3. 성공적으로 결과를 받으면 result.data에 분석 내용이 들어있음
        console.log("Gemini 분석 결과:", result.data);
        // JSON 객체를 예쁘게 포맷팅된 문자열로 변환하여 화면에 표시
        aiResultElement.textContent = JSON.stringify(result.data, null, 2);
      })
      .catch((error) => {
        // 4. 에러가 발생했을 경우
        console.error("AI 분석 중 오류 발생:", error);
        aiResultElement.textContent = `AI 분석에 실패했습니다: ${error.message}`;
      });
});

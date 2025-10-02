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
const auth = firebase.auth();
const database = firebase.database();
let currentUser = null;

const profileForm = document.getElementById('profile-form');
const nicknameInput = document.getElementById('nickname-input');
const backToMainBtn = document.getElementById('back-to-main');

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        database.ref(`users/${currentUser.uid}/nickname`).once('value', (snapshot) => {
            if (snapshot.exists()) {
                nicknameInput.value = snapshot.val();
            } else {
                nicknameInput.value = currentUser.email.split('@')[0];
            }
        });
    } else {
        window.location.href = 'login.html';
    }
});

profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newNickname = nicknameInput.value.trim();
    if (newNickname) {
        database.ref(`users/${currentUser.uid}/nickname`).set(newNickname)
            .then(() => alert("닉네임이 저장되었습니다."))
            .catch(error => alert("저장 실패: " + error.message));
    }
});

backToMainBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

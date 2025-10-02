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

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup-btn');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('로그인 성공:', userCredential.user);
            window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error('로그인 실패:', error);
            alert(`로그인에 실패했습니다: ${error.message}`);
        });
});

signupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 모두 입력해주세요.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('회원가입 성공:', userCredential.user);
            // 사용자 정보 DB에 기본값 저장 (선택사항)
            database.ref('users/' + userCredential.user.uid).set({
                email: userCredential.user.email,
                nickname: userCredential.user.email.split('@')[0],
                createdAt: new Date().toISOString()
            });
            alert("회원가입이 완료되었습니다. 다시 로그인해주세요.");
        })
        .catch((error) => {
            console.error('회원가입 실패:', error);
            alert(`회원가입에 실패했습니다: ${error.message}`);
        });
});

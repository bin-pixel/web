// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
const firebaseConfig = { /* ... 본인의 firebaseConfig 정보 ... */ };

// =================================================================
// 2. INITIALIZATION
// =================================================================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup-btn');

// =================================================================
// 3. EVENT LISTENERS
// =================================================================

// 로그인 처리
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('로그인 성공:', userCredential.user);
            window.location.href = 'index.html'; // 로그인 성공 시 메인 페이지로 이동
        })
        .catch((error) => {
            console.error('로그인 실패:', error);
            alert(`로그인에 실패했습니다: ${error.message}`);
        });
});

// 회원가입 처리
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
            alert("회원가입이 완료되었습니다. 다시 로그인해주세요.");
        })
        .catch((error) => {
            console.error('회원가입 실패:', error);
            alert(`회원가입에 실패했습니다: ${error.message}`);
        });
});
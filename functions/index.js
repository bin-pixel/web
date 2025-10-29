const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// ======================================================================
// !! 보안 경고 !!
// 이 코드는 API 키를 직접 노출하므로 매우 위험합니다.
// ======================================================================
const GEMINI_API_KEY = "여기에_당신의_실제_API_키를_붙여넣으세요";

// AI 모델 초기화
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// ※ 참고: gemini-2.5-flash 모델은 아직 존재하지 않을 수 있습니다.
// ※ 만약 오류가 계속되면 'gemini-1.5-flash-latest'로 변경해보세요.
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


/**
 * Gemini API를 호출하여 토론 내용을 분석하는 함수
 */
exports.analyzeDebateWithGemini = functions.https.onCall(async (data, context) => {
    // API 키가 설정되었는지 확인
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "여기에_당신의_실제_API_키를_붙여넣으세요") {
        throw new functions.https.HttpsError(
            "failed-precondition", 
            "Gemini API 키가 functions/index.js 파일에 설정되지 않았습니다."
        );
    }

    const chatLog = data.chatLog;
    if (!chatLog) {
        throw new functions.https.HttpsError(
            "invalid-argument", 
            "분석할 대화 내용(chatLog)이 없습니다."
        );
    }

    const prompt = `다음 토론 대화 내용을 분석하고, 각 참여자의 핵심 주장, 감정적 표현, 논리적 오류를 요약해줘. 그리고 전체 토론의 승자를 결정하고 그 이유를 설명해줘.\n\n---토론 내용---\n${chatLog}\n---분석 결과---`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();
        
        return { summary: summary };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        
        // ▼▼▼▼▼▼▼▼▼▼ 이 부분이 핵심 수정 사항입니다 ▼▼▼▼▼▼▼▼▼▼
        // 'internal' 오류 대신, AI 라이브러리가 보낸 실제 오류 메시지를 클라이언트로 전달합니다.
        throw new functions.https.HttpsError(
            "internal", 
            `AI 분석 중 오류 발생: ${error.message}`
        );
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    }
});

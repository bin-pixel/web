const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

// ======================================================================
// !! 보안 경고 !!
// 이 코드는 API 키를 직접 노출하므로 매우 위험합니다.
// 이 프로젝트를 절대로 공개된 GitHub 리포지토리에 올리지 마세요.
// ======================================================================

// ▼▼▼▼▼▼▼▼▼▼ 이 부분을 당신의 실제 API 키로 교체하세요 ▼▼▼▼▼▼▼▼▼▼
const GEMINI_API_KEY = "AIzaSyDiCGOm3BrLQOP6ZQmZW2Pz2WlLII0hHdY";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


/**
 * Gemini API를 호출하여 토론 내용을 분석하는 함수
 */
exports.analyzeDebateWithGemini = functions.https.onCall(async (data, context) => {
    // API 키가 설정되었는지 확인
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "AIzaSyDiCGOm3BrLQOP6ZQmZW2Pz2WlLII0hHdY") {
        throw new functions.https.HttpsError(
            "failed-precondition", 
            "Gemini API 키가 functions/index.js 파일에 설정되지 않았습니다."
        );
    }

    // 채팅 로그 데이터가 있는지 확인
    const chatLog = data.chatLog;
    if (!chatLog) {
        throw new functions.https.HttpsError(
            "invalid-argument", 
            "분석할 대화 내용(chatLog)이 없습니다."
        );
    }

    // Gemini API에 보낼 프롬프트 구성
    const prompt = `다음 토론 대화 내용을 분석하고, 각 참여자의 핵심 주장, 감정적 표현, 논리적 오류를 요약해줘. 그리고 전체 토론의 승자를 결정하고 그 이유를 설명해줘.\n\n---토론 내용---\n${chatLog}\n---분석 결과---`;

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        // Gemini API 호출
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error:", errorBody);
            throw new functions.https.HttpsError("internal", "Gemini API 호출에 실패했습니다. API 키가 유효한지, API가 활성화되었는지 확인하세요.");
        }

        const responseData = await apiResponse.json();
        const summary = responseData.candidates[0].content.parts[0].text;
        
        return { summary: summary };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "AI 분석 중 알 수 없는 오류가 발생했습니다.");
    }
});

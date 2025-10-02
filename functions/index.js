const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const GEMINI_API_KEY = functions.config().gemini?.key;

exports.analyzeDebateWithGemini = functions.https.onCall(async (data, context) => {
    if (!GEMINI_API_KEY) {
        throw new functions.https.HttpsError("failed-precondition", "Gemini API 키가 설정되지 않았습니다.");
    }
    const chatLog = data.chatLog;
    if (!chatLog) {
        throw new functions.https.HttpsError("invalid-argument", "chatLog가 필요합니다.");
    }

    const prompt = `다음 토론 대화 내용을 분석하고, 각 참여자의 핵심 주장, 감정적 표현, 논리적 오류를 요약해줘. 그리고 전체 토론의 승자를 결정하고 그 이유를 설명해줘.\n\n---토론 내용---\n${chatLog}\n---분석 결과---`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        console.error("Gemini API Error:", errorBody);
        throw new functions.https.HttpsError("internal", "Gemini API 호출에 실패했습니다.");
    }

    const responseData = await apiResponse.json();
    try {
        const summary = responseData.candidates[0].content.parts[0].text;
        return { summary: summary };
    } catch(e) {
        console.error("Error parsing Gemini response:", responseData);
        throw new functions.https.HttpsError("internal", "Gemini API 응답을 파싱하는 데 실패했습니다.");
    }
});

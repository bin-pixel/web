const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * 방장이 사용자를 강퇴시키는 함수
 */
exports.kickUser = functions.https.onCall(async (data, context) => {
    // 1. 인증된 사용자인지 확인
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated", 
            "이 기능을 사용하려면 로그인이 필요합니다."
        );
    }

    const callerUid = context.auth.uid;
    const { roomId, targetUid } = data;

    if (!roomId || !targetUid) {
        throw new functions.https.HttpsError(
            "invalid-argument", 
            "방 ID(roomId)와 대상 ID(targetUid)가 필요합니다."
        );
    }

    // 2. 함수 호출자가 방장인지 확인
    const roomRef = admin.database().ref(`/rooms/${roomId}`);
    const roomSnapshot = await roomRef.once("value");
    const roomData = roomSnapshot.val();

    if (!roomData) {
        throw new functions.https.HttpsError("not-found", "방을 찾을 수 없습니다.");
    }

    if (roomData.ownerId !== callerUid) {
        throw new functions.https.HttpsError(
            "permission-denied", 
            "방장만 강퇴 기능을 사용할 수 있습니다."
        );
    }
    
    // 3. 자기 자신은 강퇴할 수 없음
    if (callerUid === targetUid) {
        throw new functions.https.HttpsError(
            "failed-precondition", 
            "자기 자신을 강퇴할 수 없습니다."
        );
    }

    // 4. 대상 사용자 강퇴 (participants 목록에서 제거)
    try {
        await admin.database().ref(`/rooms/${roomId}/participants/${targetUid}`).remove();
        return { success: true, message: "사용자를 강퇴했습니다." };
    } catch (error) {
        console.error("강퇴 실패:", error);
        throw new functions.https.HttpsError("internal", "사용자 강퇴 중 오류가 발생했습니다.");
    }
});

import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Company, User } from "air-guard-v2-schemas";

export const createUserWithCompany = onCall(async (request) => {
  const { email, password, companyName, companyNameKana, displayName } =
    request.data;

  if (!email || !password || !companyName || !companyNameKana) {
    throw new HttpsError("invalid-argument", "必要な情報が不足しています");
  }

  const auth = getAuth();
  let uid;

  try {
    // 1. Firebase Authentication にユーザー作成
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;

    // 2. Company を FireModel 経由で作成
    const company = new Company({
      name: companyName,
      nameKana: companyNameKana,
    });

    const companyRef = await company.create();
    const companyId = companyRef.id;

    // 3. User を FireModel 経由で作成（サブコレクション）
    const user = new User({
      uid,
      email,
      displayName,
      roles: ["admin"],
    });

    await user.create({
      docId: uid,
      prefix: `Companies/${companyId}`,
    });

    // 4. カスタムクレーム設定
    await auth.setCustomUserClaims(uid, {
      companyId,
      isSuperUser: false,
      roles: ["admin"],
    });

    return { success: true, uid, companyId };
  } catch (error) {
    console.error("createUserWithCompany エラー:", error);

    // --- 個別エラー対応 ---
    const errorCodeMap = {
      "auth/email-already-exists": {
        status: "already-exists",
        message: "このメールアドレスは既に使用されています。",
      },
      "auth/invalid-email": {
        status: "invalid-argument",
        message: "メールアドレスの形式が正しくありません。",
      },
      "auth/invalid-password": {
        status: "invalid-argument",
        message: "パスワードの形式が正しくありません。",
      },
      "auth/weak-password": {
        status: "invalid-argument",
        message: "パスワードが簡単すぎます（最低6文字以上にしてください）。",
      },
    };

    const mapped = errorCodeMap[error.code];
    if (mapped) {
      throw new HttpsError(mapped.status, mapped.message);
    }

    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch (rollbackError) {
        console.error("Authユーザー削除失敗:", rollbackError);
      }
    }

    throw new HttpsError(
      "internal",
      "ユーザー作成中に予期しないエラーが発生しました"
    );
  }
});

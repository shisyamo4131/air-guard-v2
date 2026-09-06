const labels = Object.freeze({ idle: "従業員未取得", loading: "読込中", denied: "閲覧不可", missing: "従業員情報なし", error: "取得失敗" });

export function employeeReadLabel(status, displayName) {
  return status === "ready" ? displayName || "氏名未設定" : labels[status] || labels.idle;
}

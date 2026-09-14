/**
 * 入金予定日は請求日より前にできない。日付入力の補助制約とは別に、
 * Billing の通常更新直前に同じ条件を確認するための純粋関数。
 */
import { dateInput } from "../shared/valueContract.js";

export function assertPaymentDueDate(item) {
  let billingDate;
  try {
    billingDate = dateInput(item?.billingDateAt);
  } catch {
    throw new Error("請求日を確認できません。");
  }

  if (!billingDate) {
    throw new Error("請求日を確認できません。");
  }

  if (item?.paymentDueDateAt === null) return;

  let paymentDueDate;
  try {
    paymentDueDate = dateInput(item?.paymentDueDateAt);
  } catch {
    throw new Error("入金予定日を確認してください。");
  }

  if (!paymentDueDate) {
    throw new Error("入金予定日を確認してください。");
  }

  if (paymentDueDate < billingDate) {
    throw new Error("入金予定日は請求日以降にしてください。");
  }
}

/**
 * @file ./schemas/OperationResult.js
 * @description 稼働実績クラス
 */
import { OperationResult as BaseClass } from "air-guard-v2-schemas"; // fetchCoordinates is no longer directly used here

export default class OperationResult extends BaseClass {}

export {
  OperationResultEmployee,
  OperationResultOutsourcer,
} from "air-guard-v2-schemas";

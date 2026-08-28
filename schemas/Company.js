/**
 * @file ./schemas/Company.js
 * @description 会社情報クラス
 *  - GeocodableMixin により自動的にジオコーディング機能を提供します。
 *  - `delete` は許可されていません。
 */
import { Company as BaseClass } from "@shisyamo4131/air-guard-v2-schemas";
import { doc, getDoc, getFirestore, onSnapshot } from "firebase/firestore";
import {
  ACTIVE_SETTING_NAMES,
  COMPANY_CONFIGURATION_MODE,
  CompanyConfigurationReadError,
  isCompanyConfigurationActive,
  resolveCompatibleCompany,
} from "../utils/companyConfiguration/resolveCompatibleCompany.js";

const companyRef = (firestore, companyId) =>
  doc(firestore, "Companies", companyId);

const settingRef = (firestore, companyId, settingName) =>
  doc(firestore, "Companies", companyId, "Settings", settingName);

export default class Company extends BaseClass {
  // 後日実装予定のカスタムカラー用プロパティ
  // static classProps = {
  //   ...BaseClass.classProps,
  //   colorDefinitions: {
  //     type: Object,
  //     default: () => {
  //       return {
  //         dayType: {
  //           WEEKDAY: "green",
  //           SATURDAY: "blue",
  //           SUNDAY: "red",
  //           HOLIDAY: "pink",
  //         },
  //         shiftType: {
  //           DAY: "deep-orange",
  //           NIGHT: "indigo",
  //         },
  //       };
  //     },
  //   },
  // };

  constructor(item = {}) {
    super(item);
    Object.defineProperties(this, {
      _companyConfigurationMode: {
        value: COMPANY_CONFIGURATION_MODE.INITIALIZING,
        writable: true,
        configurable: true,
      },
      _companyConfigurationRoot: {
        value: null,
        writable: true,
        configurable: true,
      },
      _companyConfigurationSettings: {
        value: null,
        writable: true,
        configurable: true,
      },
      _companyConfigurationReadError: {
        value: null,
        writable: true,
        configurable: true,
      },
    });
  }

  get companyConfigurationMode() {
    return this._companyConfigurationMode;
  }

  get companyConfigurationRoot() {
    return this._companyConfigurationRoot;
  }

  get companyConfigurationSettings() {
    return this._companyConfigurationSettings;
  }

  get companyConfigurationReadError() {
    return this._companyConfigurationReadError;
  }

  get hasCompanyConfigurationReadError() {
    return !!this._companyConfigurationReadError;
  }

  initialize(item = {}) {
    super.initialize(item);
    if (Object.prototype.hasOwnProperty.call(this, "_companyConfigurationMode")) {
      this._companyConfigurationMode = COMPANY_CONFIGURATION_MODE.INITIALIZING;
      this._companyConfigurationRoot = null;
      this._companyConfigurationSettings = null;
      this._companyConfigurationReadError = null;
    }
  }

  _applyResolvedCompany(resolved) {
    this.initialize(resolved.companyData);
    this._companyConfigurationMode = resolved.mode;
    this._companyConfigurationRoot = resolved.root;
    this._companyConfigurationSettings = resolved.settings;
    this._companyConfigurationReadError = null;
  }

  _failCompanyConfigurationRead(error) {
    const safeError =
      error instanceof Error
        ? error
        : new CompanyConfigurationReadError(
            "COMPANY_CONFIGURATION_READ_FAILED",
            "$",
          );
    this.initialize(null);
    this._companyConfigurationMode = COMPANY_CONFIGURATION_MODE.ERROR;
    this._companyConfigurationRoot = null;
    this._companyConfigurationSettings = null;
    this._companyConfigurationReadError = safeError;
    return safeError;
  }

  async fetch({ docId, transaction = null } = {}) {
    if (!docId) {
      throw new CompanyConfigurationReadError(
        "MISSING_COMPANY_ID",
        "$.companyId",
      );
    }

    const firestore = getFirestore();
    const read = transaction
      ? (reference) => transaction.get(reference)
      : (reference) => getDoc(reference);

    try {
      const rootSnapshot = await read(companyRef(firestore, docId));
      if (!rootSnapshot.exists()) {
        throw new CompanyConfigurationReadError(
          "MISSING_COMPANY_ROOT",
          "$.root",
        );
      }
      const root = rootSnapshot.data();
      let settings = null;
      if (isCompanyConfigurationActive(root)) {
        settings = {};
        for (const settingName of ACTIVE_SETTING_NAMES) {
          const snapshot = await read(
            settingRef(firestore, docId, settingName),
          );
          if (!snapshot.exists()) {
            throw new CompanyConfigurationReadError(
              "MISSING_ACTIVE_SETTING",
              `$.Settings.${settingName}`,
            );
          }
          settings[settingName] = snapshot.data();
        }
      }

      this._applyResolvedCompany(
        resolveCompatibleCompany({ companyId: docId, root, settings }),
      );
      return true;
    } catch (error) {
      throw this._failCompanyConfigurationRead(error);
    }
  }

  subscribe({ docId } = {}, callback = null) {
    this.unsubscribe();
    if (!docId) {
      throw new CompanyConfigurationReadError(
        "MISSING_COMPANY_ID",
        "$.companyId",
      );
    }

    const firestore = getFirestore();
    const unsubscribers = [];
    let settingUnsubscribers = [];
    let root = null;
    const settings = {};

    const stopSettings = () => {
      for (const unsubscribe of settingUnsubscribers) unsubscribe();
      settingUnsubscribers = [];
      for (const settingName of ACTIVE_SETTING_NAMES) {
        delete settings[settingName];
      }
    };

    const emitFailure = (error) => {
      const safeError = this._failCompanyConfigurationRead(error);
      if (callback) callback(undefined, safeError);
    };

    const applyActiveIfComplete = () => {
      if (!root) return;
      if (
        !ACTIVE_SETTING_NAMES.every((settingName) =>
          Object.prototype.hasOwnProperty.call(settings, settingName),
        )
      ) {
        return;
      }
      try {
        this._applyResolvedCompany(
          resolveCompatibleCompany({ companyId: docId, root, settings }),
        );
        if (callback) callback(this);
      } catch (error) {
        emitFailure(error);
      }
    };

    const startSettings = () => {
      if (settingUnsubscribers.length > 0) return;
      settingUnsubscribers = ACTIVE_SETTING_NAMES.map((settingName) =>
        onSnapshot(
          settingRef(firestore, docId, settingName),
          (snapshot) => {
            if (!snapshot.exists()) {
              delete settings[settingName];
              emitFailure(
                new CompanyConfigurationReadError(
                  "MISSING_ACTIVE_SETTING",
                  `$.Settings.${settingName}`,
                ),
              );
              return;
            }
            settings[settingName] = snapshot.data();
            applyActiveIfComplete();
          },
          (error) => {
            delete settings[settingName];
            emitFailure(error);
          },
        ),
      );
    };

    const rootUnsubscribe = onSnapshot(
      companyRef(firestore, docId),
      (snapshot) => {
        if (!snapshot.exists()) {
          stopSettings();
          emitFailure(
            new CompanyConfigurationReadError(
              "MISSING_COMPANY_ROOT",
              "$.root",
            ),
          );
          return;
        }

        root = snapshot.data();
        if (isCompanyConfigurationActive(root)) {
          startSettings();
          applyActiveIfComplete();
          return;
        }

        stopSettings();
        try {
          this._applyResolvedCompany(
            resolveCompatibleCompany({ companyId: docId, root }),
          );
          if (callback) callback(this);
        } catch (error) {
          emitFailure(error);
        }
      },
      (error) => {
        root = null;
        stopSettings();
        emitFailure(error);
      },
    );
    unsubscribers.push(rootUnsubscribe);

    this.listener = () => {
      stopSettings();
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }

  async update(args = {}) {
    if (this.companyConfigurationMode !== COMPANY_CONFIGURATION_MODE.LEGACY) {
      throw new CompanyConfigurationReadError(
        "LEGACY_COMPANY_WRITE_DISABLED",
        "$.Companies",
      );
    }
    return await super.update(args);
  }

  async delete() {
    throw new Error("Companyドキュメントの削除は許可されていません。");
  }
}

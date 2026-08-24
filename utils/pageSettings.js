/**
 * ページの表示・アクセスに関する設定 Ver.4
 *
 * - id: 一意の識別子
 * - path: Nuxt Router で使用する絶対パス
 * - accessPolicy: pathを持つページに適用する共有access policy
 * - label: ナビゲーションやパンくずリストで表示する名称
 * - icon: ナビゲーション表示用の Vuetify アイコン（mdi-xxx）
 * - navigation: (boolean) ナビゲーションメニューに表示するか
 * - children: 子ページの配列（同じ構造を持つ）
 *
 * NOTE: "/" を除き、`id` と `path` を一致させると NavigationDrawer コンポーネントでの
 *       アクティブ判定が有効になる。
 */
import {
  isKnownPageAccessPolicy,
  isPageAccessAllowed,
  PAGE_ACCESS_POLICIES,
} from "./auth/policies/pageAccessPolicy.js";

const LEGACY_PAGE_ACCESS_FIELDS = Object.freeze([
  "public",
  "roles",
  "strictPresetPermissions",
  "allowAdmin",
]);

function getLegacyPageAccessFields(pageConfig) {
  if (!pageConfig || typeof pageConfig !== "object") return [];
  return LEGACY_PAGE_ACCESS_FIELDS.filter((field) =>
    Object.hasOwn(pageConfig, field),
  );
}

export const pageStructure = [
  {
    id: "sign-up-admin",
    path: "/auth/sign-up-admin",
    accessPolicy: PAGE_ACCESS_POLICIES.PUBLIC,
    label: "管理者アカウントサインアップ",
    navigation: false,
  },
  {
    id: "sign-up",
    path: "/auth/sign-up",
    accessPolicy: PAGE_ACCESS_POLICIES.PUBLIC,
    label: "利用者アカウントサインアップ",
    navigation: false,
  },
  {
    id: "sign-in",
    path: "/auth/sign-in",
    accessPolicy: PAGE_ACCESS_POLICIES.PUBLIC,
    label: "サインイン",
    navigation: false,
  },

  /** SUPER USER */
  {
    id: "super-user",
    path: "/super-user",
    accessPolicy: PAGE_ACCESS_POLICIES.SUPER_USER,
    label: "スーパーユーザー",
    navigation: true,
  },

  /** TEST */
  {
    id: "module-tests",
    label: "テスト",
    icon: "mdi-domain",
    navigation: true,
    children: [
      {
        id: "component-test",
        path: "/test/component-test",
        label: "コンポーネント",
        icon: "mdi-domain",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
      {
        id: "permissions-test",
        path: "/test/permissions-test",
        label: "権限システムテスト",
        icon: "mdi-shield-check",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
      {
        id: "rollback-operation-result",
        path: "/test/rollback-operation-result",
        label: "稼働実績ロールバック",
        icon: "mdi-domain",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
      {
        id: "round-setting",
        path: "/test/round-setting-test",
        label: "端数処理設定クラス",
        icon: "mdi-domain",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
    ],
  },

  // ===== HOME (navigation: false) =====
  {
    id: "home", // ルートパスを追加 (公開ページとする例)
    path: "/",
    accessPolicy: PAGE_ACCESS_POLICIES.PUBLIC,
    label: "ホーム",
    navigation: false,
  },

  // ===== DASHBOARD =====
  {
    id: "dashboard",
    path: "/dashboard",
    label: "ダッシュボード",
    icon: "mdi-view-dashboard",
    accessPolicy: PAGE_ACCESS_POLICIES.AUTHENTICATED,
    navigation: true,
  },

  // ===== 管制業務 =====
  {
    id: "control-operation-group",
    label: "管制業務",
    icon: "mdi-camera-control",
    navigation: true,
    children: [
      {
        id: "operation-schedules",
        path: "/operation-schedules",
        label: "(Beta) 稼働予定管理",
        icon: "mdi-calendar-multiselect",
        accessPolicy: PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
        navigation: true,
      },
      {
        id: "arrangements-manager",
        path: "/arrangements-manager",
        label: "配置管理",
        icon: "mdi-calendar-account",
        accessPolicy: PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
        navigation: true,
      },
      {
        id: "operation-results-generator",
        path: "/operation-results/generator",
        label: "上下番確定処理",
        icon: "mdi-calendar-check",
        accessPolicy: PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
        navigation: true,
      },
    ],
  },

  // ===== 稼働実績管理 =====
  {
    id: "operation-results-group",
    label: "稼働実績管理",
    icon: "mdi-clipboard-check",
    navigation: true,
    children: [
      {
        id: "operation-results",
        path: "/operation-results",
        label: "稼働実績一覧",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.OPERATION_RESULTS_READ,
        navigation: true,
      },
      {
        id: "operation-results-detail",
        path: "/operation-results/[id]",
        label: "稼働実績詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.OPERATION_RESULTS_READ,
        navigation: false,
      },
    ],
  },

  // ===== 勤怠管理 =====
  {
    id: "attendances-group",
    label: "勤怠管理",
    icon: "mdi-clock-check",
    navigation: true,
    children: [
      {
        id: "attendances-index",
        path: "/attendances",
        label: "従業員別勤怠情報",
        icon: "mdi-calendar",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
      {
        id: "attendances-export",
        path: "/attendances/export",
        label: "打刻データ出力",
        icon: "mdi-file-export",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
    ],
  },

  // ===== 請求管理 =====
  {
    id: "billings-group",
    label: "請求管理",
    icon: "mdi-file-document-multiple",
    navigation: true,
    children: [
      {
        id: "billings-operations",
        path: "/billings/operations",
        label: "稼働請求一覧",
        icon: "mdi-file-document",
        accessPolicy: PAGE_ACCESS_POLICIES.BILLINGS_READ,
        navigation: true,
      },
      {
        id: "billings-operations-detail",
        path: "/billings/operations/[id]",
        label: "稼働請求詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.BILLINGS_READ,
        navigation: false,
      },
      {
        id: "billings-customers",
        path: "/billings/customers",
        label: "取引先請求一覧",
        icon: "mdi-file-document-outline",
        accessPolicy: PAGE_ACCESS_POLICIES.BILLINGS_READ,
        navigation: true,
      },
      {
        id: "billings-customers-detail",
        path: "/billings/customers/[id]",
        label: "取引先請求詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.BILLINGS_READ,
        navigation: false,
      },
    ],
  },

  // ===== 取引先管理 =====
  {
    id: "customers-group",
    label: "取引先管理",
    icon: "mdi-domain",
    navigation: true,
    children: [
      {
        id: "customers",
        path: "/customers",
        label: "取引先一覧",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.CUSTOMERS_READ,
        navigation: true,
      },
      {
        id: "customer-detail",
        path: "/customers/[id]",
        label: "取引先詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.CUSTOMERS_READ,
        navigation: false,
      },
    ],
  },

  // ===== 現場管理 =====
  {
    id: "sites-group",
    label: "現場管理",
    icon: "mdi-pickaxe",
    navigation: true,
    children: [
      {
        id: "sites",
        path: "/sites",
        label: "稼働中現場一覧",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.SITES_READ,
        navigation: true,
      },
      {
        id: "site-detail",
        path: "/sites/[id]",
        label: "現場詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.SITES_READ,
        navigation: false,
      },
      {
        id: "sites-terminated",
        path: "/sites/terminated",
        label: "終了現場検索",
        icon: "mdi-magnify",
        accessPolicy: PAGE_ACCESS_POLICIES.SITES_READ,
        navigation: true,
      },
    ],
  },

  // ===== 従業員管理 =====
  {
    id: "employees-group",
    label: "従業員管理",
    icon: "mdi-account-multiple",
    navigation: true,
    children: [
      {
        id: "employees",
        path: "/employees",
        label: "在職者一覧",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.EMPLOYEES_READ,
        navigation: true,
      },
      {
        id: "employee-detail",
        path: "/employees/[id]",
        label: "従業員詳細",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.EMPLOYEES_READ,
        navigation: false,
      },
      {
        id: "employees-resigned",
        path: "/employees/resigned",
        label: "退職者検索",
        icon: "mdi-magnify",
        accessPolicy: PAGE_ACCESS_POLICIES.EMPLOYEES_READ,
        navigation: true,
      },
    ],
  },

  // ===== 外注先管理 =====
  {
    id: "outsourcers-group",
    label: "外注先管理",
    icon: "mdi-handshake",
    navigation: true,
    children: [
      {
        id: "outsourcers",
        path: "/outsourcers",
        label: "外注先一覧",
        icon: "mdi-format-list-bulleted",
        accessPolicy: PAGE_ACCESS_POLICIES.OUTSOURCERS_READ,
        navigation: true,
      },
    ],
  },

  // ===== 設定 =====
  {
    id: "settings",
    label: "管理者メニュー",
    icon: "mdi-cog",
    navigation: false,
    children: [
      {
        id: "user",
        path: "/settings/user",
        label: "アプリ設定",
        icon: "mdi-account-cog",
        accessPolicy: PAGE_ACCESS_POLICIES.ADMIN,
        navigation: false,
      },
    ],
  },
  // ===== マスタメンテナンス =====
  {
    id: "master-maintenance",
    label: "マスタメンテナンス",
    icon: "mdi-cog",
    navigation: true,
    children: [
      {
        id: "articles",
        path: "/articles",
        label: "商品管理",
        icon: "mdi-office-building",
        accessPolicy: PAGE_ACCESS_POLICIES.DEVELOPER,
        navigation: true,
      },
    ],
  },
  // ===== 管理者メニュー =====
  {
    id: "admin-settings",
    label: "管理者メニュー",
    icon: "mdi-cog",
    navigation: true,
    children: [
      {
        id: "company-setting",
        path: "/settings/company",
        label: "会社設定",
        icon: "mdi-office-building",
        accessPolicy: PAGE_ACCESS_POLICIES.ADMIN,
        navigation: true,
      },
      {
        id: "users-setting",
        path: "/settings/users",
        label: "ユーザー設定",
        icon: "mdi-account-cog",
        accessPolicy: PAGE_ACCESS_POLICIES.USER_MANAGEMENT,
        navigation: true,
      },
      {
        id: "checkout",
        path: "/settings/checkout",
        label: "サブスクリプション管理",
        icon: "mdi-account-cog",
        accessPolicy: PAGE_ACCESS_POLICIES.SUPER_USER,
        navigation: false,
      },
    ],
  },
  // 他のページやグループを追加
];

// --- ヘルパー関数 ---
export function isPageConfigAllowed(
  pageConfig,
  userRoles,
  accessContext = {},
) {
  if (!pageConfig || typeof pageConfig !== "object") return false;
  if (getLegacyPageAccessFields(pageConfig).length > 0) return false;
  return isPageAccessAllowed(
    pageConfig.accessPolicy,
    userRoles,
    accessContext,
  );
}

/**
 * pageStructure をフラット化し、パスをキーとするマップを作成
 * @param {Array} pages - pageStructure 配列
 * @returns {Object} { '/path/to/page': pageConfig, ... }
 */
function createPathMap(pages) {
  const map = {};
  function recurse(items) {
    for (const item of items) {
      if (item.path) {
        const normalizedPath = item.path.replace(/\/$/, "") || "/";
        map[normalizedPath] = item;
      }
      if (item.children) {
        recurse(item.children);
      }
    }
  }
  recurse(pages);
  return map;
}

const pagesByPath = createPathMap(pageStructure);

/**
 * 各パスの親パスを保持するマップを作成
 * @returns {Object} { '/child/path': '/parent/path', ... }
 */
function createParentPathMap(pages) {
  const map = {};

  function recurse(items, parentPath = null) {
    for (const item of items) {
      if (item.path) {
        const normalizedPath = item.path.replace(/\/$/, "") || "/";

        // 親パスを記録
        if (parentPath) {
          map[normalizedPath] = parentPath;
        }

        // このアイテムが子を持つ場合、子の親はこのアイテム
        if (item.children) {
          recurse(item.children, normalizedPath);
        }
      } else if (item.children) {
        // path がないグループの場合
        // 子要素同士で親子関係を判定する必要がある

        // まず子要素を収集
        const childPaths = item.children
          .filter((child) => child.path)
          .map((child) => child.path.replace(/\/$/, "") || "/");

        // 全ペアを比較して prefix 関係があれば親として登録する
        for (const childPath of childPaths) {
          for (const potentialParent of childPaths) {
            if (
              childPath !== potentialParent &&
              childPath.startsWith(potentialParent + "/")
            ) {
              map[childPath] = potentialParent;
              break;
            }
          }
        }

        // 再帰処理（親パスは引き継ぐ）
        recurse(item.children, parentPath);
      }
    }
  }

  recurse(pages);
  return map;
}

const parentPathMap = createParentPathMap(pageStructure);

/**
 * 指定されたパスの設定オブジェクトを取得する
 * @param {string} path - ルートパス
 * @returns {object | undefined} ページ設定オブジェクト、見つからなければ undefined
 *
 * ## 動的ルートの扱い
 * - `/employees/[id]` のような動的ルートは、パターンマッチングで対応
 * - 例: `/employees/abc123` → `/employees/[id]` の設定を取得
 */
export function getPageConfig(path) {
  let normalizedPath = path.replace(/\/$/, "") || "/"; // 入力パスを正規化

  // 1. 完全一致を試みる
  if (pagesByPath[normalizedPath]) {
    return pagesByPath[normalizedPath];
  }

  // 2. 動的ルートパターンマッチング
  // 例: /employees/abc123 → /employees/[id] を探す
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  for (const [registeredPath, config] of Object.entries(pagesByPath)) {
    const registeredSegments = registeredPath.split("/").filter(Boolean);

    // セグメント数が同じかチェック
    if (pathSegments.length !== registeredSegments.length) {
      continue;
    }

    // 各セグメントを比較（[id] は任意の値にマッチ）
    let isMatch = true;
    for (let i = 0; i < pathSegments.length; i++) {
      const registered = registeredSegments[i];
      const actual = pathSegments[i];

      // [id] や :id 形式の動的セグメント
      const isDynamic =
        (registered.startsWith("[") && registered.endsWith("]")) ||
        registered.startsWith(":");

      if (!isDynamic && registered !== actual) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return config; // ✅ 動的ルートの設定を返す
    }
  }

  // 3. 動的ルートの親を探す（従来の処理）
  // 例: /employees/abc123/edit のような多階層の場合、/employees/[id] が見つからなければ /employees を探す
  let tempPath = normalizedPath;
  while (tempPath.includes("/")) {
    const lastSlashIndex = tempPath.lastIndexOf("/");
    tempPath =
      lastSlashIndex === 0 ? "/" : tempPath.substring(0, lastSlashIndex);
    if (pagesByPath[tempPath]) {
      return pagesByPath[tempPath];
    }
    if (tempPath === "/") break;
  }

  return undefined; // どの設定も見つからなければ undefined
}

// --- 公開関数 ---

/**
 * 現在のパスに対して認証済みユーザーがロールに基づいてアクセス可能かを判定
 * @param {string} path - ルートパス
 * @param {string[]} userRoles - 現在のユーザーのロール配列
 * @returns {boolean} アクセス可能か (ページ設定が見つからない場合も false)
 */
export function isPageAllowed(path, userRoles, accessContext = {}) {
  const pageConfig = getPageConfig(path);

  if (!pageConfig) {
    // 設定が見つからないパスはアクセス不可
    console.warn(`No page configuration found for path: ${path}`);
    return false;
  }

  return isPageConfigAllowed(pageConfig, userRoles, accessContext);
}

/**
 * ユーザーロールに基づいてナビゲーションメニュー用の項目リストを生成
 * (この関数のロジックは roles の解釈が変わっても影響を受けにくい)
 * @param {string[]} userRoles - 現在のユーザーロール配列
 * @returns {Array} ナビゲーション項目リスト
 */
export function getNavigationItems(userRoles, accessContext = {}) {
  function filterAndMap(items) {
    const result = [];
    for (const item of items) {
      if (!item.navigation) continue;

      if (item.path) {
        if (isPageConfigAllowed(item, userRoles, accessContext)) {
          const navItem = {
            title: item.label,
            value: item.id,
            to: item.path,
            prependIcon: item.icon,
          };

          if (item.children) {
            const accessibleChildren = filterAndMap(item.children);
            if (accessibleChildren.length > 0) {
              navItem.children = accessibleChildren;
            }
          }

          result.push(navItem);
        }
        continue;
      }

      if (item.children) {
        const accessibleChildren = filterAndMap(item.children);
        if (accessibleChildren.length > 0) {
          result.push({
            title: item.label,
            value: item.id,
            prependIcon: item.icon,
            children: accessibleChildren,
          });
        }
      }
    }
    return result;
  }
  return filterAndMap(pageStructure);
}

/**
 * 現在のパスに親ページが存在するかを判定
 * @param {string} path - 現在のルートパス
 * @returns {boolean} 親が存在する場合は true
 */
export function hasParentPage(path) {
  const normalizedPath = path.replace(/\/$/, "") || "/";

  // 1. ルートパス "/" は親を持たない
  if (normalizedPath === "/") {
    return false;
  }

  // 2. 直接的な親パスが登録されているか
  if (parentPathMap[normalizedPath]) {
    return true;
  }

  // 3. 動的ルート（/employees/abc123）の場合、
  //    対応する設定（/employees/[id]）を探して親を確認
  const pageConfig = getPageConfig(normalizedPath);

  if (pageConfig && pageConfig.path && pageConfig.path !== normalizedPath) {
    // 動的ルートの設定パスで親を確認
    const configPath = pageConfig.path.replace(/\/$/, "") || "/";

    if (parentPathMap[configPath]) {
      return true;
    }
  }

  // 4. どの条件にも当てはまらない場合は親なし
  return false;
}

/**
 * 現在のパスの親ページパスを取得
 * @param {string} path - 現在のルートパス
 * @returns {string | null} 親ページのパス、存在しない場合は null
 */
export function getParentPagePath(path) {
  const normalizedPath = path.replace(/\/$/, "") || "/";

  // 1. 直接的な親パスが登録されているか
  if (parentPathMap[normalizedPath]) {
    return parentPathMap[normalizedPath];
  }

  // 2. 動的ルート（/employees/abc123）の場合
  const pageConfig = getPageConfig(normalizedPath);
  if (pageConfig && pageConfig.path && pageConfig.path !== normalizedPath) {
    const configPath = pageConfig.path.replace(/\/$/, "") || "/";
    if (parentPathMap[configPath]) {
      return parentPathMap[configPath];
    }
  }

  // 3. ルートパスは親を持たない
  if (normalizedPath === "/") {
    return null;
  }

  // 4. フォールバック：URL構造から親を推測
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  return lastSlashIndex === 0
    ? "/"
    : normalizedPath.substring(0, lastSlashIndex);
}

// utils/pageSettings.js

/**
 * pageSettings のpath、policy、group構造を検証します。
 */
export function validatePageSettings(pages = pageStructure) {
  let isValid = true;
  const ids = new Set();
  const paths = new Set();

  function warn(item, message) {
    isValid = false;
    console.warn(
      `⚠️ [pageSettings] "${item.label}" (${item.id}): ${message}`,
    );
  }

  function validate(items) {
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        warn({}, "pageまたはgroupはobjectでなければなりません");
        continue;
      }

      if (typeof item.id !== "string" || item.id.length === 0) {
        warn(item, "空でないidが必要です");
      } else if (ids.has(item.id)) {
        warn(item, `id "${item.id}" が重複しています`);
      } else {
        ids.add(item.id);
      }

      if (typeof item.navigation !== "boolean") {
        warn(item, "navigationはbooleanでなければなりません");
      }

      const foundLegacyFields = getLegacyPageAccessFields(item);
      if (foundLegacyFields.length > 0) {
        warn(item, `旧access field [${foundLegacyFields}] は使用できません`);
      }

      const hasPath = Object.hasOwn(item, "path");
      const hasValidPath =
        hasPath &&
        typeof item.path === "string" &&
        item.path.startsWith("/");

      if (hasPath && !hasValidPath) {
        warn(item, "pathは/から始まる文字列でなければなりません");
      }

      if (hasValidPath) {
        const normalizedPath = item.path.replace(/\/$/, "") || "/";
        if (paths.has(normalizedPath)) {
          warn(item, `path "${normalizedPath}" が重複しています`);
        } else {
          paths.add(normalizedPath);
        }

        if (!isKnownPageAccessPolicy(item.accessPolicy)) {
          warn(item, "pathを持つpageには既知のaccessPolicyが必要です");
        }
      } else if (Object.hasOwn(item, "accessPolicy")) {
        warn(item, "pathを持たないgroupへaccessPolicyは設定できません");
      } else if (!Array.isArray(item.children) || item.children.length === 0) {
        warn(item, "pathを持たないgroupにはchildrenが必要です");
      }

      if (Object.hasOwn(item, "children") && !Array.isArray(item.children)) {
        warn(item, "childrenは配列でなければなりません");
      } else if (item.children) {
        validate(item.children);
      }
    }
  }

  if (!Array.isArray(pages)) {
    warn({}, "page settings rootは配列でなければなりません");
    return false;
  }

  validate(pages);
  return isValid;
}

// 開発環境でのみバリデーション実行
if (process.env.NODE_ENV === "development") {
  validatePageSettings();
}

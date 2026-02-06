/**
 * ページの表示・アクセスに関する設定 Ver.3
 *
 * - id: 一意の識別子
 * - path: Nuxt Router で使用する絶対パス
 * - public: (boolean) 未認証ユーザーでもアクセス可能か (デフォルト: false)
 * - label: ナビゲーションやパンくずリストで表示する名称
 * - icon: ナビゲーション表示用の Vuetify アイコン（mdi-xxx）
 * - roles: アクセス許可されたロール配列 (認証済みユーザー向け)。
 *          空配列は認証済みであればロールに関わらず許可。
 * - navigation: (boolean) ナビゲーションメニューに表示するか
 * - children: 子ページの配列（同じ構造を持つ）
 *
 * NOTE: "/" を除き、`id` と `path` を一致させると NavigationDrawer コンポーネントでの
 *       アクティブ判定が有効になる。
 */
export const pageStructure = [
  {
    id: "sign-up-admin",
    path: "/auth/sign-up-admin",
    public: true, // 公開ページ
    label: "管理者アカウントサインアップ",
    roles: [],
    navigation: false,
  },
  {
    id: "sign-up",
    path: "/auth/sign-up",
    public: true, // 公開ページ
    label: "利用者アカウントサインアップ",
    roles: [],
    navigation: false,
  },
  {
    id: "sign-in",
    path: "/auth/sign-in",
    public: true, // 公開ページ
    label: "サインイン",
    roles: [], // 認証済みユーザーはアクセスしない想定だが定義はしておく
    navigation: false,
  },
  {
    id: "module-tests",
    label: "テスト",
    icon: "mdi-domain",
    roles: ["developer"],
    navigation: true,
    children: [
      {
        id: "component-test",
        path: "/test/component-test",
        label: "コンポーネント",
        icon: "mdi-domain",
        roles: ["developer"], // ← 統一
        navigation: true,
      },
      {
        id: "permissions-test",
        path: "/test/permissions-test",
        label: "権限システムテスト",
        icon: "mdi-shield-check",
        roles: ["developer"], // ← 統一
        navigation: true,
      },
      {
        id: "rollback-operation-result",
        path: "/test/rollback-operation-result",
        label: "稼働実績ロールバック",
        icon: "mdi-domain",
        roles: ["developer"], // ← 統一
        navigation: true,
      },
      {
        id: "round-setting",
        path: "/test/round-setting-test",
        label: "端数処理設定クラス",
        icon: "mdi-domain",
        roles: ["developer"], // ← 統一
        navigation: true,
      },
    ],
  },

  // ===== HOME (navigation: false) =====
  {
    id: "home", // ルートパスを追加 (公開ページとする例)
    path: "/",
    public: true, // 公開ページ
    label: "ホーム",
    roles: [],
    navigation: false,
  },

  // ===== DASHBOARD =====
  {
    id: "dashboard",
    path: "/dashboard",
    label: "ダッシュボード",
    icon: "mdi-view-dashboard",
    roles: [],
    navigation: true,
  },

  // ===== 管制業務 =====
  {
    id: "control-operation-group",
    label: "管制業務",
    icon: "mdi-camera-control",
    roles: ["site-operation-schedules:write"],
    navigation: true,
    children: [
      {
        id: "operation-schedules",
        path: "/operation-schedules",
        label: "(Beta) 稼働予定管理",
        icon: "mdi-calendar-multiselect",
        roles: ["site-operation-schedules:write"],
        navigation: true,
      },
      {
        id: "arrangement-manager",
        path: "/arrangement-manager",
        label: "配置管理",
        icon: "mdi-calendar-account",
        roles: ["site-operation-schedules:write"],
        navigation: true,
      },
    ],
  },

  // ===== 稼働実績管理 =====
  {
    id: "operation-results-group",
    // public: false,
    label: "稼働実績管理",
    icon: "mdi-clipboard-check",
    roles: ["operation-results:read"],
    navigation: true,
    children: [
      {
        id: "operation-result-register",
        path: "/operation-result-register",
        label: "上下番確定処理",
        icon: "mdi-checkbox-marked-circle",
        roles: ["operation-results:read"],
        navigation: true,
      },
      {
        id: "operation-results",
        path: "/operation-results",
        label: "稼働実績一覧",
        icon: "mdi-format-list-bulleted",
        roles: ["operation-results:read"],
        navigation: true,
      },
    ],
  },

  // ===== 請求管理 =====
  {
    id: "billings-group",
    label: "請求管理",
    icon: "mdi-file-document-multiple",
    roles: ["operation-billings:read", "billings:read"],
    navigation: true,
    children: [
      {
        id: "billings-operations",
        path: "/billings/operations",
        label: "稼働請求一覧",
        icon: "mdi-file-document",
        roles: ["operation-billings:read"],
        navigation: true,
      },
      {
        id: "billings-customers",
        path: "/billings/customers",
        label: "取引先請求一覧",
        icon: "mdi-file-document-outline",
        roles: ["billings:read"],
        navigation: true,
      },
    ],
  },

  // ===== 取引先管理 =====
  {
    id: "customers-group",
    label: "取引先管理",
    icon: "mdi-domain",
    roles: ["customers:read"],
    navigation: true,
    children: [
      {
        id: "customers",
        path: "/customers",
        label: "取引先一覧",
        icon: "mdi-format-list-bulleted",
        roles: ["customers:read"],
        navigation: true,
      },
      {
        id: "customer-detail",
        path: "/customers/[id]",
        label: "取引先詳細",
        icon: "mdi-format-list-bulleted",
        roles: ["customers:read"],
        navigation: false,
      },
    ],
  },

  // ===== 現場管理 =====
  {
    id: "sites-group",
    label: "現場管理",
    icon: "mdi-pickaxe",
    roles: ["sites:read"],
    navigation: true,
    children: [
      {
        id: "sites",
        path: "/sites",
        label: "現場一覧",
        icon: "mdi-format-list-bulleted",
        roles: ["sites:read"],
        navigation: true,
      },
      {
        id: "site-detail",
        path: "/sites/[id]",
        label: "現場詳細",
        icon: "mdi-format-list-bulleted",
        roles: ["sites:read"],
        navigation: false,
      },
    ],
  },

  // ===== 従業員管理 =====
  {
    id: "employees-group",
    label: "従業員管理",
    icon: "mdi-account-multiple",
    roles: ["employees:read"],
    navigation: true,
    children: [
      {
        id: "employees",
        path: "/employees",
        label: "在職者一覧",
        icon: "mdi-format-list-bulleted",
        roles: ["employees:read"],
        navigation: true,
      },
      {
        id: "employee-detail",
        path: "/employees/[id]",
        label: "在職者詳細",
        icon: "mdi-format-list-bulleted",
        roles: ["employees:read"],
        navigation: false,
      },
      {
        id: "employees-terminated",
        path: "/employees/terminated",
        label: "退職者検索",
        icon: "mdi-format-list-bulleted",
        roles: ["employees:read"],
        navigation: true,
      },
    ],
  },

  // ===== 外注先管理 =====
  {
    id: "outsourcers-group",
    label: "外注先管理",
    icon: "mdi-handshake",
    roles: ["outsourcers:read"],
    navigation: true,
    children: [
      {
        id: "outsourcers",
        path: "/outsourcers",
        label: "外注先一覧",
        icon: "mdi-format-list-bulleted",
        roles: ["outsourcers:read"],
        navigation: true,
      },
    ],
  },

  // ===== 設定（管理者のみ） =====
  {
    id: "settings",
    label: "設定",
    icon: "mdi-cog",
    roles: ["admin"],
    navigation: true,
    children: [
      {
        id: "company-setting",
        path: "/settings/company",
        label: "会社設定",
        icon: "mdi-office-building",
        roles: ["admin"],
        navigation: true,
      },
      {
        id: "users-setting",
        path: "/settings/users",
        label: "ユーザー設定",
        icon: "mdi-account-cog",
        roles: ["admin"],
        navigation: true,
      },
      {
        id: "checkout",
        path: "/settings/checkout",
        label: "サブスクリプション管理",
        icon: "mdi-account-cog",
        roles: ["super-user"],
        navigation: false,
      },
    ],
  },
  // 他のページやグループを追加
];

// --- ヘルパー関数 ---
import { useRolePresets } from "@/composables/useRolePresets";
/**
 * ユーザーが指定されたページにアクセス可能かどうかを判定する
 * - 役割プリセット（manager, controller など）と機能単位の権限（sites:read など）の両方に対応
 *
 * @param {Array<string>} requiredRoles - ページに必要な役割・権限の配列
 * @param {Array<string>} userRoles - ユーザーが持つ役割の配列
 * @returns {boolean} アクセス可能な場合は true
 *
 * ## 動作例
 *
 * ### 役割指定がない場合
 * ```javascript
 * hasAccess([], ['controller']) // → true (認証済みなら誰でもOK)
 * ```
 *
 * ### 役割プリセットでチェック
 * ```javascript
 * // controller ロールを持つユーザー
 * hasAccess(['controller'], ['controller']) // → true (直接一致)
 * hasAccess(['manager'], ['controller']) // → false (一致しない)
 * ```
 *
 * ### 機能単位の権限でチェック
 * ```javascript
 * // controller ロールを持つユーザー
 * hasAccess(['sites:write'], ['controller'])
 * // → true (controller には sites:write が含まれる)
 *
 * hasAccess(['billings:write'], ['controller'])
 * // → false (controller には billings:write が含まれない)
 * ```
 *
 * ### admin/super-user は常にアクセス可能
 * ```javascript
 * hasAccess(['admin'], ['admin']) // → true (すべての権限)
 * hasAccess(['sites:write'], ['admin']) // → true (すべての権限)
 * hasAccess(['billings:write'], ['super-user']) // → true (すべての権限)
 * ```
 */
function hasAccess(requiredRoles, userRoles) {
  // 役割指定がない場合は、認証済みならOK
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // ユーザーに役割がない場合はアクセス不可
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  // useRolePresets から権限チェック関数を取得
  const { getPermissions } = useRolePresets();

  // ユーザーが持つすべての権限を取得
  const userPermissions = getPermissions(userRoles);

  // すべての権限を持つ場合（admin または super-user）
  if (userPermissions.includes("*")) {
    return true;
  }

  // 要求される役割・権限のいずれかを持っているかチェック
  return requiredRoles.some((required) => {
    // 1. ユーザーの役割に直接含まれているか
    if (userRoles.includes(required)) {
      return true;
    }

    // 2. ユーザーの権限に含まれているか
    if (userPermissions.includes(required)) {
      return true;
    }

    return false;
  });
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
      // public プロパティのデフォルト値を設定
      const config = { public: false, ...item };
      if (config.path) {
        const normalizedPath = config.path.replace(/\/$/, "") || "/";
        map[normalizedPath] = config; // public を含んだオブジェクトを格納
      }
      if (config.children) {
        // children にも public: false を伝播させるか、
        // もしくは children 内で明示的に public を設定するかは設計次第
        // ここでは子の public は子自身で定義される想定
        recurse(config.children);
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
      const config = { public: false, ...item };

      if (config.path) {
        const normalizedPath = config.path.replace(/\/$/, "") || "/";

        // 親パスを記録
        if (parentPath) {
          map[normalizedPath] = parentPath;
        }

        // このアイテムが子を持つ場合、子の親はこのアイテム
        if (config.children) {
          recurse(config.children, normalizedPath);
        }
      } else if (config.children) {
        // path がないグループの場合
        // 子要素同士で親子関係を判定する必要がある

        // まず子要素を収集
        const childPaths = config.children
          .filter((child) => child.path)
          .map((child) => child.path.replace(/\/$/, "") || "/");

        // 子要素の中で最も短いパス（親候補）を見つける
        const sortedPaths = [...childPaths].sort((a, b) => a.length - b.length);

        if (sortedPaths.length > 0) {
          const potentialParent = sortedPaths[0];

          // 他の子パスがこの親の配下にあるか判定
          for (const childPath of childPaths) {
            if (
              childPath !== potentialParent &&
              childPath.startsWith(potentialParent + "/")
            ) {
              map[childPath] = potentialParent;
            }
          }
        }

        // 再帰処理（親パスは引き継ぐ）
        recurse(config.children, parentPath);
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
export function isPageAllowed(path, userRoles) {
  const pageConfig = getPageConfig(path);

  if (!pageConfig) {
    // 設定が見つからないパスはアクセス不可
    console.warn(`No page configuration found for path: ${path}`);
    return false;
  }

  // public フラグはここでは見ない。純粋にロールのチェックのみ。
  return hasAccess(pageConfig.roles, userRoles);
}

/**
 * ユーザーロールに基づいてナビゲーションメニュー用の項目リストを生成
 * (この関数のロジックは roles の解釈が変わっても影響を受けにくい)
 * @param {string[]} userRoles - 現在のユーザーロール配列
 * @returns {Array} ナビゲーション項目リスト
 */
export function getNavigationItems(userRoles) {
  function filterAndMap(items) {
    const result = [];
    for (const item of items) {
      const config = { public: false, ...item }; // public デフォルト値

      // ナビゲーション表示は roles を満たす必要がある
      if (hasAccess(config.roles, userRoles)) {
        if (config.navigation) {
          const navItem = {
            title: config.label,
            value: config.id,
            to: config.path,
            prependIcon: config.icon,
          };

          if (config.children) {
            const accessibleChildren = filterAndMap(config.children);
            if (accessibleChildren.length > 0) {
              navItem.children = accessibleChildren;
              if (!config.path) {
                delete navItem.to;
              }
              result.push(navItem);
            }
          } else if (config.path) {
            result.push(navItem);
          }
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
 * pageSettings の整合性をチェック
 * - 親の roles より子の roles が緩い場合は警告
 */
export function validatePageSettings() {
  function validate(items, parentRoles = []) {
    for (const item of items) {
      const config = { public: false, roles: [], ...item };

      // 通常の役割（manager, controller など）が含まれている場合は警告
      const normalRoles = [
        "manager",
        "controller",
        "accountant",
        "labor",
        "legal",
      ];
      const foundNormalRoles = config.roles.filter((role) =>
        normalRoles.includes(role),
      );

      if (foundNormalRoles.length > 0) {
        console.warn(
          `⚠️ [pageSettings] "${config.label}" (${config.id}): ` +
            `通常の役割 [${foundNormalRoles}] が指定されています。` +
            `権限ベース（例: "sites:read"）での指定を推奨します。`,
        );
      }

      // 親に roles がある場合、子も同等以上の制限が必要
      if (parentRoles.length > 0 && config.roles.length === 0) {
        console.warn(
          `⚠️ [pageSettings] "${config.label}" (${config.id}): ` +
            `親は roles: [${parentRoles}] だが、子は roles: [] (制限なし)`,
        );
      }

      // 親の roles に含まれない role が子にある場合も警告
      if (config.roles.length > 0 && parentRoles.length > 0) {
        const missingRoles = config.roles.filter(
          (role) => !parentRoles.includes(role),
        );
        if (missingRoles.length > 0) {
          console.warn(
            `⚠️ [pageSettings] "${config.label}" (${config.id}): ` +
              `子の roles [${missingRoles}] は親の roles [${parentRoles}] に含まれていません`,
          );
        }
      }

      // 再帰的にチェック
      if (config.children) {
        validate(
          config.children,
          config.roles.length > 0 ? config.roles : parentRoles,
        );
      }
    }
  }

  validate(pageStructure);
}

// 開発環境でのみバリデーション実行
if (process.env.NODE_ENV === "development") {
  validatePageSettings();
}

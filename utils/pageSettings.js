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
 */
export const pageStructure = [
  {
    id: "sign-in",
    path: "/sign-in",
    public: true, // 公開ページ
    label: "サインイン",
    roles: [], // 認証済みユーザーはアクセスしない想定だが定義はしておく
    navigation: false,
  },
  {
    id: "sign-up",
    path: "/sign-up",
    public: true, // 公開ページ
    label: "サインアップ",
    roles: [],
    navigation: false,
  },
  {
    id: "test", // ルートパスを追加 (公開ページとする例)
    path: "/test",
    label: "テスト",
    roles: [],
    navigation: true,
  },
  {
    id: "home", // ルートパスを追加 (公開ページとする例)
    path: "/",
    public: true, // 公開ページ
    label: "ホーム",
    roles: [],
    navigation: false,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    // public: false, (デフォルトなので省略可)
    label: "ダッシュボード",
    icon: "mdi-view-dashboard",
    roles: [], // 認証済みなら誰でもOK
    navigation: true,
  },
  {
    id: "employees-group",
    // public: false,
    label: "従業員管理",
    icon: "mdi-account-multiple",
    roles: [], // グループ自体は認証済みなら誰でも見える (中のページは別)
    navigation: true,
    children: [
      {
        id: "employees-list",
        path: "/employees",
        // public: false,
        label: "社員一覧",
        icon: "mdi-account-details", // アイコンを追加
        roles: [], // 認証済みなら誰でもOK
        navigation: true,
      },
      {
        id: "employee-contracts",
        path: "/employees/contracts",
        // public: false,
        label: "雇用契約",
        icon: "mdi-file-document-outline", // アイコンを追加
        roles: [], // 特定ロールが必要
        navigation: true,
      },
      {
        id: "medical-checkups",
        path: "/employees/medical-checkups",
        // public: false,
        label: "健康診断",
        icon: "mdi-medical-bag", // アイコンを追加
        roles: [], // 特定ロールが必要
        navigation: true,
      },
    ],
  },
  {
    id: "settings",
    label: "設定",
    icon: "mdi-cog",
    roles: ["admin"], // 特定ロールが必要"
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
        icon: "mdi-account",
        roles: ["admin"],
        navigation: true,
      },
    ],
  },
  // 他のページやグループを追加
];

// --- ヘルパー関数 ---

/**
 * ユーザーが特定の役割を持っているかチェック (認証済み前提)
 * @param {string[]} requiredRoles - ページ/項目に必要な役割 (空配列はロール不問)
 * @param {string[]} userRoles - ユーザーが持つ役割
 * @returns {boolean} アクセス可能か
 */
function hasAccess(requiredRoles, userRoles) {
  // 役割指定がない場合は、認証済みならOK (ここでは true を返す)
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  // ユーザーに役割がない場合はアクセス不可 (指定がある場合)
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  // ユーザーが要求される役割のいずれかを持っているか
  return userRoles.some((role) => requiredRoles.includes(role));
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
 * 指定されたパスの設定オブジェクトを取得する
 * @param {string} path - ルートパス
 * @returns {object | undefined} ページ設定オブジェクト、見つからなければ undefined
 */
export function getPageConfig(path) {
  const normalizedPath = path.replace(/\/$/, "") || "/";
  return pagesByPath[normalizedPath];
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

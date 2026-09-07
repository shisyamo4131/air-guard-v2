import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isKnownPageAccessPolicy,
  isPageAccessAllowed,
  isPublicPageAccessPolicy,
  PAGE_ACCESS_POLICIES,
} from "../../utils/auth/policies/pageAccessPolicy.js";
import {
  getNavigationItems,
  getPageConfig,
  isPageAllowed,
  isPageConfigAllowed,
  pageStructure,
  validatePageSettings,
} from "../../utils/pageSettings.js";

const expectedPolicyKeys = [
  "ADMIN",
  "AUTHENTICATED",
  "BILLINGS_READ",
  "CUSTOMERS_READ",
  "DEVELOPER",
  "EMPLOYEES_READ",
  "LIFECYCLE_HISTORY",
  "OPERATION_RESULTS_READ",
  "OUTSOURCERS_READ",
  "PUBLIC",
  "SITES_READ",
  "SITE_OPERATION_SCHEDULES_READ",
  "SUPER_USER",
  "USER_MANAGEMENT",
];

const expectedRoutePolicies = new Map([
  ["/auth/sign-up-admin", PAGE_ACCESS_POLICIES.PUBLIC],
  ["/auth/sign-up", PAGE_ACCESS_POLICIES.PUBLIC],
  ["/auth/sign-in", PAGE_ACCESS_POLICIES.PUBLIC],
  ["/super-user", PAGE_ACCESS_POLICIES.SUPER_USER],
  ["/test/component-test", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/test/permissions-test", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/test/rollback-operation-result", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/test/round-setting-test", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/", PAGE_ACCESS_POLICIES.PUBLIC],
  ["/dashboard", PAGE_ACCESS_POLICIES.AUTHENTICATED],
  [
    "/operation-schedules",
    PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
  ],
  [
    "/arrangements-manager",
    PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
  ],
  [
    "/operation-results/generator",
    PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ,
  ],
  ["/operation-results", PAGE_ACCESS_POLICIES.OPERATION_RESULTS_READ],
  ["/operation-results/[id]", PAGE_ACCESS_POLICIES.OPERATION_RESULTS_READ],
  ["/attendances", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/attendances/export", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/billings/operations", PAGE_ACCESS_POLICIES.BILLINGS_READ],
  ["/billings/operations/[id]", PAGE_ACCESS_POLICIES.BILLINGS_READ],
  ["/billings/customers", PAGE_ACCESS_POLICIES.BILLINGS_READ],
  ["/billings/customers/[id]", PAGE_ACCESS_POLICIES.BILLINGS_READ],
  ["/customers", PAGE_ACCESS_POLICIES.CUSTOMERS_READ],
  ["/customers/[id]", PAGE_ACCESS_POLICIES.CUSTOMERS_READ],
  ["/sites", PAGE_ACCESS_POLICIES.SITES_READ],
  ["/sites/[id]", PAGE_ACCESS_POLICIES.SITES_READ],
  ["/sites/terminated", PAGE_ACCESS_POLICIES.SITES_READ],
  ["/employees", PAGE_ACCESS_POLICIES.EMPLOYEES_READ],
  ["/employees/[id]", PAGE_ACCESS_POLICIES.EMPLOYEES_READ],
  ["/employees/resigned", PAGE_ACCESS_POLICIES.EMPLOYEES_READ],
  ["/outsourcers", PAGE_ACCESS_POLICIES.OUTSOURCERS_READ],
  ["/settings/user", PAGE_ACCESS_POLICIES.ADMIN],
  ["/articles", PAGE_ACCESS_POLICIES.DEVELOPER],
  ["/settings/company", PAGE_ACCESS_POLICIES.ADMIN],
  ["/settings/users", PAGE_ACCESS_POLICIES.USER_MANAGEMENT],
  ["/settings/lifecycle-history", PAGE_ACCESS_POLICIES.LIFECYCLE_HISTORY],
]);

function flattenPageStructure(items) {
  return items.flatMap((item) => [
    item,
    ...flattenPageStructure(item.children ?? []),
  ]);
}

function navigationValues(items) {
  return items.flatMap((item) => [
    item.value,
    ...navigationValues(item.children ?? []),
  ]);
}

function validateWithWarnings(pages) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    return { isValid: validatePageSettings(pages), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

test("page structure assigns one known policy to every route and none to groups", () => {
  const nodes = flattenPageStructure(pageStructure);
  const routeNodes = nodes.filter((node) => Object.hasOwn(node, "path"));
  const groupNodes = nodes.filter((node) => !Object.hasOwn(node, "path"));

  assert.equal(nodes.length, 47);
  assert.equal(routeNodes.length, 35);
  assert.equal(groupNodes.length, 12);
  assert.equal(expectedRoutePolicies.size, 35);

  for (const node of routeNodes) {
    assert.equal(
      Object.hasOwn(node, "accessPolicy"),
      true,
      `${node.id}: accessPolicy`,
    );
    assert.equal(
      isKnownPageAccessPolicy(node.accessPolicy),
      true,
      `${node.id}: known policy`,
    );
    assert.equal(
      node.accessPolicy,
      expectedRoutePolicies.get(node.path),
      `${node.id}: expected policy`,
    );
  }

  for (const node of groupNodes) {
    assert.equal(
      Object.hasOwn(node, "accessPolicy"),
      false,
      `${node.id}: pathless group policy`,
    );
  }

  for (const node of nodes) {
    for (const legacyField of [
      "public",
      "roles",
      "strictPresetPermissions",
      "allowAdmin",
    ]) {
      assert.equal(
        Object.hasOwn(node, legacyField),
        false,
        `${node.id}: legacy ${legacyField}`,
      );
    }
  }
});

test("policy catalog and shared descriptors are immutable identity values", () => {
  assert.deepEqual(Object.keys(PAGE_ACCESS_POLICIES).sort(), expectedPolicyKeys);
  assert.equal(Object.isFrozen(PAGE_ACCESS_POLICIES), true);
  assert.equal(new Set(Object.values(PAGE_ACCESS_POLICIES)).size, 14);

  for (const policy of Object.values(PAGE_ACCESS_POLICIES)) {
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(isKnownPageAccessPolicy(policy), true);
    if (Array.isArray(policy.requiredRoles)) {
      assert.equal(Object.isFrozen(policy.requiredRoles), true);
    }
  }

  const publicClone = { ...PAGE_ACCESS_POLICIES.PUBLIC };
  for (const unknown of [publicClone, {}, null, [], "public", undefined]) {
    assert.equal(isKnownPageAccessPolicy(unknown), false);
    assert.equal(isPublicPageAccessPolicy(unknown), false);
    assert.equal(isPageAccessAllowed(unknown, ["manager"]), false);
  }

  assert.equal(isPublicPageAccessPolicy(PAGE_ACCESS_POLICIES.PUBLIC), true);
  for (const policy of Object.values(PAGE_ACCESS_POLICIES)) {
    if (policy !== PAGE_ACCESS_POLICIES.PUBLIC) {
      assert.equal(isPublicPageAccessPolicy(policy), false);
    }
  }
});

test("runtime rejects legacy access fields even when a policy is known", () => {
  const legacyValues = {
    public: true,
    roles: [],
    strictPresetPermissions: ["users:write"],
    allowAdmin: true,
  };

  for (const [legacyField, legacyValue] of Object.entries(legacyValues)) {
    const authenticatedConfig = {
      accessPolicy: PAGE_ACCESS_POLICIES.AUTHENTICATED,
      [legacyField]: legacyValue,
    };
    const publicConfig = {
      accessPolicy: PAGE_ACCESS_POLICIES.PUBLIC,
      [legacyField]: legacyValue,
    };

    assert.equal(
      isPageConfigAllowed(authenticatedConfig, ["manager"]),
      false,
      `known policy + ${legacyField}`,
    );
    assert.equal(
      isPageConfigAllowed(publicConfig, []),
      false,
      `PUBLIC + ${legacyField}`,
    );
    assert.equal(
      isPageConfigAllowed(publicConfig, []) &&
        isPublicPageAccessPolicy(publicConfig.accessPolicy),
      false,
      `public evaluation + ${legacyField}`,
    );
  }

  assert.equal(
    isPageConfigAllowed(
      {
        accessPolicy: { ...PAGE_ACCESS_POLICIES.AUTHENTICATED },
        roles: [],
      },
      ["manager"],
    ),
    false,
  );
});

test("general policies preserve authenticated, exclusive, admin, and permission behavior", () => {
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.AUTHENTICATED, []),
    true,
  );

  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SUPER_USER, ["super-user"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SUPER_USER, ["admin"]),
    false,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.DEVELOPER, ["developer"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.DEVELOPER, ["super-user"]),
    false,
  );

  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.ADMIN, ["admin"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.ADMIN, ["super-user"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.ADMIN, ["manager"]),
    false,
  );

  const policyCases = [
    [PAGE_ACCESS_POLICIES.SITE_OPERATION_SCHEDULES_READ, "controller"],
    [PAGE_ACCESS_POLICIES.OPERATION_RESULTS_READ, "controller"],
    [PAGE_ACCESS_POLICIES.BILLINGS_READ, "accountant"],
    [PAGE_ACCESS_POLICIES.CUSTOMERS_READ, "controller"],
    [PAGE_ACCESS_POLICIES.SITES_READ, "controller"],
    [PAGE_ACCESS_POLICIES.EMPLOYEES_READ, "human-resource"],
    [PAGE_ACCESS_POLICIES.OUTSOURCERS_READ, "manager"],
  ];
  for (const [policy, preset] of policyCases) {
    assert.equal(isPageAccessAllowed(policy, [preset]), true, preset);
    assert.equal(isPageAccessAllowed(policy, []), false, `${preset}: empty`);
  }

  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SITES_READ, ["sites:read"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SITES_READ, ["sites:write"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SITES_READ, ["admin"]),
    true,
  );
  assert.equal(
    isPageAccessAllowed(PAGE_ACCESS_POLICIES.SITES_READ, ["super-user"]),
    true,
  );
});

test("special policies preserve exclusive behavior for combined roles", () => {
  const specialCases = [
    [PAGE_ACCESS_POLICIES.DEVELOPER, ["developer"], true],
    [PAGE_ACCESS_POLICIES.DEVELOPER, ["admin", "developer"], true],
    [PAGE_ACCESS_POLICIES.DEVELOPER, ["super-user", "developer"], true],
    [PAGE_ACCESS_POLICIES.DEVELOPER, ["admin"], false],
    [PAGE_ACCESS_POLICIES.DEVELOPER, ["super-user"], false],
    [PAGE_ACCESS_POLICIES.SUPER_USER, ["super-user"], true],
    [PAGE_ACCESS_POLICIES.SUPER_USER, ["admin", "super-user"], true],
    [PAGE_ACCESS_POLICIES.SUPER_USER, ["developer", "super-user"], true],
    [PAGE_ACCESS_POLICIES.SUPER_USER, ["admin"], false],
    [PAGE_ACCESS_POLICIES.SUPER_USER, ["developer"], false],
  ];

  for (const [policy, userRoles, expected] of specialCases) {
    assert.equal(
      isPageAccessAllowed(policy, userRoles),
      expected,
      JSON.stringify({ policy: policy.id, userRoles }),
    );
  }
});

test("restricted general policies deny absent or empty roles", () => {
  for (const userRoles of [null, undefined, []]) {
    for (const policy of [
      PAGE_ACCESS_POLICIES.DEVELOPER,
      PAGE_ACCESS_POLICIES.SITES_READ,
    ]) {
      assert.equal(
        isPageAccessAllowed(policy, userRoles),
        false,
        JSON.stringify({ policy: policy.id, userRoles }),
      );
    }
  }
});

test("User management accepts only company admin or a valid users:write preset", () => {
  const policy = PAGE_ACCESS_POLICIES.USER_MANAGEMENT;
  const context = (presetRoles, isAdmin = false) => ({
    presetRoles,
    isAdmin,
  });

  assert.equal(
    isPageAccessAllowed(policy, ["manager"], context(["manager"])),
    true,
  );
  assert.equal(isPageAccessAllowed(policy, [], context([], true)), true);

  for (const [userRoles, accessContext] of [
    [["human-resource"], context(["human-resource"])],
    [["controller"], context(["controller"])],
    [["users:write"], context(["users:write"])],
    [["super-user"], context([])],
    [["developer"], context([])],
    [["manager", "unknown"], context(["manager", "unknown"])],
    [["admin"], context(["manager", "unknown-role"], true)],
    [["admin"], context(["manager", 1], true)],
    [["manager"], context(null)],
    [["manager"], context("manager")],
    [["manager"], context([1])],
    [["manager"], context([""])],
    [["manager"], context([], "true")],
    [["manager"], { presetRoles: ["manager"] }],
    [["manager"], null],
    [["manager"], {}],
  ]) {
    assert.equal(
      isPageAccessAllowed(policy, userRoles, accessContext),
      false,
      JSON.stringify({ userRoles, accessContext }),
    );
  }
});

test("all configured routes resolve to the catalog policy and dynamic routes retain it", () => {
  for (const [path, policy] of expectedRoutePolicies) {
    assert.equal(getPageConfig(path)?.accessPolicy, policy, path);
  }

  assert.equal(getPageConfig("/employees/employee-001")?.id, "employee-detail");
  assert.equal(
    getPageConfig("/operation-results/result-001")?.id,
    "operation-results-detail",
  );
  assert.equal(
    isPageAllowed("/employees/employee-001", ["human-resource"], {
      presetRoles: ["human-resource"],
      isAdmin: false,
    }),
    true,
  );

  for (const malformed of [
    null,
    {},
    { accessPolicy: null },
    { accessPolicy: {} },
    { accessPolicy: { ...PAGE_ACCESS_POLICIES.AUTHENTICATED } },
  ]) {
    assert.equal(isPageConfigAllowed(malformed, ["manager"]), false);
  }
});

test("route and navigation share User management policy while groups derive children", () => {
  const managerContext = { presetRoles: ["manager"], isAdmin: false };
  const adminContext = { presetRoles: [], isAdmin: true };
  const directContext = { presetRoles: ["users:write"], isAdmin: false };

  assert.equal(isPageAllowed("/settings/users", ["manager"], managerContext), true);
  assert.equal(isPageAllowed("/settings/users", ["admin"], adminContext), true);
  assert.equal(
    isPageAllowed("/settings/users", ["users:write"], directContext),
    false,
  );
  assert.equal(
    isPageAllowed("/settings/users", ["super-user"], {
      presetRoles: [],
      isAdmin: false,
    }),
    false,
  );

  const managerNavigation = navigationValues(
    getNavigationItems(["manager"], managerContext),
  );
  assert.equal(managerNavigation.includes("admin-settings"), true);
  assert.equal(managerNavigation.includes("users-setting"), true);
  assert.equal(managerNavigation.includes("company-setting"), false);

  const adminNavigation = navigationValues(
    getNavigationItems(["admin"], adminContext),
  );
  assert.equal(adminNavigation.includes("admin-settings"), true);
  assert.equal(adminNavigation.includes("company-setting"), true);
  assert.equal(adminNavigation.includes("users-setting"), true);

  const directNavigation = navigationValues(
    getNavigationItems(["sites:read"], {
      presetRoles: [],
      isAdmin: false,
    }),
  );
  assert.equal(directNavigation.includes("sites-group"), true);
  assert.equal(directNavigation.includes("sites"), true);
  assert.equal(directNavigation.includes("admin-settings"), false);
});

test("lifecycle history route and navigation are company-admin only", () => {
  const actorUser = {
    docId: "actor-a",
    companyId: "company-a",
    isTemporary: false,
    disabled: false,
    isAdmin: true,
    roles: [],
  };
  const context = {
    presetRoles: [],
    isAdmin: true,
    companyId: "company-a",
    actorUid: "actor-a",
    actorUser,
    isSuperUser: false,
  };

  assert.equal(
    isPageAllowed("/settings/lifecycle-history", ["admin"], context),
    true,
  );
  assert.equal(
    navigationValues(getNavigationItems(["admin"], context)).includes(
      "lifecycle-history",
    ),
    true,
  );

  const deniedContexts = [
    {
      ...context,
      isAdmin: false,
      actorUser: { ...actorUser, isAdmin: false, roles: ["manager"] },
    },
    {
      ...context,
      isAdmin: false,
      actorUser: {
        ...actorUser,
        isAdmin: false,
        roles: ["human-resource"],
      },
    },
    {
      ...context,
      isAdmin: false,
      actorUser: { ...actorUser, isAdmin: false, roles: ["users:write"] },
    },
    { ...context, isSuperUser: true },
    { ...context, actorUid: "stale", actorUser },
    { ...context, companyId: "company-b" },
  ];
  for (const denied of deniedContexts) {
    assert.equal(
      isPageAllowed("/settings/lifecycle-history", ["manager"], denied),
      false,
    );
    assert.equal(
      navigationValues(getNavigationItems(["manager"], denied)).includes(
        "lifecycle-history",
      ),
      false,
    );
  }
});

test("super-user navigation exposes Company settings without legacy checkout", () => {
  const superUserRoles = ["super-user"];
  const superUserContext = { presetRoles: [], isAdmin: false };
  const navigation = navigationValues(
    getNavigationItems(superUserRoles, superUserContext),
  );

  assert.equal(navigation.includes("admin-settings"), true);
  assert.equal(navigation.includes("company-setting"), true);
  assert.equal(navigation.includes("users-setting"), false);
  assert.equal(navigation.includes("checkout"), false);
  assert.equal(
    isPageAllowed("/settings/company", superUserRoles, superUserContext),
    true,
  );
  assert.equal(
    isPageAllowed("/settings/users", superUserRoles, superUserContext),
    false,
  );
  assert.equal(
    flattenPageStructure(pageStructure).some(
      (page) => page.path === "/settings/checkout",
    ),
    false,
  );
});

test("page settings validator accepts current structure and rejects invalid shapes", () => {
  assert.equal(validateWithWarnings(pageStructure).isValid, true);

  const page = (overrides = {}) => ({
    id: "page",
    path: "/page",
    label: "Page",
    navigation: false,
    accessPolicy: PAGE_ACCESS_POLICIES.AUTHENTICATED,
    ...overrides,
  });
  const group = (overrides = {}) => ({
    id: "group",
    label: "Group",
    navigation: true,
    children: [page()],
    ...overrides,
  });

  const invalidStructures = [
    [page({ roles: [] })],
    [page({ accessPolicy: undefined })],
    [page({ accessPolicy: { ...PAGE_ACCESS_POLICIES.AUTHENTICATED } })],
    [group({ accessPolicy: PAGE_ACCESS_POLICIES.AUTHENTICATED })],
    [page(), page({ path: "/other" })],
    [page(), page({ id: "other" })],
    [{ id: "empty-group", label: "Empty", navigation: true }],
  ];

  for (const pages of invalidStructures) {
    const result = validateWithWarnings(pages);
    assert.equal(result.isValid, false, JSON.stringify(pages));
    assert.ok(result.warnings.length > 0, JSON.stringify(pages));
  }
});

test("unregistered absolute routes retain the existing root fallback", () => {
  const config = getPageConfig("/not-registered/path");
  assert.equal(config?.id, "home");
  assert.equal(config?.accessPolicy, PAGE_ACCESS_POLICIES.PUBLIC);
  assert.equal(isPageAllowed("/not-registered/path", []), true);
});

test("middleware identifies public pages through accessPolicy only", async () => {
  const source = await readFile(
    new URL("../../middleware/auth.global.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /isPublicPageAccessPolicy/);
  assert.match(
    source,
    /const isPublicPage =\s*isPageConfigAllowed\(pageConfig, \[\]\) &&\s*isPublicPageAccessPolicy\(pageConfig\?\.accessPolicy\)/,
  );
  assert.doesNotMatch(source, /pageConfig\?\.public/);
  assert.match(
    source,
    /if \(!isAuthenticated\) \{\s*if \(isPublicPage\) return;/,
  );
  assert.match(
    source,
    /if \(isPublicPage\) \{\s*if \(targetPath !== "\/dashboard"\)/,
  );
  assert.match(
    source,
    /if \(!pageConfig\) \{\s*return;\s*\}/,
  );
});

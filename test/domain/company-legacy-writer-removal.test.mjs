import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseJavaScript } from "@babel/parser";
import { parse as parseSfc } from "@vue/compiler-sfc";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const clientSourceFiles = ["app.vue"];
const clientSourceDirectories = [
  "app",
  "assets",
  "components",
  "composables",
  "config",
  "handlers",
  "layouts",
  "middleware",
  "mocks",
  "pages",
  "plugins",
  "schemas",
  "service-worker",
  "services",
  "stores",
  "utils",
];
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".vue"]);
const companyMethods = new Set(["create", "update", "delete"]);
const firestoreWriters = new Set(["setDoc", "updateDoc", "deleteDoc"]);
const collectionWriters = new Set(["addDoc"]);

async function collectDirectorySources(relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...(await collectDirectorySources(relativePath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      sources.push({
        path: relativePath.replaceAll("\\", "/"),
        source: await readFile(path.join(repositoryRoot, relativePath), "utf8"),
      });
    }
  }
  return sources;
}

async function collectClientSources() {
  for (const relativePath of [
    ...clientSourceFiles,
    ...clientSourceDirectories,
  ]) {
    await access(path.join(repositoryRoot, relativePath));
  }
  const files = await Promise.all(
    clientSourceFiles.map(async (relativePath) => ({
      path: relativePath,
      source: await readFile(path.join(repositoryRoot, relativePath), "utf8"),
    })),
  );
  const directories = await Promise.all(
    clientSourceDirectories.map(collectDirectorySources),
  );
  return [...files, ...directories.flat()];
}

function scriptsFromSource(sourcePath, source) {
  if (!sourcePath.endsWith(".vue")) return [source];
  if (!/<script\b/u.test(source)) return [];
  const { descriptor, errors } = parseSfc(source, { filename: sourcePath });
  assert.deepEqual(errors, [], `${sourcePath} must remain a valid SFC`);
  return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(
    Boolean,
  );
}

function parsePrograms(sourcePath, source) {
  return scriptsFromSource(sourcePath, source).map(
    (script) =>
      parseJavaScript(script, {
        sourceType: "unambiguous",
        errorRecovery: false,
        plugins: [
          "decorators-legacy",
          "importMeta",
          "jsx",
          "topLevelAwait",
          "typescript",
        ],
      }).program,
  );
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "extra"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitor);
    } else if (value && typeof value.type === "string") {
      walk(value, visitor);
    }
  }
}

function unwrap(expression) {
  let current = expression;
  while (
    [
      "TSAsExpression",
      "TSSatisfiesExpression",
      "TSNonNullExpression",
      "TypeCastExpression",
    ].includes(current?.type)
  ) {
    current = current.expression;
  }
  return current;
}

function identifierName(node) {
  return unwrap(node)?.type === "Identifier" ? unwrap(node).name : null;
}

function propertyName(member) {
  const property = unwrap(member?.property);
  if (!member?.computed && property?.type === "Identifier") return property.name;
  if (property?.type === "StringLiteral") return property.value;
  return null;
}

function callName(call) {
  return identifierName(unwrap(call)?.callee);
}

function stringValue(node) {
  const value = unwrap(node);
  if (value?.type === "StringLiteral") return value.value;
  if (
    value?.type === "TemplateLiteral" &&
    value.quasis.length === 1 &&
    value.expressions.length === 0
  ) {
    return value.quasis[0].value.cooked;
  }
  return null;
}

function isCompaniesRootPathExpression(node) {
  const value = unwrap(node);
  const literal = stringValue(value);
  if (literal !== null) {
    const segments = literal.split("/");
    return (
      segments.length === 2 &&
      segments[0] === "Companies" &&
      segments[1].length > 0
    );
  }
  if (value?.type !== "TemplateLiteral") return false;
  return (
    value.expressions.length === 1 &&
    value.quasis.length === 2 &&
    value.quasis[0]?.value?.cooked === "Companies/" &&
    value.quasis[1]?.value?.cooked === ""
  );
}

function isCompanyRootDocCall(
  node,
  docFunctions,
  isCompanyCollection = () => false,
) {
  const value = unwrap(node);
  if (value?.type !== "CallExpression" || !docFunctions.has(callName(value))) {
    return false;
  }
  if (value.arguments.length === 3) {
    return stringValue(value.arguments[1]) === "Companies";
  }
  return (
    value.arguments.length === 2 &&
    (isCompaniesRootPathExpression(value.arguments[1]) ||
      isCompanyCollection(value.arguments[0]))
  );
}

function isCompanyCollectionCall(node, collectionFunctions) {
  const value = unwrap(node);
  return (
    value?.type === "CallExpression" &&
    collectionFunctions.has(callName(value)) &&
    value.arguments.length === 2 &&
    stringValue(value.arguments[1]) === "Companies"
  );
}

function addName(set, name) {
  if (!name || set.has(name)) return false;
  set.add(name);
  return true;
}

function scanClientSource(sourcePath, source) {
  const programs = parsePrograms(sourcePath, source);
  const nodes = [];
  for (const program of programs) walk(program, (node) => nodes.push(node));

  const companyConstructors = new Set(["Company"]);
  const storeFactories = new Set(["useCompanyStore"]);
  const storeRefFactories = new Set(["storeToRefs"]);
  const docFunctions = new Set(["doc"]);
  const collectionFunctions = new Set(["collection"]);
  const writerFunctions = new Map(
    [...firestoreWriters, ...collectionWriters].map((name) => [name, name]),
  );
  for (const node of nodes) {
    if (node.type !== "ImportDeclaration") continue;
    const moduleName = stringValue(node.source);
    for (const specifier of node.specifiers) {
      const imported = identifierName(specifier.imported);
      const local = identifierName(specifier.local);
      if (!imported || !local) continue;
      if (/schemas(?:\/index\.js)?$/u.test(moduleName ?? "") && imported === "Company") {
        companyConstructors.add(local);
      }
      if (/useCompanyStore/u.test(moduleName ?? "") && imported === "useCompanyStore") {
        storeFactories.add(local);
      }
      if (moduleName === "pinia" && imported === "storeToRefs") {
        storeRefFactories.add(local);
      }
      if (moduleName === "firebase/firestore") {
        if (imported === "doc") docFunctions.add(local);
        if (imported === "collection") collectionFunctions.add(local);
        if (firestoreWriters.has(imported) || collectionWriters.has(imported)) {
          writerFunctions.set(local, imported);
        }
      }
    }
  }

  const stores = new Set();
  const storeRefContainers = new Set();
  const companies = new Set();
  const companyRefs = new Set();
  const companyCollections = new Set();

  const isStore = (expression) => {
    const value = unwrap(expression);
    return (
      (value?.type === "Identifier" && stores.has(value.name)) ||
      (value?.type === "CallExpression" && storeFactories.has(callName(value)))
    );
  };
  const isStoreRefContainer = (expression) => {
    const value = unwrap(expression);
    return (
      (value?.type === "Identifier" && storeRefContainers.has(value.name)) ||
      (value?.type === "CallExpression" &&
        storeRefFactories.has(callName(value)) &&
        isStore(value.arguments[0]))
    );
  };
  const isCompany = (expression) => {
    const value = unwrap(expression);
    if (value?.type === "Identifier") return companies.has(value.name);
    if (value?.type === "MemberExpression") {
      if (propertyName(value) === "company" && isStore(value.object)) return true;
      if (propertyName(value) === "value" && isCompany(value.object)) return true;
    }
    return (
      value?.type === "NewExpression" &&
      companyConstructors.has(identifierName(value.callee))
    );
  };
  const isCompanyCollection = (expression) => {
    const value = unwrap(expression);
    return (
      (value?.type === "Identifier" && companyCollections.has(value.name)) ||
      isCompanyCollectionCall(value, collectionFunctions)
    );
  };
  const isCompanyRef = (expression) => {
    const value = unwrap(expression);
    return (
      (value?.type === "Identifier" && companyRefs.has(value.name)) ||
      isCompanyRootDocCall(value, docFunctions, isCompanyCollection)
    );
  };

  function bind(pattern, initializer) {
    const target = unwrap(pattern);
    const value = unwrap(initializer);
    let changed = false;
    if (target?.type === "Identifier") {
      if (isStore(value)) changed = addName(stores, target.name) || changed;
      if (
        value?.type === "CallExpression" &&
        storeRefFactories.has(callName(value)) &&
        isStore(value.arguments[0])
      ) {
        changed = addName(storeRefContainers, target.name) || changed;
      }
      if (isCompany(value)) changed = addName(companies, target.name) || changed;
      if (isCompanyRef(value)) changed = addName(companyRefs, target.name) || changed;
      if (isCompanyCollection(value)) {
        changed = addName(companyCollections, target.name) || changed;
      }
      return changed;
    }
    if (target?.type !== "ObjectPattern") return false;
    if (!isStore(value) && !isStoreRefContainer(value)) return false;
    for (const property of target.properties) {
      if (property.type !== "ObjectProperty") continue;
      const key = identifierName(property.key) ?? stringValue(property.key);
      if (key !== "company") continue;
      changed = addName(companies, identifierName(property.value)) || changed;
    }
    return changed;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.type === "VariableDeclarator") {
        changed = bind(node.id, node.init) || changed;
      } else if (node.type === "AssignmentExpression" && node.operator === "=") {
        changed = bind(node.left, node.right) || changed;
      }
    }
  }

  const violations = [];
  for (const node of nodes) {
    if (node.type !== "CallExpression") continue;
    const callee = unwrap(node.callee);
    if (
      callee?.type === "MemberExpression" &&
      companyMethods.has(propertyName(callee)) &&
      isCompany(callee.object)
    ) {
      violations.push({
        kind: `company-model-${propertyName(callee)}`,
        line: node.loc?.start.line ?? null,
      });
      continue;
    }

    const canonicalWriter = writerFunctions.get(callName(node));
    if (
      firestoreWriters.has(canonicalWriter) &&
      isCompanyRef(node.arguments[0])
    ) {
      violations.push({
        kind: `firestore-${canonicalWriter}`,
        line: node.loc?.start.line ?? null,
      });
      continue;
    }
    if (
      collectionWriters.has(canonicalWriter) &&
      isCompanyCollection(node.arguments[0])
    ) {
      violations.push({
        kind: `firestore-${canonicalWriter}`,
        line: node.loc?.start.line ?? null,
      });
      continue;
    }
    if (callee?.type !== "MemberExpression") continue;
    const method = propertyName(callee);
    if (
      ["set", "update", "delete"].includes(method) &&
      isCompanyRef(node.arguments[0])
    ) {
      violations.push({
        kind: `firestore-batch-${method}`,
        line: node.loc?.start.line ?? null,
      });
    }
  }
  return violations;
}

async function assertMissing(relativePath) {
  await assert.rejects(
    access(path.join(repositoryRoot, relativePath)),
    (error) => error?.code === "ENOENT",
  );
}

test("scanner detects Company aliases and direct root writers without flagging other models", () => {
  assert.deepEqual(
    scanClientSource(
      "composables/alias.js",
      `
        const companyStore = useCompanyStore();
        const { company: doc } = companyStore;
        doc.update();
      `,
    ).map(({ kind }) => kind),
    ["company-model-update"],
  );
  assert.deepEqual(
    scanClientSource(
      "composables/draft.js",
      `
        const store = useCompanyStore();
        const draft = store.company;
        draft.update(draft);
      `,
    ).map(({ kind }) => kind),
    ["company-model-update"],
  );
  assert.deepEqual(
    scanClientSource(
      "services/company-root.js",
      `
        import { doc as documentRef, setDoc as replace } from "firebase/firestore";
        const root = documentRef(database, "Companies", companyId);
        replace(root, payload);
      `,
    ).map(({ kind }) => kind),
    ["firestore-setDoc"],
  );
  assert.deepEqual(
    scanClientSource(
      "components/Site/Manager.vue",
      `<script setup>const item = useSite(); item.update(item);</script>`,
    ),
    [],
  );
});

test("scanner follows storeToRefs calls and imported aliases to Company refs", () => {
  assert.deepEqual(
    scanClientSource(
      "composables/direct-store-refs.js",
      `
        const { company } = storeToRefs(useCompanyStore());
        company.value.update();
      `,
    ).map(({ kind }) => kind),
    ["company-model-update"],
  );
  assert.deepEqual(
    scanClientSource(
      "composables/aliased-store-refs.js",
      `
        import { storeToRefs as refsAlias } from "pinia";
        const store = useCompanyStore();
        const { company: doc } = refsAlias(store);
        doc.value.update();
      `,
    ).map(({ kind }) => kind),
    ["company-model-update"],
  );
});

test("scanner distinguishes Company root documents from nested collections", () => {
  assert.deepEqual(
    scanClientSource(
      "services/company-root-matrix.js",
      `
        import {
          collection as makeCollection,
          doc as makeDoc,
          setDoc as replace,
          updateDoc as patch,
        } from "firebase/firestore";
        const companyCollection = makeCollection(database, "Companies");
        const rootFromCollection = makeDoc(companyCollection, companyId);
        const rootFromTemplate = makeDoc(database, \`Companies/\${companyId}\`);
        replace(rootFromCollection, payload);
        patch(rootFromTemplate, changes);
      `,
    ).map(({ kind }) => kind),
    ["firestore-setDoc", "firestore-updateDoc"],
  );
  assert.deepEqual(
    scanClientSource(
      "services/company-nested-matrix.js",
      `
        import { doc, setDoc, updateDoc } from "firebase/firestore";
        const settings = doc(
          database,
          \`Companies/\${companyId}/Settings/\${settingsId}\`,
        );
        const nestedBySegments = doc(
          database,
          "Companies",
          companyId,
          "Settings",
          settingsId,
        );
        const site = doc(database, "Sites", siteId);
        setDoc(settings, payload);
        updateDoc(nestedBySegments, changes);
        setDoc(site, payload);
      `,
    ),
    [],
  );
});

test("Nuxt client application has no legacy Company whole-document writer", async () => {
  await assertMissing("components/Company/Manager/index.vue");
  await assertMissing("composables/useSiteOrderManager.js");

  const sources = await collectClientSources();
  const legacyRoutePatterns = [
    /\buseSiteOrderManager\b/u,
    /\bCompanyManager\b/u,
    /components\/Company\/Manager/u,
  ];
  const legacyRouteMatches = sources.filter(({ source }) =>
    legacyRoutePatterns.some((pattern) => pattern.test(source)),
  );
  assert.deepEqual(
    legacyRouteMatches.map(({ path: sourcePath }) => sourcePath),
    [],
  );

  const violations = sources.flatMap(({ path: sourcePath, source }) =>
    scanClientSource(sourcePath, source).map((violation) => ({
      path: sourcePath,
      ...violation,
    })),
  );
  assert.deepEqual(violations, []);

  const genericItemWriters = sources.filter(({ source }) =>
    /\bitem\.update\(item\)/u.test(source),
  );
  assert.ok(
    genericItemWriters.length > 0,
    "non-Company managers remain as the scanner positive control",
  );
  assert.ok(
    genericItemWriters.every(
      ({ path: sourcePath }) => !sourcePath.startsWith("components/Company/"),
    ),
  );
});

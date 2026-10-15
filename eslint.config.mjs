// Section 3 firewall, enforced at lint time (the architecture test enforces it again in CI):
// rescue-side code may never import the relief/donations module.
import tseslint from "typescript-eslint";

const RESCUE_SIDE = [
  "packages/engine/src/**/*.ts",
  "packages/dispatch/src/**/*.ts",
  "apps/web/src/app/control/**/*.{ts,tsx}",
  "apps/web/src/app/sos/**/*.{ts,tsx}",
  "apps/web/src/app/rescuer/**/*.{ts,tsx}",
  "apps/web/src/app/api/dispatch/**/*.ts",
  "apps/web/src/components/control/**/*.{ts,tsx}",
  "apps/web/src/workers/**/*.ts",
  "apps/web/src/server/dispatch/**/*.ts",
];

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "bench/**", "**/*.d.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {},
  },
  {
    files: RESCUE_SIDE,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@floodsetu/relief", message: "Firewall: dispatch must never read donation data (Section 3 / invariant 8)." }],
          patterns: [{ group: ["**/relief", "**/relief/**", "**/server/relief/**"], message: "Firewall: rescue-side code may not import the relief module." }],
        },
      ],
    },
  },
  {
    files: ["packages/relief/src/**/*.ts", "apps/web/src/server/relief/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [{ name: "@floodsetu/engine", message: "Relief consumes only the shared AffectedAreaSummary contract." }, { name: "@floodsetu/dispatch", message: "Relief consumes only the shared AffectedAreaSummary contract." }] }] },
  },
);

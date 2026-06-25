import fs from "fs/promises";
import path from "path";
import { emptyProjectMap, type ProjectMap } from "../storage/project-map.js";
import { HunoError, Result } from "../utils/errors.js";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
  "venv",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".huno",
]);

const TEST_DIRECTORIES = new Set(["tests", "test", "__tests__", "spec", "__spec__"]);
const TEST_FRAMEWORKS = [
  "vitest",
  "jest",
  "mocha",
  "ava",
  "tape",
  "jasmine",
  "cypress",
  "playwright",
  "@testing-library/react",
  "@testing-library",
  "pytest",
];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<Result<any>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: new HunoError("Invalid JSON", "JSON_PARSE_FAILED") };
  }
}

async function readIgnorePatterns(root: string): Promise<string[]> {
  const patterns: string[] = [];

  for (const filename of [".gitignore", ".hunoignore"]) {
    try {
      const raw = await fs.readFile(path.join(root, filename), "utf-8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        patterns.push(trimmed);
      }
    } catch {
      // Ignore files are optional.
    }
  }

  return patterns;
}

function matchesIgnorePattern(relativePath: string, patterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;

    const normalizedPattern = pattern.replace(/^\//, "").replace(/\\/g, "/");
    const directoryPattern = normalizedPattern.endsWith("/")
      ? normalizedPattern.slice(0, -1)
      : normalizedPattern;

    if (normalized === directoryPattern || normalized.startsWith(`${directoryPattern}/`)) {
      return true;
    }

    if (!directoryPattern.includes("/") && segments.includes(directoryPattern)) {
      return true;
    }
  }

  return false;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export async function scanProject(): Promise<Result<ProjectMap>> {
  const root = process.cwd();
  const map = emptyProjectMap();
  map.root = root;
  const ignorePatterns = await readIgnorePatterns(root);

  // Basic metadata
  map.projectName = path.basename(root);

  const hasPackageJson = await exists(path.join(root, "package.json"));
  const hasTsConfig = await exists(path.join(root, "tsconfig.json"));
  const hasPyproject = await exists(path.join(root, "pyproject.toml"));
  const hasRequirementsTxt = await exists(path.join(root, "requirements.txt"));
  const hasPipfile = await exists(path.join(root, "Pipfile"));
  const hasPoetryLock = await exists(path.join(root, "poetry.lock"));
  const hasDockerfile = await exists(path.join(root, "Dockerfile"));
  const hasDockerCompose = await exists(path.join(root, "docker-compose.yml"));
  const hasNextConfig = await exists(path.join(root, "next.config.js")) || await exists(path.join(root, "next.config.ts"));
  const hasViteConfig = await exists(path.join(root, "vite.config.js")) || await exists(path.join(root, "vite.config.ts"));
  const hasPrismaSchema = await exists(path.join(root, "prisma", "schema.prisma"));
  const hasAlembic = await exists(path.join(root, "alembic.ini"));
  const hasReadme = await exists(path.join(root, "README.md")) || await exists(path.join(root, "README"));
  const hasLicense = await exists(path.join(root, "LICENSE")) || await exists(path.join(root, "LICENSE.md"));
  const hasEnvExample = await exists(path.join(root, ".env.example"));
  const hasGit = await exists(path.join(root, ".git"));
  const hasGitignore = await exists(path.join(root, ".gitignore"));
  const hasHunoignore = await exists(path.join(root, ".hunoignore"));
  const hasEnv = await exists(path.join(root, ".env")) || await exists(path.join(root, ".env.local"));

  map.docs = {
    readme: hasReadme,
    license: hasLicense,
    envExample: hasEnvExample,
  };
  map.git = {
    isRepository: hasGit,
  };

  // Languages
  if (hasPackageJson) map.stack.languages.push("JavaScript/TypeScript");
  if (hasTsConfig) {
    const idx = map.stack.languages.indexOf("JavaScript/TypeScript");
    if (idx >= 0) map.stack.languages[idx] = "TypeScript";
  }
  if (hasPyproject || hasRequirementsTxt || hasPipfile || hasPoetryLock) {
    map.stack.languages.push("Python");
  }

  // Frameworks
  if (hasNextConfig) map.stack.frameworks.push("Next.js");
  if (hasViteConfig) map.stack.frameworks.push("Vite");
  if (hasPrismaSchema) {
    map.stack.frameworks.push("Prisma");
    map.stack.database.push("Prisma (schema detected)");
  }
  if (hasAlembic) {
    map.stack.frameworks.push("Alembic (DB migrations)");
  }

  // Backend hints from Python
  if (hasPyproject) {
    const pyprojectPath = path.join(root, "pyproject.toml");
    try {
      const raw = await fs.readFile(pyprojectPath, "utf-8");
      const lower = raw.toLowerCase();
      if (lower.includes("fastapi")) map.stack.frameworks.push("FastAPI");
      if (lower.includes("flask")) map.stack.frameworks.push("Flask");
      if (lower.includes("django")) map.stack.frameworks.push("Django");
      if (lower.includes("sqlalchemy")) map.stack.frameworks.push("SQLAlchemy");
      if (lower.includes("pydantic")) map.stack.frameworks.push("Pydantic");
    } catch {
      // ignore
    }
  }

  // From package.json
  if (hasPackageJson) {
    const pkg = await readJsonFile(path.join(root, "package.json"));
    if (pkg.ok) {
      const deps = pkg.data.dependencies || {};
      const devDeps = pkg.data.devDependencies || {};
      const allDeps = { ...deps, ...devDeps };
      if (deps.next || devDeps.next) map.stack.frameworks.push("Next.js");
      if (deps.react || devDeps.react) map.stack.frameworks.push("React");
      if (deps["react-native"] || devDeps["react-native"]) map.stack.frameworks.push("React Native");
      if (deps.express || devDeps.express) map.stack.frameworks.push("Express");
      if (deps.fastify || devDeps.fastify) map.stack.frameworks.push("Fastify");
      if (deps.prisma || devDeps.prisma) {
        map.stack.frameworks.push("Prisma");
        map.stack.database.push("Prisma");
      }
      if (deps.drizzle || devDeps.drizzle) {
        map.stack.frameworks.push("Drizzle ORM");
        map.stack.database.push("Drizzle ORM");
      }
      if (deps.typeorm || devDeps.typeorm) {
        map.stack.frameworks.push("TypeORM");
        map.stack.database.push("TypeORM");
      }
      if (deps.sequelize || devDeps.sequelize) {
        map.stack.frameworks.push("Sequelize");
        map.stack.database.push("Sequelize");
      }

      map.scripts = pkg.data.scripts || {};
      map.tests.scripts = Object.keys(map.scripts).filter((script) => script.includes("test"));
      map.tests.frameworks = TEST_FRAMEWORKS.filter((framework) => framework in allDeps);
    }
  }

  // Infrastructure
  if (hasDockerfile) map.stack.infrastructure.push("Dockerfile");
  if (hasDockerCompose) map.stack.infrastructure.push("Docker Compose");

  // Package managers
  if (hasPyproject || hasPipfile || hasPoetryLock) map.packageManagers.push("pip/poetry");
  if (await exists(path.join(root, "pnpm-lock.yaml"))) map.packageManagers.push("pnpm");
  if (await exists(path.join(root, "package-lock.json"))) map.packageManagers.push("npm");
  if (await exists(path.join(root, "yarn.lock"))) map.packageManagers.push("yarn");
  if (await exists(path.join(root, "bun.lockb")) || await exists(path.join(root, "bun.lock"))) map.packageManagers.push("bun");
  if (hasPackageJson && map.packageManagers.length === 0) map.packageManagers.push("unknown-js");

  // Important files
  const candidates: string[] = [];
  if (hasPackageJson) candidates.push("package.json");
  if (hasTsConfig) candidates.push("tsconfig.json");
  if (hasPyproject) candidates.push("pyproject.toml");
  if (hasRequirementsTxt) candidates.push("requirements.txt");
  if (hasDockerfile) candidates.push("Dockerfile");
  if (hasDockerCompose) candidates.push("docker-compose.yml");
  if (hasNextConfig) candidates.push("next.config.*");
  if (hasViteConfig) candidates.push("vite.config.*");
  if (hasPrismaSchema) candidates.push("prisma/schema.prisma");
  if (hasAlembic) candidates.push("alembic.ini");
  if (hasReadme) candidates.push("README.md");
  if (hasLicense) candidates.push("LICENSE");
  if (hasEnvExample) candidates.push(".env.example");
  if (hasGitignore) candidates.push(".gitignore");
  if (hasHunoignore) candidates.push(".hunoignore");

  map.importantFiles = unique(candidates);

  // Directories (top-level only, non-ignored)
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      if (matchesIgnorePattern(entry.name, ignorePatterns)) continue;
      map.directories[entry.name] = `${entry.name}/`;
      if (TEST_DIRECTORIES.has(entry.name)) {
        map.tests.directories.push(`${entry.name}/`);
      }
    }
  } catch {
    // ignore directory listing errors
  }

  for (const filename of [
    "vitest.config.ts",
    "vitest.config.js",
    "jest.config.ts",
    "jest.config.js",
    "playwright.config.ts",
    "playwright.config.js",
    "pytest.ini",
  ]) {
    if (await exists(path.join(root, filename))) {
      map.tests.files.push(filename);
      map.importantFiles.push(filename);
    }
  }

  map.stack.languages = unique(map.stack.languages);
  map.stack.frameworks = unique(map.stack.frameworks);
  map.stack.database = unique(map.stack.database);
  map.stack.infrastructure = unique(map.stack.infrastructure);
  map.packageManagers = unique(map.packageManagers);
  map.tests.directories = unique(map.tests.directories);
  map.tests.files = unique(map.tests.files);
  map.tests.scripts = unique(map.tests.scripts);
  map.tests.frameworks = unique(map.tests.frameworks);
  map.importantFiles = unique(map.importantFiles);

  if (!hasReadme) {
    map.warnings.push({
      id: "missing-readme",
      message: "README.md was not found.",
      suggestion: "Add a README with setup, scripts, and project overview.",
    });
  }
  if (!hasLicense) {
    map.warnings.push({
      id: "missing-license",
      message: "LICENSE was not found.",
      suggestion: "Choose and add a project license when the project is ready to share.",
    });
  }
  if (!hasEnvExample) {
    map.warnings.push({
      id: "missing-env-example",
      message: ".env.example was not found.",
      suggestion: hasEnv
        ? "Create .env.example with secret values left blank."
        : "Add .env.example if this project expects provider keys or environment configuration.",
    });
  }
  if (!hasGitignore) {
    map.warnings.push({
      id: "missing-gitignore",
      message: ".gitignore was not found.",
      suggestion: "Add ignore rules for dependencies, builds, logs, and local secrets.",
    });
  }
  if (!hasHunoignore) {
    map.warnings.push({
      id: "missing-hunoignore",
      message: ".hunoignore was not found.",
      suggestion: "Add .hunoignore to keep generated or sensitive paths out of Huno scans.",
    });
  }
  if (map.tests.directories.length === 0 && map.tests.files.length === 0 && map.tests.scripts.length === 0) {
    map.warnings.push({
      id: "missing-tests",
      message: "No test directory, test config, or test script was detected.",
      suggestion: "Add a small test setup for scanner, memory, and risk logic.",
    });
  }
  if (map.packageManagers.filter((manager) => ["pnpm", "npm", "yarn", "bun"].includes(manager)).length > 1) {
    map.warnings.push({
      id: "multiple-package-managers",
      message: "Multiple JavaScript package manager lockfiles were detected.",
      suggestion: "Keep one lockfile to avoid inconsistent installs.",
    });
  }

  map.generatedAt = new Date().toISOString();
  return { ok: true, data: map };
}

export async function findPackageManager(): Promise<string | null> {
  const root = process.cwd();
  if (await exists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(root, "package-lock.json"))) return "npm";
  if (await exists(path.join(root, "yarn.lock"))) return "yarn";
  if (await exists(path.join(root, "pyproject.toml"))) return "poetry/pip";
  if (await exists(path.join(root, "Pipfile"))) return "pipenv";
  if (await exists(path.join(root, "requirements.txt"))) return "pip";
  return null;
}

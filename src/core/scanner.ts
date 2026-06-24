import fs from "fs/promises";
import path from "path";
import { emptyProjectMap, type ProjectMap } from "../storage/project-map.js";
import { HunoError, Result } from "../utils/errors.js";

const IMPORTANT_DIRS = [
  "src",
  "app",
  "pages",
  "components",
  "lib",
  "hooks",
  "public",
  "backend",
  "frontend",
  "api",
  "routes",
  "controllers",
  "models",
  "schemas",
  "services",
  "utils",
  "lib",
  "docs",
  "tests",
  "__tests__",
  "test",
  "venv",
  ".venv",
  "server",
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
]);

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

export async function scanProject(): Promise<Result<ProjectMap>> {
  const root = process.cwd();
  const map = emptyProjectMap();
  map.root = root;

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
    }
  }

  // Infrastructure
  if (hasDockerfile) map.stack.infrastructure.push("Dockerfile");
  if (hasDockerCompose) map.stack.infrastructure.push("Docker Compose");

  // Package managers
  if (hasPackageJson) map.packageManagers.push("npm/pnpm/yarn");
  if (hasPyproject || hasPipfile || hasPoetryLock) map.packageManagers.push("pip/poetry");
  if (await exists(path.join(root, "pnpm-lock.yaml"))) map.packageManagers.push("pnpm");
  if (await exists(path.join(root, "package-lock.json"))) map.packageManagers.push("npm");
  if (await exists(path.join(root, "yarn.lock"))) map.packageManagers.push("yarn");

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

  map.importantFiles = candidates;

  // Directories (top-level only, non-ignored)
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      map.directories[entry.name] = `${entry.name}/`;
    }
  } catch {
    // ignore directory listing errors
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
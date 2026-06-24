export function getProjectRoot(): string {
  const here = process.cwd();
  // In the future, walk up to find git root or package.json.
  return here;
}

export function getHunoDir(): string {
  return `${getProjectRoot()}/.huno`;
}
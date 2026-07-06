import chalk from "chalk";
import readline from "readline";
import { brand } from "./theme.js";

export type DropdownItem<T> = {
  value: T;
  label: string;
  searchableText?: string;
};

export type DropdownKey = {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
};

type SelectFromDropdownOptions<T> = {
  title: string;
  items: DropdownItem<T>[];
  prompt?: string;
  maxVisibleItems?: number;
  filterable?: boolean;
};

export function filterDropdownItems<T>(
  items: DropdownItem<T>[],
  query: string
): DropdownItem<T>[] {
  const normalized = query.toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const searchable = item.searchableText || item.label;
    return searchable.toLowerCase().includes(normalized);
  });
}

export function renderDropdownRows<T>(
  items: DropdownItem<T>[],
  selectedIndex: number
): string[] {
  return items.map((item, index) => {
    if (index === selectedIndex) {
      return `  \x1b[7m ${item.label} \x1b[0m`;
    }

    return `  ${item.label}`;
  });
}

export async function selectFromDropdown<T>(
  options: SelectFromDropdownOptions<T>
): Promise<T | null> {
  const { title, items, filterable = false } = options;
  const prompt = options.prompt || chalk.hex(brand.secondary)("  > ");

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(chalk.hex(brand.secondary)(title));
    console.log();
    items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.label}`);
    });
    console.log();

    const input = await promptNumber();
    const index = Number.parseInt(input.trim(), 10);
    if (!Number.isNaN(index) && index >= 1 && index <= items.length) {
      return items[index - 1].value;
    }
    return null;
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const previousRawMode = stdin.isTTY ? stdin.isRaw : false;
    const maxVisibleItems = Math.max(
      5,
      Math.min(items.length, options.maxVisibleItems || 12, (stdout.rows || 24) - 4)
    );

    let selectedIndex = 0;
    let query = "";
    let renderedRows = 0;
    let filteredItems = filterable ? filterDropdownItems(items, query) : items;

    const visibleWindow = (): DropdownItem<T>[] => {
      const windowStart = getWindowStart(selectedIndex, filteredItems.length, maxVisibleItems);
      return filteredItems.slice(windowStart, windowStart + maxVisibleItems);
    };

    const render = (): void => {
      if (renderedRows > 0) {
        stdout.write(`\x1b[${renderedRows}A\r\x1b[J`);
      } else {
        stdout.write("\r\x1b[J");
      }

      const windowStart = getWindowStart(selectedIndex, filteredItems.length, maxVisibleItems);
      const visibleItems = visibleWindow();
      const lines: string[] = [];

      if (windowStart > 0) {
        lines.push(chalk.dim(`  ... ${windowStart} more above`));
      }

      lines.push(...renderDropdownRows(visibleItems, selectedIndex - windowStart));

      const remainingBelow = filteredItems.length - (windowStart + visibleItems.length);
      if (remainingBelow > 0) {
        lines.push(chalk.dim(`  ... ${remainingBelow} more below`));
      }

      if (lines.length > 0) {
        stdout.write(lines.join("\n") + "\n");
      }

      stdout.write(prompt + title + (filterable && query ? ` ${chalk.dim(query)}` : ""));
      renderedRows = lines.length;
    };

    const cleanup = (): void => {
      stdin.off("keypress", onKeypress);
      if (stdin.isTTY) {
        stdin.setRawMode(previousRawMode);
      }
      if (renderedRows > 0) {
        stdout.write(`\x1b[${renderedRows}A\r\x1b[J`);
      } else {
        stdout.write("\x1b[2K\r");
      }
      stdout.write("\n");
      stdin.pause();
    };

    const refreshFilter = (): void => {
      filteredItems = filterable ? filterDropdownItems(items, query) : items;
      if (selectedIndex >= filteredItems.length) {
        selectedIndex = Math.max(0, filteredItems.length - 1);
      }
    };

    const onKeypress = (input: string, key: DropdownKey): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(1);
      }

      if (key.name === "escape") {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === "up") {
        if (filteredItems.length > 0) {
          selectedIndex = selectedIndex === 0 ? filteredItems.length - 1 : selectedIndex - 1;
          render();
        }
        return;
      }

      if (key.name === "down") {
        if (filteredItems.length > 0) {
          selectedIndex = selectedIndex === filteredItems.length - 1 ? 0 : selectedIndex + 1;
          render();
        }
        return;
      }

      if (key.name === "return" || key.name === "enter" || key.name === "tab") {
        const selected = filteredItems[selectedIndex]?.value ?? null;
        cleanup();
        resolve(selected);
        return;
      }

      if (!filterable) return;

      if (key.name === "backspace") {
        if (query.length > 0) {
          query = query.slice(0, -1);
          refreshFilter();
          render();
        }
        return;
      }

      if (input && !input.startsWith("\x1b") && !key.ctrl && !key.meta) {
        query += input;
        refreshFilter();
        render();
      }
    };

    readline.emitKeypressEvents(stdin);
    stdin.resume();
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    render();
    stdin.on("keypress", onKeypress);
  });
}

function getWindowStart(index: number, itemCount: number, maxVisibleItems: number): number {
  return Math.max(
    0,
    Math.min(index - Math.floor(maxVisibleItems / 2), itemCount - maxVisibleItems)
  );
}

function promptNumber(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Number: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

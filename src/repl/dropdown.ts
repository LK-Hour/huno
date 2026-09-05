import chalk from "chalk";
import type { Interface } from "readline";
import {
  filterDropdownItems,
  renderDropdownRows as renderTerminalDropdownRows,
  type DropdownItem,
} from "../ui/terminal-select.js";
import { brand, neutral, progress } from "../ui/theme.js";

export type SlashCommandMeta = { name: string; description: string };

/**
 * The handful of readline-lifecycle operations the dropdown needs to perform
 * on the host REPL loop (closing for raw mode, recreating readline
 * afterwards). Keeping this as a narrow interface lets the dropdown own all
 * of its rendering/keypress state without repl.ts's loop internals leaking
 * in here, or this module reaching back into repl.ts's mutable locals.
 */
export interface DropdownHost {
  getRl(): Interface;
  /** Pauses+closes the active readline so raw-mode input can take over. */
  closeForRawMode(): void;
  /** Recreates readline (prompt/history/close+line handlers) after raw mode ends. */
  recreateRl(): Interface;
}

/**
 * Creates the slash-command autocomplete dropdown: typing "/" at an empty
 * prompt opens a filterable, arrow-key-navigable list of commands rendered
 * above the input line using raw terminal escape codes.
 */
export function createSlashDropdown(commands: SlashCommandMeta[], host: DropdownHost) {
  let active = false;
  let selected = 0;
  let filtered = commands.map((_, i) => i);
  let query = "";
  let renderedRows = 0; // how many dropdown rows were last drawn

  function getItems(): DropdownItem<number>[] {
    return commands.map((cmd, index) => ({
      value: index,
      label: `${cmd.name} ${cmd.description}`,
      searchableText: `${cmd.name} ${cmd.description}`,
    }));
  }

  function reset() {
    active = false;
    selected = 0;
    filtered = commands.map((_, i) => i);
    query = "";
    renderedRows = 0;
  }

  function renderRows(): string[] {
    const items: DropdownItem<number>[] = filtered.map((cmdIdx) => {
      const cmd = commands[cmdIdx];
      const namePadded = cmd.name.padEnd(16);
      return {
        value: cmdIdx,
        label: `${chalk.hex(progress.active)(namePadded)}${chalk.hex(neutral.muted)(cmd.description)}`,
        searchableText: `${cmd.name} ${cmd.description}`,
      };
    });
    return renderTerminalDropdownRows(items, selected);
  }

  function refilter() {
    filtered = filterDropdownItems(getItems(), query).map((item) => item.value);
    if (selected >= filtered.length) {
      selected = Math.max(0, filtered.length - 1);
    }
  }

  function redraw() {
    const promptPrefix = chalk.hex(brand.secondary)("  > ");
    if (renderedRows > 0) {
      process.stdout.write(`\x1b[${renderedRows}A\r\x1b[J`);
    } else {
      process.stdout.write("\r\x1b[J");
    }

    if (filtered.length === 0) {
      process.stdout.write(promptPrefix + "/" + query);
      renderedRows = 0;
      return;
    }
    const rows = renderRows();
    process.stdout.write(rows.join("\n") + "\n");
    process.stdout.write(promptPrefix + "/" + query);
    renderedRows = filtered.length;
  }

  function teardown(result: string) {
    process.stdin.removeListener("keypress", handleKeypress);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);

    const rowsToClear = renderedRows;
    if (rowsToClear > 0) {
      process.stdout.write(`\x1b[${rowsToClear}A\r\x1b[J`);
    } else {
      process.stdout.write("\x1b[2K\r");
    }

    reset();

    const rl = host.recreateRl();
    process.stdin.on("keypress", slashDetector);

    rl.prompt();
    if (result) {
      rl.write(result);
    }
  }

  function handleKeypress(_char: string, key: any) {
    if (!active) return;

    if (key && key.ctrl && key.name === "c") {
      teardown("");
      return;
    }
    if (key && key.name === "escape") {
      teardown("");
      return;
    }
    if (key && (key.name === "return" || key.name === "enter")) {
      const selectedName = filtered.length > 0 ? commands[filtered[selected]].name + " " : "/" + query;
      teardown(selectedName);
      return;
    }
    if (key && key.name === "up") {
      if (selected > 0) {
        selected--;
        redraw();
      }
      return;
    }
    if (key && key.name === "down") {
      if (selected < filtered.length - 1) {
        selected++;
        redraw();
      }
      return;
    }
    if (key && key.name === "backspace") {
      if (query.length > 0) {
        query = query.slice(0, -1);
        refilter();
        redraw();
      } else {
        teardown("");
      }
      return;
    }
    if (key && key.name === "tab") {
      const selectedName = filtered.length > 0 ? commands[filtered[selected]].name + " " : "/" + query;
      teardown(selectedName);
      return;
    }
    if (_char && !_char.startsWith("\x1b") && key && !key.ctrl && !key.meta) {
      query += _char;
      refilter();
      redraw();
    }
  }

  function show(initialQuery: string) {
    query = initialQuery;
    filtered = filterDropdownItems(getItems(), initialQuery).map((item) => item.value);
    selected = 0;
    active = true;

    process.stdin.removeListener("keypress", slashDetector);
    host.closeForRawMode();

    // Let readline fully release stdin before entering raw mode.
    setImmediate(() => {
      process.stdout.write("\x1b[2K\r");

      const promptPrefix = chalk.hex(brand.secondary)("  > ");
      const rows = renderRows();
      if (rows.length > 0) {
        process.stdout.write(rows.join("\n") + "\n");
      }
      renderedRows = rows.length;
      process.stdout.write(promptPrefix + "/" + query);

      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.resume();

      process.stdin.on("keypress", handleKeypress);
    });
  }

  function slashDetector(_char: string, _key: any) {
    if (active) return;
    if (_char !== "/") return;
    const currentLine = ((host.getRl() as any).line || "") as string;
    if (currentLine === "" || currentLine === "/") {
      show("");
    }
  }

  return {
    isActive: () => active,
    attachDetector: () => process.stdin.on("keypress", slashDetector),
  };
}

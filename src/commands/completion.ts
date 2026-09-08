import { Command } from "commander";

const SHELLS = ["bash", "zsh", "fish"] as const;
type Shell = (typeof SHELLS)[number];

function bashScript(commands: string[]): string {
  return `_huno_completions() {
  local cur
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "${commands.join(" ")}" -- "$cur") )
}
complete -F _huno_completions huno
`;
}

function zshScript(commands: string[]): string {
  return `#compdef huno
_huno() {
  local -a commands
  commands=(${commands.join(" ")})
  _describe 'command' commands
}
compdef _huno huno
`;
}

function fishScript(commands: string[]): string {
  return `complete -c huno -f -a "${commands.join(" ")}"
`;
}

/**
 * Built after all other commands are registered on `program`, but the
 * subcommand list is read lazily inside the action handler (at parse time,
 * not construction time) — so it stays accurate regardless of where this
 * command sits in the addCommand() sequence in index.ts.
 */
export function createCompletionCommand(program: Command): Command {
  return new Command("completion")
    .description(
      `Print a shell completion script (${SHELLS.join(
        ", "
      )}). Example: eval "$(huno completion zsh)"`
    )
    .argument("<shell>", `Shell to generate completion for (${SHELLS.join(", ")})`)
    .action((shell: string) => {
      if (!SHELLS.includes(shell as Shell)) {
        console.error(`Unsupported shell: ${shell}. Supported: ${SHELLS.join(", ")}`);
        process.exitCode = 1;
        return;
      }
      const commands = program.commands.map((c) => c.name());
      const script =
        shell === "bash" ? bashScript(commands) : shell === "zsh" ? zshScript(commands) : fishScript(commands);
      process.stdout.write(script);
    });
}

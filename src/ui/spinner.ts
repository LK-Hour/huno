/**
 * Terminal spinner for REPL loading states.
 * Uses raw process.stdout.write — no Ink dependency.
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  update: (message: string) => void;
  stop: () => void;
}

/**
 * Start a spinner on the current line.
 * Returns handles to update the message or stop the spinner.
 *
 * Usage:
 *   const spin = startSpinner("Thinking");
 *   // ... later ...
 *   spin.stop();  // clears the line
 */
export function startSpinner(initialMessage: string, color: string = "\x1b[36m"): Spinner {
  let message = initialMessage;
  let frameIdx = 0;
  let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
    frameIdx = (frameIdx + 1) % FRAMES.length;
    render();
  }, 80);

  // Render first frame immediately
  render();

  function render(): void {
    const frame = FRAMES[frameIdx];
    // Move to start of line, clear, write spinner
    process.stdout.write(`\r\x1b[2K  ${color}${frame}\x1b[0m ${message}`);
  }

  return {
    update(newMessage: string) {
      message = newMessage;
      render();
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      // Clear the spinner line
      process.stdout.write("\r\x1b[2K");
    },
  };
}

/**
 * Write a completed status line (replaces spinner).
 * Uses ✓ for success, ✗ for error.
 */
export function writeStatus(icon: string, message: string, color: string = "\x1b[32m"): void {
  process.stdout.write(`\r\x1b[2K  ${color}${icon}\x1b[0m ${message}\n`);
}

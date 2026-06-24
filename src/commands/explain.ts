import { Command } from "commander";
import React from "react";
import { Box, Text } from "ink";
import { scanProject } from "../core/scanner.js";
import { writeHunoFile } from "../storage/huno-dir.js";
import { serializeProjectMap } from "../storage/project-map.js";
import { renderUI } from "../ui/renderer.js";
import { Header, ProjectCard, ProgressSteps, ContextFiles } from "../ui/components/index.js";

export const explainCommand = new Command("explain")
  .description("Scan the repository and explain the project.")
  .option("--short", "Show short summary only")
  .option("--json", "Output as JSON")
  .action(async (options: { short?: boolean; json?: boolean }) => {
    // Step 1: Show header
    renderUI(
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Header, { tagline: "Project Intelligence" })
      )
    );

    // Step 2: Scan
    const scanResult = await scanProject();
    if (!scanResult.ok) {
      renderUI(
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(Header, { tagline: "Project Intelligence" }),
          React.createElement(
            Box,
            { borderStyle: "round", paddingX: 2, marginTop: 1 },
            React.createElement(Text, { color: "red" }, "Scan failed. Run `huno init` first.")
          )
        )
      );
      setTimeout(() => process.exit(1), 100);
      return;
    }

    const map = scanResult.data;

    // Save project map
    const saveResult = await writeHunoFile("project-map.json", serializeProjectMap(map));

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(map, null, 2));
      return;
    }

    // Build stack summary
    const stackParts: string[] = [];
    if (map.stack.languages.length) stackParts.push(map.stack.languages.join(", "));
    if (map.stack.frameworks.length) stackParts.push(map.stack.frameworks.join(", "));
    if (map.stack.database.length) stackParts.push(map.stack.database.join(", "));
    const stack = stackParts.join(" · ") || "unknown";

    // Count files scanned
    const fileCount = Object.keys(map.directories).length + map.importantFiles.length;

    // Render rich output
    renderUI(
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Header, { tagline: "Project Intelligence" }),
        React.createElement(ProgressSteps, {
          steps: [
            { label: "Scanning files" },
            { label: "Detecting stack" },
            { label: "Building project map" },
            { label: "Generating summary" },
          ],
          current: 3,
        }),
        React.createElement(ProjectCard, {
          name: map.projectName,
          stack,
          filesCount: fileCount,
          status: "active",
        }),
        map.importantFiles.length > 0
          ? React.createElement(ContextFiles, { files: map.importantFiles, title: "Important Files" })
          : null,
        Object.keys(map.directories).length > 0
          ? React.createElement(ContextFiles, {
              files: Object.keys(map.directories).slice(0, 10),
              title: "Directories",
            })
          : null,
        Object.keys(map.scripts).length > 0
          ? React.createElement(ContextFiles, {
              files: Object.entries(map.scripts).slice(0, 5).map(([n, c]) => `${n}: ${c}`),
              title: "Scripts",
            })
          : null
      )
    );

    // Exit cleanly after Ink render
    setTimeout(() => process.exit(0), 100);
  });

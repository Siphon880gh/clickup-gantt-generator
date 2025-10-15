#!/usr/bin/env node
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import Papa from "papaparse";

// ---- Helpers ----
const INPUT_DIR = path.resolve("inputs");
const OUTPUT_DIR = path.resolve("outputs");

function ensureDirs() {
  if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function listInputFiles() {
  if (!fs.existsSync(INPUT_DIR)) return [];
  const allowed = [".txt", ".json"];
  return fs
    .readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && allowed.includes(path.extname(d.name).toLowerCase()))
    .map((d) => d.name);
}

function parseTasksFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, "utf8");
  if (ext === ".json") {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("JSON must be an array of strings.");
    return arr.map(String).map((s) => s.trim()).filter(Boolean);
  }
  // .txt – newline separated
  return raw
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function parseISODateLoose(input) {
  // Accept YYYY-MM-DD or natural-ish like 2025/10/15
  const norm = input.replace(/\//g, "-").trim();
  const dt = new Date(norm);
  if (isNaN(dt.getTime())) throw new Error(`Invalid date: ${input}`);
  return dt;
}

// Map weekday letters to JS Date.getDay() (0=Sun..6=Sat)
// M=1, T=2, W=3, H=4 (Thu), F=5, S=6, U=0 (Sun)
const LETTER_TO_DAY = { U: 0, M: 1, T: 2, W: 3, H: 4, F: 5, S: 6 };

// Given start date (week 0), find all dates within N weeks that match selected weekdays
function generateDatesByPattern(startDate, weeks, selectedLetters) {
  const wantedDays = selectedLetters.map((L) => LETTER_TO_DAY[L]).sort((a, b) => a - b);
  const results = [];
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); // strip time

  // Iterate days across the span (weeks * 7), include matches on/after start
  const totalDays = Math.max(1, weeks) * 7;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    if (wantedDays.includes(d.getDay())) results.push(d);
  }
  return results;
}

// Generate dates based on occurrence pattern (days in a row, days between)
function generateDatesByOccurrencePattern(startDate, occurrences, daysInRow, daysBetween) {
  const results = [];
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  
  let currentDay = 0;
  for (let i = 0; i < occurrences; i++) {
    // Add consecutive days for this occurrence
    for (let j = 0; j < daysInRow; j++) {
      results.push(addDays(start, currentDay + j));
    }
    // Move to next occurrence (skip the gap days)
    currentDay += daysInRow + daysBetween;
  }
  
  return results;
}

// ---- Main ----
async function main() {
  ensureDirs();

  const files = listInputFiles();
  if (files.length === 0) {
    console.log(`No input files found in ${INPUT_DIR}/
- Add a .txt (newline per task) or .json (array of strings) and run again.`);
    process.exit(1);
  }

  // Step 1: Choose input file
  const { fileName } = await inquirer.prompt([
    {
      type: "list",
      name: "fileName",
      message: "Choose a task list from inputs/:",
      choices: files
    }
  ]);

  const tasks = parseTasksFromFile(path.join(INPUT_DIR, fileName));
  if (!tasks.length) {
    console.log("The selected file has no tasks.");
    process.exit(1);
  }

  // Step 2: Select tasks to cycle weekly
  const { weeklyTasks } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "weeklyTasks",
      message: "WEEKLY PATTERN: Select tasks to cycle weekly (use SPACE to select, ENTER to confirm):",
      choices: tasks.map(task => ({ name: task, value: task }))
    }
  ]);

  // Remaining tasks
  const remainingTasks = tasks.filter(t => !weeklyTasks.includes(t));

  // Step 3: Select tasks to cycle with rolling pattern
  let rollingTasks = [];
  if (remainingTasks.length > 0) {
    const result = await inquirer.prompt([
      {
        type: "checkbox",
        name: "rollingTasks",
        message: "ROLLING PATTERN: Select tasks to cycle with rolling pattern (use SPACE to select, ENTER to confirm):",
        choices: remainingTasks.map(task => ({ name: task, value: task }))
      }
    ]);
    rollingTasks = result.rollingTasks;
  }

  // Tasks with no cycling
  const noCycleTasks = tasks.filter(t => !weeklyTasks.includes(t) && !rollingTasks.includes(t));

  // Step 4: Configure each weekly task
  const weeklyTaskConfigs = [];
  for (const task of weeklyTasks) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📅 WEEKLY TASK: "${task}"`);
    console.log(`${"=".repeat(60)}`);
    const { days, start, weeksCount } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "days",
        message: `[${task}] Pick weekdays to repeat (H=Thu, U=Sun):`,
        choices: [
          { name: "M (Mon)", value: "M" },
          { name: "T (Tue)", value: "T" },
          { name: "W (Wed)", value: "W" },
          { name: "H (Thu)", value: "H" },
          { name: "F (Fri)", value: "F" },
          { name: "S (Sat)", value: "S" },
          { name: "U (Sun)", value: "U" }
        ],
        validate: (arr) => (arr.length ? true : "Select at least one day")
      },
      {
        type: "input",
        name: "start",
        message: `[${task}] Start date (YYYY-MM-DD):`,
        default: ymd(new Date()),
        validate: (v) => {
          try {
            parseISODateLoose(v);
            return true;
          } catch (e) {
            return String(e.message || e);
          }
        }
      },
      {
        type: "number",
        name: "weeksCount",
        message: `[${task}] Number of weeks to generate:`,
        default: 4,
        validate: (n) => (Number.isFinite(n) && n > 0 ? true : "Enter a positive number")
      }
    ]);
    
    weeklyTaskConfigs.push({
      task,
      type: "weekly",
      days,
      startDate: parseISODateLoose(start),
      weeks: weeksCount
    });
  }

  // Step 5: Configure each rolling task
  const rollingConfigs = [];
  for (const task of rollingTasks) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔄 ROLLING TASK: "${task}"`);
    console.log(`${"=".repeat(60)}`);
    const { start, occurrences, daysInRow, daysBetween } = await inquirer.prompt([
      {
        type: "input",
        name: "start",
        message: `[${task}] Start date (YYYY-MM-DD):`,
        default: ymd(new Date()),
        validate: (v) => {
          try {
            parseISODateLoose(v);
            return true;
          } catch (e) {
            return String(e.message || e);
          }
        }
      },
      {
        type: "number",
        name: "occurrences",
        message: `[${task}] How many occurrences to generate?`,
        default: 4,
        validate: (n) => (Number.isFinite(n) && n > 0 ? true : "Enter a positive number")
      },
      {
        type: "number",
        name: "daysInRow",
        message: `[${task}] How many days in a row for each occurrence?`,
        default: 1,
        validate: (n) => (Number.isFinite(n) && n > 0 ? true : "Enter a positive number")
      },
      {
        type: "number",
        name: "daysBetween",
        message: `[${task}] How many days between each occurrence?`,
        default: 7,
        validate: (n) => (Number.isFinite(n) && n >= 0 ? true : "Enter a non-negative number")
      }
    ]);
    
    rollingConfigs.push({
      task,
      type: "rolling",
      startDate: parseISODateLoose(start),
      occurrences,
      daysInRow,
      daysBetween
    });
  }

  // Step 6: Configure each one-time task
  const oneTimeTaskConfigs = [];
  for (const task of noCycleTasks) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📝 ONE-TIME TASK: "${task}"`);
    console.log(`${"=".repeat(60)}`);
    const { start, end } = await inquirer.prompt([
      {
        type: "input",
        name: "start",
        message: `[${task}] Start date (YYYY-MM-DD):`,
        default: ymd(new Date()),
        validate: (v) => {
          try {
            parseISODateLoose(v);
            return true;
          } catch (e) {
            return String(e.message || e);
          }
        }
      },
      {
        type: "input",
        name: "end",
        message: `[${task}] Due date (YYYY-MM-DD):`,
        default: ymd(new Date()),
        validate: (v) => {
          try {
            parseISODateLoose(v);
            return true;
          } catch (e) {
            return String(e.message || e);
          }
        }
      }
    ]);
    
    oneTimeTaskConfigs.push({
      task,
      startDate: parseISODateLoose(start),
      endDate: parseISODateLoose(end)
    });
  }

  // Step 7: CSV metadata options
  const { listName } = await inquirer.prompt([
    {
      type: "input",
      name: "listName",
      message:
        "Optional: A List name label column (you can map it to a custom field in ClickUp). Leave blank to skip:",
      default: ""
    }
  ]);

  // Step 8: Build rows
  const rows = [];

  // Process weekly tasks
  for (const config of weeklyTaskConfigs) {
    const dates = generateDatesByPattern(config.startDate, config.weeks, config.days);
    for (const d of dates) {
      const row = { "Task name": config.task };
      row["Start date"] = ymd(d);
      row["Due date"] = ymd(d);
      if (listName) row["List"] = listName;
      rows.push(row);
    }
  }

  // Process rolling tasks
  for (const config of rollingConfigs) {
    const dates = generateDatesByOccurrencePattern(
      config.startDate, 
      config.occurrences, 
      config.daysInRow, 
      config.daysBetween
    );
    for (const d of dates) {
      const row = { "Task name": config.task };
      row["Start date"] = ymd(d);
      row["Due date"] = ymd(d);
      if (listName) row["List"] = listName;
      rows.push(row);
    }
  }

  // Process one-time tasks
  for (const config of oneTimeTaskConfigs) {
    const row = { "Task name": config.task };
    row["Start date"] = ymd(config.startDate);
    row["Due date"] = ymd(config.endDate);
    if (listName) row["List"] = listName;
    rows.push(row);
  }

  // Step 9: Write CSV
  const csv = Papa.unparse(rows, { header: true });
  const stamp = new Date();
  const outName = `clickup_import_${stamp.getFullYear()}${String(
    stamp.getMonth() + 1
  ).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}_${String(
    stamp.getHours()
  ).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}.csv`;

  const outPath = path.join(OUTPUT_DIR, outName);
  fs.writeFileSync(outPath, csv, "utf8");

  console.log(`\n✅ CSV written to: ${outPath}`);
  console.log(`   📊 Total rows: ${rows.length}`);
  console.log(`   📅 Weekly tasks: ${weeklyTaskConfigs.length}`);
  console.log(`   🔄 Rolling tasks: ${rollingConfigs.length}`);
  console.log(`   📝 One-time tasks: ${oneTimeTaskConfigs.length}`);
  console.log(
    `\nImport in ClickUp: Settings → Import/Export → Import → Spreadsheet → map "Task name", "Start date", "Due date"${listName ? ', and "List"' : ""}.`
  );
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});


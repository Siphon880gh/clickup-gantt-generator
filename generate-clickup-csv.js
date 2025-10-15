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

// ---- Main ----
async function main() {
  ensureDirs();

  const files = listInputFiles();
  if (files.length === 0) {
    console.log(`No input files found in ${INPUT_DIR}/
- Add a .txt (newline per task) or .json (array of strings) and run again.`);
    process.exit(1);
  }

  const answers1 = await inquirer.prompt([
    {
      type: "list",
      name: "fileName",
      message: "Choose a task list from inputs/:",
      choices: files
    },
    {
      type: "confirm",
      name: "cycleEach",
      message: "Do you want to cycle each task on specific weekdays (M,T,W,H,F,S,U)?",
      default: true
    }
  ]);

  const tasks = parseTasksFromFile(path.join(INPUT_DIR, answers1.fileName));
  if (!tasks.length) {
    console.log("The selected file has no tasks.");
    process.exit(1);
  }

  let weekdayLetters = [];
  let startDate = new Date();
  let weeks = 4;

  if (answers1.cycleEach) {
    const { days, start, weeksCount } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "days",
        message:
          "Pick weekdays to repeat (H=Thu, U=Sun). Use SPACE to select, ENTER to confirm:",
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
        message: "Start date (YYYY-MM-DD):",
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
        message: "Number of weeks to generate:",
        default: 4,
        validate: (n) => (Number.isFinite(n) && n > 0 ? true : "Enter a positive number")
      }
    ]);
    weekdayLetters = days;
    startDate = parseISODateLoose(start);
    weeks = weeksCount;
  }

  // Optional metadata for CSV (helps mapping in ClickUp)
  const { includeStartDates, dueEqualsStart, listName } = await inquirer.prompt([
    {
      type: "confirm",
      name: "includeStartDates",
      message: "Include a Start date column?",
      default: true
    },
    {
      type: "confirm",
      name: "dueEqualsStart",
      message: "Set Due date equal to Start date?",
      default: true
    },
    {
      type: "input",
      name: "listName",
      message:
        "Optional: A List name label column (you can map it to a custom field in ClickUp). Leave blank to skip:",
      default: ""
    }
  ]);

  // Build rows
  // Minimal ClickUp-friendly columns: "Task name", "Start date", "Due date"
  const rows = [];
  if (answers1.cycleEach) {
    const dates = generateDatesByPattern(startDate, weeks, weekdayLetters);
    for (const task of tasks) {
      for (const d of dates) {
        const row = {
          "Task name": task
        };
        if (includeStartDates) row["Start date"] = ymd(d);
        row["Due date"] = dueEqualsStart ? ymd(d) : ""; // leave blank if not tying due to start
        if (listName) row["List"] = listName;
        rows.push(row);
      }
    }
  } else {
    // No cycling: emit tasks without dates (you can map dates in ClickUp or bulk-edit later)
    for (const task of tasks) {
      const row = {
        "Task name": task
      };
      if (includeStartDates) row["Start date"] = "";
      row["Due date"] = "";
      if (listName) row["List"] = listName;
      rows.push(row);
    }
  }

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
  console.log(
    `\nImport in ClickUp: Settings → Import/Export → Import → Spreadsheet → map "Task name", "Start date", "Due date"${listName ? ', and "List"' : ""}.`
  );
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});


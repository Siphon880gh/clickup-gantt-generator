# Context: ClickUp CSV Generator

> **Note:** Line references in this document are approximate. Use descriptive location cues (e.g., "near the top," "middle section") rather than exact line numbers to avoid frequent maintenance overhead.

## High-Level Description

A Node.js CLI tool that generates ClickUp-importable CSV files from task lists. Users can configure three types of scheduling patterns for their tasks:
- **Weekly Cycling**: Tasks repeat on specific weekdays (M, T, W, H=Thu, F, S, U=Sun)
- **Rolling Cycling**: Tasks repeat with multi-day blocks and configurable gaps
- **One-Time Scheduled**: Individual tasks with custom start/due dates

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **CLI Framework**: Inquirer.js v9.3.7 (interactive prompts)
- **CSV Generation**: PapaParse v5.4.1
- **File I/O**: Node.js built-in `fs` and `path` modules

## Project Structure

```
gantt/
├── inputs/              # Task list files
│   ├── tasks.txt       # Newline-separated task names
│   └── tasks.json      # JSON array of task strings
├── outputs/            # Generated CSV files
│   └── clickup_import_*.csv
├── generate-clickup-csv.js  (401 lines)  # Main CLI application
├── package.json        (14 lines)        # Dependencies and scripts
├── README.md           (150 lines)       # User documentation
└── context.md          # This file
```

## Architecture Overview

### Execution Flow

1. **File Selection** (lines ~100-110)
   - Lists `.txt` or `.json` files from `inputs/`
   - User selects one file via Inquirer

2. **Pattern Selection** (lines ~120-170)
   - **Step 1**: Select tasks for weekly cycling (checkbox prompt)
   - **Step 2**: Select tasks for rolling cycling from remaining tasks
   - **Step 3**: Display one-time scheduled tasks (automatically remaining)

3. **Configuration Phase** (lines ~170-320)
   - **Weekly tasks**: For each task, configure weekdays, start date, and number of weeks
   - **Rolling tasks**: For each task, configure occurrences, days in a row, days between
   - **One-time tasks**: For each task, configure start date and due date

4. **CSV Generation** (lines ~330-375)
   - Build rows from all configured tasks
   - Generate dates using helper functions
   - Export CSV with columns: Task name, Start date, Due date, List (optional)

5. **File Output** (lines ~375-395)
   - Write CSV to `outputs/clickup_import_YYYYMMDD_HHMM.csv`
   - Display summary statistics

### Key Functions

#### Helper Functions (near top of file)

```javascript
// Directory management (lines ~11-14)
function ensureDirs()
// Creates inputs/ and outputs/ directories if missing

// File listing (lines ~16-23)
function listInputFiles()
// Returns array of .txt and .json files from inputs/

// Task parsing (lines ~25-38)
function parseTasksFromFile(filePath)
// Parses .txt (newline-separated) or .json (array) into task list

// Date utilities (lines ~40-59)
function ymd(date)           // Format date as YYYY-MM-DD
function addDays(d, n)       // Add N days to a date
function parseISODateLoose(input)  // Parse YYYY-MM-DD or YYYY/MM/DD
```

#### Date Generation Functions (middle section)

```javascript
// Weekly pattern (lines ~66-78)
function generateDatesByPattern(startDate, weeks, selectedLetters)
// Maps weekday letters (M,T,W,H,F,S,U) to dates across N weeks
// Example: M,W,F for 4 weeks → 12 dates

// Rolling pattern (lines ~81-96)
function generateDatesByOccurrencePattern(startDate, occurrences, daysInRow, daysBetween)
// Generates dates with multi-day blocks and gaps
// Example: 3 days in a row, 7 days between, 4 occurrences → 12 dates
```

#### Main Function (starting ~line 98)

The `main()` async function orchestrates the entire CLI flow using Inquirer prompts.

## Data Flow

### Input Files

**tasks.txt** (newline-separated):
```
Write weekly status update
Plan sprint
Publish blog post
```

**tasks.json** (array):
```json
["Write weekly status update", "Plan sprint", "Publish blog post"]
```

### Configuration Objects

```javascript
// Weekly task config
{
  task: "Write weekly status update",
  type: "weekly",
  days: ["M", "W", "F"],
  startDate: Date,
  weeks: 4
}

// Rolling task config
{
  task: "Plan sprint",
  type: "rolling",
  startDate: Date,
  occurrences: 6,
  daysInRow: 3,
  daysBetween: 11
}

// One-time task config
{
  task: "Publish blog post",
  startDate: Date,
  endDate: Date
}
```

### Output CSV

```csv
Task name,Start date,Due date,List
Write weekly status update,2025-10-14,2025-10-14,
Write weekly status update,2025-10-16,2025-10-16,
Plan sprint,2025-10-20,2025-10-20,
...
```

## Key Constants

```javascript
// Weekday mapping (line ~63)
const LETTER_TO_DAY = { 
  U: 0,  // Sunday
  M: 1,  // Monday
  T: 2,  // Tuesday
  W: 3,  // Wednesday
  H: 4,  // Thursday
  F: 5,  // Friday
  S: 6   // Saturday
}

// Directory paths (lines ~8-9)
const INPUT_DIR = path.resolve("inputs");
const OUTPUT_DIR = path.resolve("outputs");
```

## Inquirer Prompt Patterns

### Checkbox Prompts
Used for selecting multiple tasks or weekdays:
```javascript
{
  type: "checkbox",
  name: "weeklyTasks",
  message: "WEEKLY PATTERN: Select tasks...",
  choices: tasks.map(task => ({ name: task, value: task }))
}
```

### List Prompts
Used for displaying info with disabled items:
```javascript
{
  type: "list",
  name: "confirm",
  message: "ONE-TIME SCHEDULED PATTERN: Remaining 2 task(s)...",
  choices: tasks.map(t => ({ name: t, disabled: true }))
    .concat([{ name: "── Continue ──", value: "continue" }])
}
```

### Input/Number Prompts
Used for dates and numeric values with validation:
```javascript
{
  type: "input",
  name: "start",
  message: "Start date (YYYY-MM-DD):",
  default: ymd(new Date()),
  validate: (v) => { /* validation logic */ }
}
```

## Error Handling

- File validation: Checks for empty task lists (line ~115)
- Date validation: Custom validator for date inputs (throughout config sections)
- No-file scenario: Exits with helpful message if no input files found (lines ~102-107)

## Output Format

CSV files are named with timestamps: `clickup_import_YYYYMMDD_HHMM.csv`

Console output includes:
```
✅ CSV written to: outputs/clickup_import_20251015_0420.csv
   📊 Total rows: 31
   📅 Weekly tasks: 1
   🔄 Rolling tasks: 1
   📝 One-time tasks: 1
```

## ClickUp Import Instructions

The generated CSV can be imported via:
**Settings → Import/Export → Import → Spreadsheet**

Map columns:
- "Task name" → Task Name
- "Start date" → Start Date
- "Due date" → Due Date
- "List" (optional) → Custom field or List

## Extending the Project

### Adding New Task Patterns
1. Add selection step in main flow (after line ~150)
2. Create configuration loop (similar to weekly/rolling sections)
3. Implement date generation function
4. Add processing logic in "Build rows" section (around line ~335)

### Adding CSV Columns
1. Update row building sections (lines ~335-372)
2. Add new prompt in metadata section (around line ~322)
3. Update console output message (line ~390)

### Supporting New Input Formats
1. Update `listInputFiles()` to recognize file extensions
2. Add parsing logic in `parseTasksFromFile()`
3. Update documentation in README

## Common Use Cases

1. **Weekly recurring tasks**: Team standups, status updates
2. **Sprint cycles**: 2-week sprints with planning days
3. **Work blocks**: 5 days work, 2 days off pattern
4. **Monthly meetings**: Single-day events every 30 days
5. **Mixed schedules**: Combination of all patterns for different tasks

## Dependencies

- `inquirer@^9.3.7`: Full-featured CLI prompts with checkbox, list, input types
- `papaparse@^5.4.1`: Robust CSV generation with header support

Both are actively maintained and stable.


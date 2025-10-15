# ClickUp CSV Generator

A Node.js CLI tool using **Inquirer** that generates ClickUp-importable CSV files from task lists with flexible date scheduling.

## Features

- 📁 Lists files in `inputs/` and lets you pick one (supports `.txt` or `.json`)
- ✅ Select which tasks to cycle weekly vs rolling patterns
- 📅 Per-task weekday selection(s) for weekly cycling (M, T, W, H, F, S, U)
- 🔄 Rolling cycling (multi-day blocks with configurable gaps between occurrences)
- 🗓️ Per-task start dates and duration configuration
- 📊 Writes a ClickUp-importable CSV to `outputs/`

## Installation

```bash
npm install
```

## Usage

```bash
node generate-clickup-csv.js
# or
npm start
```

The CLI will guide you through:

1. **Select an input file** from `inputs/`
2. **Select tasks for weekly cycling** - Choose which tasks should repeat on specific weekdays
3. **Select tasks for rolling cycling** - Choose which remaining tasks should repeat with rolling patterns
4. **Configure each weekly task individually**:
   - Select weekdays to repeat:
     - **M** = Monday
     - **T** = Tuesday
     - **W** = Wednesday
     - **H** = Thursday
     - **F** = Friday
     - **S** = Saturday
     - **U** = Sunday
   - Set start date (YYYY-MM-DD format)
   - Number of weeks to generate
5. **Configure each rolling task individually**:
   - Set start date (YYYY-MM-DD format)
   - Number of occurrences to generate
   - How many days in a row for each occurrence
   - How many days between each occurrence
6. **Configure each one-time task individually**:
   - Set start date (YYYY-MM-DD format, defaults to today)
   - Set due date (YYYY-MM-DD format, defaults to today)
7. **Configure CSV options**:
   - Optional List name for ClickUp mapping

## Example Workflow

Let's say you have these tasks:
- "Write weekly status update"
- "Plan sprint"  
- "Publish blog post"

**Workflow:**
1. Select "Write weekly status update" for **weekly cycling**
2. Select "Plan sprint" for **rolling cycling**
3. Leave "Publish blog post" as a **one-time task**
4. Configure "Write weekly status update":
   - Days: M, W, F (3x per week)
   - Start: 2025-10-20
   - Duration: 4 weeks → generates 12 occurrences
5. Configure "Plan sprint":
   - Start: 2025-10-20
   - Occurrences: 6
   - Days in a row: 3 (sprint lasts 3 days each time)
   - Days between: 11 (11 days gap between sprints) → generates 18 dates total (6 occurrences × 3 days)
6. Configure "Publish blog post":
   - Start date: 2025-11-01
   - Due date: 2025-11-01 → generates 1 task

**Result:** CSV with 31 rows (12 + 18 + 1) ready to import into ClickUp!

### Rolling Pattern Flexibility Examples

Rolling cycling lets you create any pattern:

- **Single-day events, weekly:** 1 day in a row, 7 days between → Mon, next Mon, next Mon...
- **3-day sprints, bi-weekly:** 3 days in a row, 11 days between → Mon-Wed, (skip 11 days), Mon-Wed...
- **Work weeks with gaps:** 5 days in a row, 2 days between → Mon-Fri, Mon-Fri, Mon-Fri...
- **Monthly meetings:** 1 day in a row, 30 days between
- **Intensive training blocks:** 10 days in a row, 20 days between

This is perfect for tasks that need multi-day blocks or consistent gaps!

## Input File Formats

### `inputs/tasks.txt`
Newline-separated task names:

```
Write weekly status update
Plan sprint
Publish blog post
```

### `inputs/tasks.json`
JSON array of strings:

```json
["Write weekly status update", "Plan sprint", "Publish blog post"]
```

## Output

CSV files are written to `outputs/` with timestamp-based names:
- Format: `clickup_import_YYYYMMDD_HHMM.csv`
- Columns: Task name, Start date, Due date, List (optional)

## Importing to ClickUp

1. In ClickUp, go to: **Settings → Import/Export → Import → Spreadsheet**
2. Upload the generated CSV file
3. Map the columns:
   - **Task name** → Task Name
   - **Start date** → Start Date
   - **Due date** → Due Date
   - **List** → Custom field or List (if included)

## Project Structure

```
your-project/
  inputs/           # Place your task files here (.txt or .json)
    tasks.txt
    tasks.json
  outputs/          # Generated CSV files appear here
  generate-clickup-csv.js
  package.json
  README.md
```

## Dependencies

- [inquirer](https://www.npmjs.com/package/inquirer) - Interactive CLI prompts
- [papaparse](https://www.npmjs.com/package/papaparse) - CSV generation

## License

MIT


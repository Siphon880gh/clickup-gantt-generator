# ClickUp CSV Generator

A Node.js CLI tool using **Inquirer** that generates ClickUp-importable CSV files from task lists with flexible date scheduling.

## Features

- 📁 Lists files in `inputs/` and lets you pick one (supports `.txt` or `.json`)
- 📅 Asks whether to "cycle each" task on selected weekdays (M, T, W, H, F, S, U)
- 🗓️ Asks for a start date and number of weeks to generate
- 📊 Writes a ClickUp-importable CSV to `outputs/`

## Installation

```bash
npm install
```

## Usage

```bash
node generate-clickup-csv.js
```

The CLI will guide you through:
1. Selecting a task list from `inputs/`
2. Choosing whether to cycle tasks on specific weekdays
3. Selecting weekdays (if cycling):
   - **M** = Monday
   - **T** = Tuesday
   - **W** = Wednesday
   - **H** = Thursday
   - **F** = Friday
   - **S** = Saturday
   - **U** = Sunday
4. Setting a start date (YYYY-MM-DD format)
5. Number of weeks to generate
6. Optional CSV metadata (Start date column, Due date settings, List name)

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


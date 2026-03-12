# Todo App

A simple, browser-based **Todo List** application built with plain HTML, CSS, and JavaScript. Tasks are persisted in the browser's `localStorage`, so they survive page refreshes.

## Features

- Add new tasks via the input form
- Mark tasks as complete / incomplete with a checkbox
- Delete individual tasks
- Clear all completed tasks at once
- Live counter showing how many items are left
- Data persists automatically using `localStorage`

## How to View / Run the Project

No build step or server is required. You can open it in any of the following ways:

### Option 1 – Open directly in a browser (simplest)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/erabdurrahman/Java_lab.git
   ```
2. Navigate to the project folder:
   ```bash
   cd Java_lab
   ```
3. Double-click **`index.html`** or open it in your browser:
   ```bash
   # macOS
   open index.html

   # Linux
   xdg-open index.html

   # Windows (PowerShell)
   start index.html
   ```

### Option 2 – Serve with VS Code Live Server

1. Open the project folder in [Visual Studio Code](https://code.visualstudio.com/).
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.
4. The app opens automatically at `http://127.0.0.1:5500`.

### Option 3 – Serve with Python (any OS)

```bash
# Python 3
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Project Structure

```
Java_lab/
├── index.html   # App markup
├── style.css    # Styles
└── script.js    # Application logic
```

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Edge, Safari).

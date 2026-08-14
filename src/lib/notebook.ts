export type NotebookCellSource = {
  role: string;
  content: string;
  code?: string | null | undefined;
};


function md(source: string) {
  return {
    cell_type: "markdown",
    metadata: {},
    source: source.split("\n").map((l, i, a) => (i === a.length - 1 ? l : l + "\n")),
  };
}

function code(source: string) {
  return {
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: source.split("\n").map((l, i, a) => (i === a.length - 1 ? l : l + "\n")),
  };
}

export function buildNotebook(
  title: string,
  filename: string | null,
  cells: NotebookCellSource[],
) {
  const content: unknown[] = [
    md(`# ${title}\n\nExported from Lumen — Conversational Data Analyst.`),
    code(
      `import pandas as pd, numpy as np\n\ndf = pd.read_csv(${JSON.stringify(filename ?? "your_dataset.csv")})\ndf.head()`,
    ),
  ];

  for (const cell of cells) {
    if (cell.role === "user") content.push(md(`**Question:** ${cell.content}`));
    else {
      if (cell.code) content.push(code(cell.code));
      if (cell.content) content.push(md(cell.content));
    }
  }

  return {
    cells: content,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.11" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export function downloadNotebook(name: string, notebook: unknown) {
  const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "analysis"}.ipynb`;
  a.click();
  URL.revokeObjectURL(url);
}

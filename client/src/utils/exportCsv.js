const escapeCell = (value) => {
  let text = String(value ?? '');
  // Keep spreadsheet applications from interpreting user data as formulas.
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export default function exportCsv(filename, columns, rows) {
  const csv = [
    columns.map(column => escapeCell(column.label)).join(','),
    ...rows.map(row => columns.map(column => escapeCell(column.value(row))).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

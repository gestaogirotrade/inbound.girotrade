const SHEET_ID = '1kgo_BrjuyPp5zxOGaJJfucd6t9fdufE8KF2Po-aCkGk';
const TICKET_DIA_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=992823488`;
const BASETIME_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&range=A1:AZ`;

function parseCSV(csv) {
  const lines = csv.split(/\r?\n/);
  const firstLine = lines.find(l => l.trim() !== '') || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const rows = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === sep && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentLine.push(currentField.trim());
      rows.push(currentLine);
      currentLine = [];
      currentField = '';
    } else {
      if (char === '\r' && nextChar === '\n') { i++; }
      else { currentField += char; }
    }
  }
  if (currentLine.length > 0 || currentField !== '') {
    currentLine.push(currentField.trim());
    if (currentLine.join('').trim() !== '') rows.push(currentLine);
  }
  return rows;
}

const run = async () => {
  const tText = await fetch(TICKET_DIA_CSV_URL).then(r => r.text());
  const tRows = parseCSV(tText);
  console.log('TICKET DIA HEADERS:', tRows[0]);
  console.log('TICKET DIA SAMPLE ROW 1:', tRows[1]);
  console.log('TICKET DIA SAMPLE ROW 2:', tRows[2]);
  console.log('TICKET DIA SAMPLE ROW 3:', tRows[3]);
  console.log('TICKET DIA ROW COUNT:', tRows.length);

  const bText = await fetch(BASETIME_CSV_URL).then(r => r.text());
  const bRows = parseCSV(bText);
  console.log('BASETIME HEADERS:', bRows[0]);
  console.log('BASETIME ROW COUNT:', bRows.length);
};

run();

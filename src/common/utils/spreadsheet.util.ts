/** Genera hoja Excel 2003 XML (.xls) sin dependencias externas. */
export function buildExcelXmlSpreadsheet(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
): Buffer {
  const escapeXml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const safeSheet =
    sheetName.replace(/[\\/*?:\[\]]/g, '_').trim().slice(0, 31) || 'Hoja1';

  const cellXml = (value: string | number): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
    }
    // Quita tab usado como tip de texto; Excel interpreta String bien.
    const text = String(value ?? '').replace(/^\t/, '');
    return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
  };

  const rowXml = (cells: (string | number)[]): string =>
    `<Row>${cells.map(cellXml).join('')}</Row>`;

  const headerRow = rowXml(headers);
  const dataRows = rows.map(rowXml).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(safeSheet)}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf8');
}

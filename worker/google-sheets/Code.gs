const ENTRY_HEADERS = [
  'SubmittedAt',
  'SubmittedBy',
  'SubmittedByRole',
  'HighwayCode',
  'HighwayName',
  'District',
  'Location',
  'Status',
  'Notes',
];

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty('WRITE_TOKEN');
    if (!expectedToken || !constantTimeEquals(request.token || '', expectedToken)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const entry = request.entry;
    if (!entry || ENTRY_HEADERS.some((header) => {
      const key = header.charAt(0).toLowerCase() + header.slice(1);
      return typeof entry[key] !== 'string' || entry[key].length > 500;
    })) {
      return jsonResponse({ ok: false, error: 'Invalid entry' });
    }

    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    const sheetName = properties.getProperty('SHEET_NAME') || 'Mero Sadak Entries';
    if (!spreadsheetId) return jsonResponse({ ok: false, error: 'Spreadsheet is not configured' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
      if (sheet.getLastRow() === 0) sheet.appendRow(ENTRY_HEADERS);

      const values = ENTRY_HEADERS.map((header) => {
        const key = header.charAt(0).toLowerCase() + header.slice(1);
        const value = entry[key];
        return /^[=+\-@]/.test(value) ? `'${value}` : value;
      });
      sheet.appendRow(values);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, sheetName: sheetName });
  } catch (error) {
    console.error('Mero Sadak sheet entry failed:', error);
    return jsonResponse({ ok: false, error: 'Could not append entry' });
  }
}

function constantTimeEquals(actual, expected) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// backend/src/scripts/validateSheet.ts
import axios from "axios";
import { GAS_URL, SHEET_TAB } from "../config/index.js";
import { ROAD_STATUS } from "../constants/sheets.js";
import { logInfo, logError } from "../logs/logs.js";

async function validateSheetData() {
  console.log('🔍 SHEET DATA VALIDATION\n');
  console.log(`Tab: ${SHEET_TAB}`);
  console.log(`URL: ${GAS_URL}`);
  console.log('');

  try {
    const fetchUrl = `${GAS_URL}?tab=${encodeURIComponent(SHEET_TAB)}`;
    const res = await axios.get(fetchUrl, { timeout: 15000 });
    const parsed = res.data;

    if (!parsed || !Array.isArray(parsed.data)) {
      throw new Error("Invalid GAS response structure");
    }

    console.log('✅ GAS Response:');
    console.log(`   Total rows: ${parsed.count}`);
    console.log(`   Data array length: ${parsed.data.length}`);
    console.log('');

    const actualStatuses: Record<string, number> = {};
    const rowsWithIssue: string[] = [];

    parsed.data.forEach((row: any, idx: number) => {
      const status = (row.status || "").toString().trim();
      const roadRef = row.road_refno || row.road_code || "(no ref)";
      
      actualStatuses[status] = (actualStatuses[status] || 0) + 1;

      if (!status) {
        rowsWithIssue.push(`Row ${idx + 1} (${roadRef}): missing status`);
      }
    });

    console.log('📊 Status Distribution:');
    Object.entries(actualStatuses).forEach(([status, count]) => {
      console.log(`   ${status || "(empty)"}: ${count}`);
    });
    console.log('');

    if (rowsWithIssue.length > 0) {
      console.log('⚠️ Rows with issues:');
      rowsWithIssue.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

    const totalRowCount = parsed.data.length;
    const validRowCount = Object.values(actualStatuses).reduce((a, b) => a + b, 0);
    const invalidRowCount = totalRowCount - validRowCount;

    console.log('📋 Summary:');
    console.log(`   Total rows from GAS: ${totalRowCount}`);
    console.log(`   Valid rows (with status): ${validRowCount}`);
    console.log(`   Invalid rows (no status): ${invalidRowCount}`);
    console.log('');

    if (totalRowCount === 0) {
      console.log('❌ ERROR: No data returned from Google Sheet!');
      console.log('   Please verify:');
      console.log('   1. The "Roads" tab exists in your Google Sheet');
      console.log('   2. The GAS script is properly deployed');
      console.log('   3. The sheet has data rows (not just headers)');
    } else {
      console.log('✅ Sheet data retrieved successfully.');
      console.log('   Note: Any updates in Google Sheet will be reflected on next sync.');
    }

  } catch (error: any) {
    console.error('❌ Failed to validate sheet:', error.message);
  }

  console.log('\n🎯 VALIDATION COMPLETE');
}

validateSheetData().catch(console.error);

/**
 * แผนการกิน (Finess Meal & Nutrition Management) Backend API
 * Google Apps Script
 * Connected to Spreadsheet: 1yP5DwepfHxGoP0_OYx3zTXZTEdijbIt0aQj_1wTPuGs
 */

const SPREADSHEET_ID = '1yP5DwepfHxGoP0_OYx3zTXZTEdijbIt0aQj_1wTPuGs';

const SHEET_FOOD_DB = 'A หน้าเก็บเมนูอาหาร';
const SHEET_DAILY_LOG = 'B หน้าจดบันทึก';
const SHEET_DASHBOARD = 'C หน้าแสดงผลลัพธ์รายวัน';
const SHEET_SETTINGS = 'D ตั้งค่าเป้าหมาย';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();
    const sheetSummaries = sheets.map(s => {
      const lastRow = s.getLastRow();
      const lastCol = s.getLastColumn();
      let headers = [];
      let sample = [];
      if (lastRow > 0 && lastCol > 0) {
        const data = s.getRange(1, 1, Math.min(lastRow, 10), lastCol).getValues();
        headers = data[0] || [];
        sample = data.slice(1);
      }
      return {
        name: s.getName(),
        id: s.getSheetId(),
        rows: lastRow,
        cols: lastCol,
        headers: headers,
        sample: sample
      };
    });

    return createJsonResponse({
      status: 'success',
      service: 'Finess Meal Plan API',
      spreadsheetName: ss.getName(),
      sheets: sheetSummaries,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Empty request body' });
    }

    const contents = JSON.parse(e.postData.contents);
    const { action, payload = {}, passcode } = contents;

    if (!action) {
      return createJsonResponse({ status: 'error', message: 'Missing action field' });
    }

    // 1. Passcode verification endpoint
    if (action === 'VERIFY_PASSCODE') {
      const configuredPasscode = PropertiesService.getScriptProperties().getProperty('APP_PASSCODE') || '1234';
      const codeToVerify = String(payload.passcode !== undefined ? payload.passcode : passcode || '').trim();
      const isValid = (configuredPasscode === 'NONE') || (codeToVerify === configuredPasscode);
      return createJsonResponse({
        status: 'success',
        data: { valid: isValid }
      });
    }

    // 2. Passcode verification
    const configuredPasscode = PropertiesService.getScriptProperties().getProperty('APP_PASSCODE') || '1234';
    if (configuredPasscode && configuredPasscode !== 'NONE') {
      const reqPass = String(passcode || '').trim();
      if (reqPass !== configuredPasscode) {
        return createJsonResponse({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'รหัสผ่านไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'
        });
      }
    }

    const ss = getSpreadsheet();
    let result;

    switch (action) {
      case 'GET_INITIAL_DATA': {
        result = handleGetInitialData(ss);
        break;
      }
      case 'ADD_MEAL': {
        result = handleAddMeal(ss, payload);
        break;
      }
      case 'UPDATE_MEAL': {
        result = handleUpdateMeal(ss, payload);
        break;
      }
      case 'DELETE_MEAL': {
        result = handleDeleteMeal(ss, payload);
        break;
      }
      case 'DELETE_MEALS_BY_DATE': {
        result = handleDeleteMealsByDate(ss, payload);
        break;
      }
      case 'ADD_FOOD_ITEM': {
        result = handleAddFoodItem(ss, payload);
        break;
      }
      case 'UPDATE_FOOD_ITEM': {
        result = handleUpdateFoodItem(ss, payload);
        break;
      }
      case 'DELETE_FOOD_ITEM': {
        result = handleDeleteFoodItem(ss, payload);
        break;
      }
      case 'DEDUPLICATE_FOODS': {
        result = handleDeduplicateFoodItems(ss);
        break;
      }
      case 'ADD_WEIGHT_LOG': {
        result = handleAddWeightLog(ss, payload);
        break;
      }
      case 'ADD_WORKOUT_LOG': {
        result = handleAddWorkoutLog(ss, payload);
        break;
      }
      case 'ADD_SLEEP_LOG': {
        result = handleAddSleepLog(ss, payload);
        break;
      }
      case 'SAVE_CALORIE_SETTINGS': {
        result = handleSaveCalorieSettings(ss, payload);
        break;
      }
      case 'SAVE_PROJECTS': {
        result = handleSaveProjects(ss, payload);
        break;
      }
      case 'SAVE_WORKOUT_LOGS': {
        PropertiesService.getScriptProperties().setProperty('WORKOUT_LOGS', JSON.stringify(payload));
        result = { success: true };
        break;
      }
      case 'SAVE_STEP_LOGS': {
        PropertiesService.getScriptProperties().setProperty('STEP_LOGS', JSON.stringify(payload));
        result = { success: true };
        break;
      }
      case 'SAVE_SLEEP_LOGS': {
        PropertiesService.getScriptProperties().setProperty('SLEEP_LOGS', JSON.stringify(payload));
        result = { success: true };
        break;
      }
      case 'SAVE_SETTINGS': {
        if (payload.newPasscode) {
          PropertiesService.getScriptProperties().setProperty('APP_PASSCODE', String(payload.newPasscode).trim());
        }
        result = { success: true };
        break;
      }
      default:
        return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function handleGetInitialData(ss) {
  // 1. Food Database from 'A หน้าเก็บเมนูอาหาร'
  const foods = [];
  const foodSheet = ss.getSheetByName(SHEET_FOOD_DB) || ss.getSheets()[0];
  if (foodSheet && foodSheet.getLastRow() >= 4) {
    const data = foodSheet.getRange(4, 1, foodSheet.getLastRow() - 3, Math.min(foodSheet.getLastColumn(), 10)).getValues();
    data.forEach((row, i) => {
      if (row[2] && String(row[2]).trim() !== '') {
        foods.push({
          id: String(row[0] || 'F-' + (i + 1)),
          code: String(row[0] || ''),
          category: String(row[1] || 'ทั่วไป'),
          name: String(row[2] || ''),
          servingSize: String(row[3] || '1 เสิร์ฟ'),
          calories: Number(row[4] || 0),
          protein: Number(row[5] || 0),
          carbs: Number(row[6] || 0),
          fat: Number(row[7] || 0),
          targetGroup: String(row[8] || 'ทั้งคู่'),
          notes: String(row[9] || '')
        });
      }
    });
  }

  // 2. Meals & Daily Summaries from 'B หน้าจดบันทึก'
  const meals = [];
  const healthLogs = [];
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  if (logSheet && logSheet.getLastRow() >= 4) {
    const lastRow = logSheet.getLastRow();
    const lastCol = logSheet.getLastColumn();
    const fullData = logSheet.getRange(4, 1, lastRow - 3, lastCol).getValues();

    fullData.forEach((row, idx) => {
      // Left side: Meals (Cols A-J -> 0-9)
      const mealName = row[3];
      if (mealName && String(mealName).trim() !== '') {
        const rawDate = row[0];
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, 'Asia/Bangkok', 'yyyy-MM-dd');
        } else if (rawDate) {
          dateStr = String(rawDate).split('T')[0];
        }

        meals.push({
          id: 'M-' + (idx + 4),
          rowNumber: idx + 4,
          date: dateStr,
          person: String(row[1] || 'ฝ่ายชาย').trim(), // ฝ่ายชาย / ฝ่ายหญิง
          mealType: String(row[2] || '01. มื้อเช้า').trim(),
          foodName: String(row[3] || '').trim(),
          servings: Number(row[4] || 1),
          calories: Number(row[5] || 0),
          protein: Number(row[6] || 0),
          carbs: Number(row[7] || 0),
          fat: Number(row[8] || 0),
          notes: String(row[9] || ''),
          status: 'กินแล้ว'
        });
      }

      // Right side: Health & Weight Log (Cols L-U -> 11-20)
      if (row.length > 11 && row[11]) {
        const rawDate = row[11];
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, 'Asia/Bangkok', 'yyyy-MM-dd');
        } else if (rawDate) {
          dateStr = String(rawDate).split('T')[0];
        }

        if (dateStr) {
          healthLogs.push({
            date: dateStr,
            dayName: String(row[12] || ''),
            dayType: String(row[13] || 'วันปกติ'),
            maleWeight: row[14] !== '' ? Number(row[14]) : null,
            maleCalories: row[15] !== '' ? Number(row[15]) : null,
            maleProtein: row[16] !== '' ? Number(row[16]) : null,
            femaleWeight: row[17] !== '' ? Number(row[17]) : null,
            femaleCalories: row[18] !== '' ? Number(row[18]) : null,
            femaleProtein: row[19] !== '' ? Number(row[19]) : null,
            activity: String(row[20] || '')
          });
        }
      }
    });
  }

  // 3. Raw sheets metadata
  const rawSheets = ss.getSheets().map(s => {
    const lr = s.getLastRow();
    const lc = s.getLastColumn();
    let rows = [];
    let headers = [];
    if (lr > 0 && lc > 0) {
      const d = s.getRange(1, 1, Math.min(lr, 100), lc).getValues();
      headers = d[2] || d[0] || [];
      rows = d.slice(3);
    }
    return {
      name: s.getName(),
      sheetId: s.getSheetId(),
      headers: headers,
      rows: rows
    };
  });

  // 4. Calorie Settings & Targets (read directly from sheet)
  const calorieSettings = readCalorieSettingsFromSheet(ss);

  // 5. Projects
  let projects = null;
  const rawProjects = PropertiesService.getScriptProperties().getProperty('PROJECTS_LIST');
  if (rawProjects) {
    try {
      projects = JSON.parse(rawProjects);
    } catch (e) {}
  }

  // 6. Workout logs
  let workoutLogs = null;
  const rawWorkouts = PropertiesService.getScriptProperties().getProperty('WORKOUT_LOGS');
  if (rawWorkouts) {
    try {
      workoutLogs = JSON.parse(rawWorkouts);
    } catch (e) {}
  }

  // 7. Step logs
  let stepLogs = null;
  const rawSteps = PropertiesService.getScriptProperties().getProperty('STEP_LOGS');
  if (rawSteps) {
    try {
      stepLogs = JSON.parse(rawSteps);
    } catch (e) {}
  }

  // 8. Sleep logs
  let sleepLogs = null;
  const rawSleep = PropertiesService.getScriptProperties().getProperty('SLEEP_LOGS');
  if (rawSleep) {
    try {
      sleepLogs = JSON.parse(rawSleep);
    } catch (e) {}
  }

  return {
    spreadsheetName: ss.getName(),
    foods: foods,
    meals: meals,
    healthLogs: healthLogs,
    rawSheets: rawSheets,
    calorieSettings: calorieSettings,
    projects: projects,
    workoutLogs: workoutLogs || [],
    stepLogs: stepLogs || [],
    sleepLogs: sleepLogs || [],
    targets: {
      male: {
        calories: calorieSettings.male.maintenance,
        protein: calorieSettings.male.protein,
        carbs: calorieSettings.male.carbs,
        fat: calorieSettings.male.fat,
        targetWeight: 70
      },
      female: {
        calories: calorieSettings.female.maintenance,
        protein: calorieSettings.female.protein,
        carbs: calorieSettings.female.carbs,
        fat: calorieSettings.female.fat,
        targetWeight: 50
      }
    }
  };
}

function handleAddMeal(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();

  // Find next empty row in Column D (Food Name)
  let targetRow = lastRow + 1;
  const colD = logSheet.getRange(4, 4, Math.max(1, lastRow - 3), 1).getValues();
  for (let i = 0; i < colD.length; i++) {
    if (!colD[i][0] || String(colD[i][0]).trim() === '') {
      targetRow = i + 4;
      break;
    }
  }

  const dateVal = payload.date ? new Date(payload.date) : new Date();
  const person = payload.person || 'ฝ่ายชาย';
  const mealType = payload.mealType || '01. มื้อเช้า';
  const foodName = payload.foodName || '-';
  const servings = Number(payload.servings || 1);
  const calories = Number(payload.calories || 0);
  const protein = Number(payload.protein || 0);
  const carbs = Number(payload.carbs || 0);
  const fat = Number(payload.fat || 0);
  const notes = payload.notes || '';

  logSheet.getRange(targetRow, 1, 1, 10).setValues([[
    dateVal, person, mealType, foodName, servings, calories, protein, carbs, fat, notes
  ]]);

  return {
    success: true,
    rowNumber: targetRow,
    meal: { date: payload.date, person, mealType, foodName, servings, calories, protein, carbs, fat, notes }
  };
}

function handleUpdateMeal(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  if (lastRow < 4) return { success: false, message: 'No meals to update' };

  let targetRow = -1;
  if (payload.id && String(payload.id).startsWith('M-')) {
    targetRow = parseInt(String(payload.id).replace('M-', ''), 10);
  } else if (payload.rowNumber) {
    targetRow = Number(payload.rowNumber);
  }

  if (targetRow >= 4 && targetRow <= lastRow) {
    const row = logSheet.getRange(targetRow, 1, 1, 10).getValues()[0];
    const newFoodName = payload.foodName !== undefined ? payload.foodName : row[3];
    const newServings = payload.servings !== undefined ? Number(payload.servings) : Number(row[4]);
    const newCalories = payload.calories !== undefined ? Number(payload.calories) : Number(row[5]);
    const newProtein = payload.protein !== undefined ? Number(payload.protein) : Number(row[6]);
    const newCarbs = payload.carbs !== undefined ? Number(payload.carbs) : Number(row[7]);
    const newFat = payload.fat !== undefined ? Number(payload.fat) : Number(row[8]);
    const newNotes = payload.notes !== undefined ? payload.notes : row[9];

    logSheet.getRange(targetRow, 4, 1, 7).setValues([[
      newFoodName, newServings, newCalories, newProtein, newCarbs, newFat, newNotes
    ]]);

    return {
      success: true,
      updatedRow: targetRow,
      meal: { rowNumber: targetRow, foodName: newFoodName, servings: newServings, calories: newCalories, protein: newProtein, carbs: newCarbs, fat: newFat, notes: newNotes }
    };
  }

  return { success: false, message: 'Meal row not found' };
}

function handleDeleteMeal(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  if (lastRow < 4) {
    return { success: true, message: 'No meal records found' };
  }

  const targetRow = Number(payload.rowNumber || 0);
  const targetId = String(payload.id || '');
  let rowIndexToDelete = -1;

  if (targetRow >= 4 && targetRow <= lastRow) {
    rowIndexToDelete = targetRow - 4;
  } else if (targetId && targetId.startsWith('M-')) {
    const rNum = parseInt(targetId.replace('M-', ''), 10);
    if (rNum >= 4 && rNum <= lastRow) {
      rowIndexToDelete = rNum - 4;
    }
  }

  const numRows = lastRow - 3;
  const mealRange = logSheet.getRange(4, 1, numRows, 10);
  const values = mealRange.getValues();

  const existingMeals = [];
  for (let i = 0; i < values.length; i++) {
    const foodName = values[i][3];
    if (foodName && String(foodName).trim() !== '') {
      existingMeals.push({ index: i, row: values[i] });
    }
  }

  let filtered = [];
  let deleted = false;
  for (let i = 0; i < existingMeals.length; i++) {
    const actualRowIndex = existingMeals[i].index;
    if (actualRowIndex === rowIndexToDelete || (!deleted && targetId && 'M-' + (actualRowIndex + 4) === targetId)) {
      deleted = true;
    } else {
      filtered.push(existingMeals[i].row);
    }
  }

  // Clear existing A-J
  mealRange.clearContent();

  // Write remaining back
  if (filtered.length > 0) {
    logSheet.getRange(4, 1, filtered.length, 10).setValues(filtered);
  }

  return { success: true, deleted: deleted, remainingCount: filtered.length };
}

function handleDeleteMealsByDate(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  if (lastRow < 4) {
    return { success: true, count: 0, message: 'No meal records found' };
  }

  const rawTarget = String((payload && payload.date) || '2026-11-16').trim();
  const numRows = lastRow - 3;
  const mealRange = logSheet.getRange(4, 1, numRows, 10);
  const values = mealRange.getValues();

  const remaining = [];
  let deletedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const foodName = row[3];
    if (!foodName || String(foodName).trim() === '') {
      continue;
    }

    const rawDate = row[0];
    let dateStr = '';
    if (rawDate instanceof Date) {
      dateStr = Utilities.formatDate(rawDate, 'Asia/Bangkok', 'yyyy-MM-dd');
    } else if (rawDate) {
      dateStr = String(rawDate).split('T')[0].trim();
    }

    const dayPart = dateStr.includes('-') ? dateStr.split('-')[2] : '';
    const isMatch = (
      dateStr === rawTarget ||
      dateStr.endsWith('-' + rawTarget.padStart(2, '0')) ||
      dayPart === rawTarget.padStart(2, '0') ||
      (rawTarget === '16' && dayPart === '16')
    );

    if (isMatch) {
      deletedCount++;
    } else {
      remaining.push(row);
    }
  }

  // Clear columns A-J
  mealRange.clearContent();

  // Write back remaining meal records if any
  if (remaining.length > 0) {
    logSheet.getRange(4, 1, remaining.length, 10).setValues(remaining);
  }

  return {
    success: true,
    deletedCount: deletedCount,
    remainingCount: remaining.length,
    targetDate: rawTarget
  };
}

function deleteMealsDate16() {
  const ss = getSpreadsheet();
  return handleDeleteMealsByDate(ss, { date: '2026-11-16' });
}

function handleAddWeightLog(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  const dateStr = payload.date ? String(payload.date).split('T')[0] : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const person = String(payload.person || 'ฝ่ายชาย').trim();
  const weight = Number(payload.weight || 0);
  const notes = payload.notes || '';

  // Scan Column L (12 in 1-based, index 11 in 0-based) for the matching date
  let matchedRow = -1;
  if (lastRow >= 4) {
    const datesCol = logSheet.getRange(4, 12, lastRow - 3, 1).getValues();
    for (let i = 0; i < datesCol.length; i++) {
      let d = datesCol[i][0];
      let rowDateStr = '';
      if (d instanceof Date) {
        rowDateStr = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
      } else if (d) {
        rowDateStr = String(d).split('T')[0];
      }
      if (rowDateStr === dateStr) {
        matchedRow = i + 4;
        break;
      }
    }
  }

  // Col O (15) for male, Col R (18) for female
  const colToUpdate = person === 'ฝ่ายชาย' ? 15 : 18;
  if (matchedRow > 0) {
    if (weight > 0) {
      logSheet.getRange(matchedRow, colToUpdate).setValue(weight);
    }
    if (notes) {
      const currentNotes = logSheet.getRange(matchedRow, 21).getValue();
      const newNotes = currentNotes ? currentNotes + '; ' + notes : notes;
      logSheet.getRange(matchedRow, 21).setValue(newNotes);
    }
    return { success: true, updatedRow: matchedRow, date: dateStr, person, weight };
  } else {
    const targetRow = lastRow + 1;
    const dateVal = new Date(dateStr);
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dayName = dayNames[dateVal.getDay()] || 'จันทร์';
    const rowValues = new Array(21).fill('');
    rowValues[11] = dateVal;
    rowValues[12] = dayName;
    rowValues[13] = 'วันปกติ';
    rowValues[colToUpdate - 1] = weight;
    rowValues[20] = notes;
    logSheet.getRange(targetRow, 1, 1, 21).setValues([rowValues]);
    return { success: true, newRow: targetRow, date: dateStr, person, weight };
  }
}

function handleAddWorkoutLog(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  const dateStr = payload.date ? String(payload.date).split('T')[0] : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const person = String(payload.person || 'ฝ่ายชาย').trim();
  const exerciseName = String(payload.exerciseName || 'ออกกำลังกาย').trim();
  const duration = Number(payload.durationMinutes || 0);
  const burnedKcal = Number(payload.burnedCalories || 0);
  const steps = Number(payload.steps || 0);
  const notes = String(payload.notes || '').trim();

  let workoutSummary = `[${person}] 🏃 ${exerciseName}`;
  if (duration > 0 && burnedKcal > 0) {
    workoutSummary += ` (${duration} นาที, ${burnedKcal} kcal)`;
  } else if (duration > 0) {
    workoutSummary += ` (${duration} นาที)`;
  } else if (burnedKcal > 0) {
    workoutSummary += ` (${burnedKcal} kcal)`;
  }
  if (steps > 0) {
    workoutSummary += ` | 🚶 เดิน ${steps.toLocaleString()} ก้าว`;
  }
  if (notes) {
    workoutSummary += ` - ${notes}`;
  }

  // Scan Column L (12 in 1-based) for the matching date
  let matchedRow = -1;
  if (lastRow >= 4) {
    const datesCol = logSheet.getRange(4, 12, lastRow - 3, 1).getValues();
    for (let i = 0; i < datesCol.length; i++) {
      let d = datesCol[i][0];
      let rowDateStr = '';
      if (d instanceof Date) {
        rowDateStr = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
      } else if (d) {
        rowDateStr = String(d).split('T')[0];
      }
      if (rowDateStr === dateStr) {
        matchedRow = i + 4;
        break;
      }
    }
  }

  if (matchedRow > 0) {
    const currentNotes = logSheet.getRange(matchedRow, 21).getValue();
    const newNotes = currentNotes ? currentNotes + '\n' + workoutSummary : workoutSummary;
    logSheet.getRange(matchedRow, 21).setValue(newNotes);
    return { success: true, updatedRow: matchedRow, date: dateStr, person, workoutSummary };
  } else {
    const targetRow = lastRow + 1;
    const dateVal = new Date(dateStr);
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dayName = dayNames[dateVal.getDay()] || 'จันทร์';
    const rowValues = new Array(21).fill('');
    rowValues[11] = dateVal;
    rowValues[12] = dayName;
    rowValues[13] = 'วันปกติ';
    rowValues[20] = workoutSummary;
    logSheet.getRange(targetRow, 1, 1, 21).setValues([rowValues]);
    return { success: true, newRow: targetRow, date: dateStr, person, workoutSummary };
  }
}

function handleAddSleepLog(ss, payload) {
  const logSheet = ss.getSheetByName(SHEET_DAILY_LOG) || ss.getSheets()[1];
  const lastRow = logSheet.getLastRow();
  const dateStr = payload.date ? String(payload.date).split('T')[0] : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const person = String(payload.person || 'ฝ่ายชาย').trim();
  const bedTime = String(payload.bedTime || '23:00').trim();
  const wakeTime = String(payload.wakeTime || '07:00').trim();
  const formattedDuration = String(payload.formattedDuration || (payload.durationHours + ' ชม.')).trim();
  const quality = String(payload.quality || '').trim();
  const notes = String(payload.notes || '').trim();

  let sleepSummary = `[${person}] 😴 นอน ${bedTime} - ตื่น ${wakeTime} (${formattedDuration})`;
  if (quality) {
    sleepSummary += ` | ${quality}`;
  }
  if (notes) {
    sleepSummary += ` - ${notes}`;
  }

  // Scan Column L (12 in 1-based) for the matching date
  let matchedRow = -1;
  if (lastRow >= 4) {
    const datesCol = logSheet.getRange(4, 12, lastRow - 3, 1).getValues();
    for (let i = 0; i < datesCol.length; i++) {
      let d = datesCol[i][0];
      let rowDateStr = '';
      if (d instanceof Date) {
        rowDateStr = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
      } else if (d) {
        rowDateStr = String(d).split('T')[0];
      }
      if (rowDateStr === dateStr) {
        matchedRow = i + 4;
        break;
      }
    }
  }

  if (matchedRow > 0) {
    const currentNotes = logSheet.getRange(matchedRow, 21).getValue();
    const newNotes = currentNotes ? currentNotes + '\n' + sleepSummary : sleepSummary;
    logSheet.getRange(matchedRow, 21).setValue(newNotes);
    return { success: true, updatedRow: matchedRow, date: dateStr, person, sleepSummary };
  } else {
    const targetRow = lastRow + 1;
    const dateVal = new Date(dateStr);
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const dayName = dayNames[dateVal.getDay()] || 'จันทร์';
    const rowValues = new Array(21).fill('');
    rowValues[11] = dateVal;
    rowValues[12] = dayName;
    rowValues[13] = 'วันปกติ';
    rowValues[20] = sleepSummary;
    logSheet.getRange(targetRow, 1, 1, 21).setValues([rowValues]);
    return { success: true, newRow: targetRow, date: dateStr, person, sleepSummary };
  }
}

function handleAddFoodItem(ss, payload) {
  const foodSheet = ss.getSheetByName(SHEET_FOOD_DB) || ss.getSheets()[0];
  const lastRow = foodSheet.getLastRow();

  const code = payload.code || ('M' + String(lastRow - 2).padStart(2, '0'));
  const category = payload.category || 'ทั่วไป';
  const name = payload.name || '-';
  const servingSize = payload.servingSize || '1 เสิร์ฟ';
  const calories = Number(payload.calories || 0);
  const protein = Number(payload.protein || 0);
  const carbs = Number(payload.carbs || 0);
  const fat = Number(payload.fat || 0);
  const targetGroup = payload.targetGroup || 'ทั้งคู่';
  const notes = payload.notes || '';

  foodSheet.appendRow([
    code, category, name, servingSize, calories, protein, carbs, fat, targetGroup, notes
  ]);

  return {
    success: true,
    food: { code, category, name, servingSize, calories, protein, carbs, fat, targetGroup, notes }
  };
}

function handleDeleteFoodItem(ss, payload) {
  const foodSheet = ss.getSheetByName(SHEET_FOOD_DB) || ss.getSheets()[0];
  const lastRow = foodSheet.getLastRow();
  if (lastRow < 4) {
    return { success: false, message: 'No food items to delete' };
  }

  const targetCode = payload.code || payload.id;
  const targetName = payload.name;

  const data = foodSheet.getRange(4, 1, lastRow - 3, 10).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const rowCode = String(data[i][0] || '').trim();
    const rowName = String(data[i][2] || '').trim();

    if ((targetCode && rowCode === String(targetCode).trim()) ||
        (targetName && rowName === String(targetName).trim() && !targetCode)) {
      foodSheet.deleteRow(i + 4);
      return { success: true, deletedCode: rowCode, deletedName: rowName };
    }
  }

  return { success: false, message: 'Item not found' };
}

function handleUpdateFoodItem(ss, payload) {
  const foodSheet = ss.getSheetByName(SHEET_FOOD_DB) || ss.getSheets()[0];
  const lastRow = foodSheet.getLastRow();
  if (lastRow < 4) return { success: false, message: 'No food items' };

  const targetCode = payload.code || payload.id;
  const targetName = payload.name;

  const data = foodSheet.getRange(4, 1, lastRow - 3, 10).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowCode = String(data[i][0] || '').trim();
    const rowName = String(data[i][2] || '').trim();

    if ((targetCode && rowCode === String(targetCode).trim()) ||
        (!targetCode && targetName && (rowName === String(targetName).trim() || rowName.includes(targetName)))) {
      const rowIndex = i + 4;
      const row = data[i];

      const newCode = payload.newCode !== undefined ? payload.newCode : row[0];
      const newCategory = payload.category !== undefined ? payload.category : row[1];
      const newName = payload.newName !== undefined ? payload.newName : (payload.name !== undefined ? payload.name : row[2]);
      const newServingSize = payload.servingSize !== undefined ? payload.servingSize : row[3];
      const newCalories = payload.calories !== undefined ? Number(payload.calories) : Number(row[4]);
      const newProtein = payload.protein !== undefined ? Number(payload.protein) : Number(row[5]);
      const newCarbs = payload.carbs !== undefined ? Number(payload.carbs) : Number(row[6]);
      const newFat = payload.fat !== undefined ? Number(payload.fat) : Number(row[7]);
      const newTargetGroup = payload.targetGroup !== undefined ? payload.targetGroup : row[8];
      const newNotes = payload.notes !== undefined ? payload.notes : row[9];

      foodSheet.getRange(rowIndex, 1, 1, 10).setValues([[
        newCode, newCategory, newName, newServingSize, newCalories, newProtein, newCarbs, newFat, newTargetGroup, newNotes
      ]]);

      return {
        success: true,
        updatedRow: rowIndex,
        food: {
          code: newCode,
          category: newCategory,
          name: newName,
          servingSize: newServingSize,
          calories: newCalories,
          protein: newProtein,
          carbs: newCarbs,
          fat: newFat,
          targetGroup: newTargetGroup,
          notes: newNotes
        }
      };
    }
  }

  return { success: false, message: 'Food item not found' };
}

function handleDeduplicateFoodItems(ss) {
  const foodSheet = ss.getSheetByName(SHEET_FOOD_DB) || ss.getSheets()[0];
  const lastRow = foodSheet.getLastRow();
  if (lastRow < 4) return { success: true, removedCount: 0 };

  const data = foodSheet.getRange(4, 1, lastRow - 3, 10).getValues();
  const seen = new Set();
  const rowsToDelete = [];

  data.forEach((row, idx) => {
    const name = String(row[2] || '').trim();
    if (name) {
      if (seen.has(name)) {
        rowsToDelete.push(idx + 4);
      } else {
        seen.add(name);
      }
    }
  });

  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    foodSheet.deleteRow(rowsToDelete[i]);
  }

  return { success: true, removedCount: rowsToDelete.length };
}

function getOrCreateSettingsSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.getRange(1, 1, 3, 8).setValues([
      ['key', 'person', 'maintenance', 'deficit', 'protein', 'carbs', 'fat', 'stepGoal'],
      ['male', 'ฝ่ายชาย', 2300, 300, 120, 300, 65, 8000],
      ['female', 'ฝ่ายหญิง', 1700, 300, 104, 130, 40, 8000]
    ]);
  }
  return sheet;
}

function readCalorieSettingsFromSheet(ss) {
  const sheet = getOrCreateSettingsSheet(ss);
  const lastRow = sheet.getLastRow();
  const result = {
    male: { maintenance: 0, deficit: 0, protein: 0, carbs: 0, fat: 0, stepGoal: 0 },
    female: { maintenance: 0, deficit: 0, protein: 0, carbs: 0, fat: 0, stepGoal: 0 }
  };

  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    rows.forEach(row => {
      const key = String(row[0] || '').trim();
      if (key === 'male' || key === 'female') {
        result[key] = {
          maintenance: Number(row[2]) || 0,
          deficit: Number(row[3]) || 0,
          protein: Number(row[4]) || 0,
          carbs: Number(row[5]) || 0,
          fat: Number(row[6]) || 0,
          stepGoal: Number(row[7]) || 0
        };
      }
    });
  }

  return result;
}

function writeCalorieSettingsToSheet(ss, payload) {
  const sheet = getOrCreateSettingsSheet(ss);
  const male = payload.male || {};
  const female = payload.female || {};
  sheet.getRange(1, 1, 3, 8).setValues([
    ['key', 'person', 'maintenance', 'deficit', 'protein', 'carbs', 'fat', 'stepGoal'],
    ['male', 'ฝ่ายชาย', Number(male.maintenance) || 0, Number(male.deficit) || 0, Number(male.protein) || 0, Number(male.carbs) || 0, Number(male.fat) || 0, Number(male.stepGoal) || 0],
    ['female', 'ฝ่ายหญิง', Number(female.maintenance) || 0, Number(female.deficit) || 0, Number(female.protein) || 0, Number(female.carbs) || 0, Number(female.fat) || 0, Number(female.stepGoal) || 0]
  ]);
}

function handleSaveCalorieSettings(ss, payload) {
  if (!payload) return { success: false, message: 'Empty settings' };

  writeCalorieSettingsToSheet(ss, payload);

  // Also update 'C หน้าแสดงผลลัพธ์รายวัน' if it exists
  try {
    const dashSheet = ss.getSheetByName(SHEET_DASHBOARD) || ss.getSheets()[2];
    if (dashSheet && dashSheet.getLastRow() >= 6) {
      const maleProtein = Number(payload.male && payload.male.protein) || 0;
      const maleMaintenance = Number(payload.male && payload.male.maintenance) || 0;
      const maleStep = Number(payload.male && payload.male.stepGoal) || 0;
      const femaleProtein = Number(payload.female && payload.female.protein) || 0;
      const femaleMaintenance = Number(payload.female && payload.female.maintenance) || 0;
      const femaleStep = Number(payload.female && payload.female.stepGoal) || 0;

      // Update row 6 (header titles)
      dashSheet.getRange(6, 2).setValue('🏋️‍♂️ สรุปโภชนาการรายวัน: ฝ่ายชาย (เป้า ' + maleMaintenance + ' kcal | โปรตีน ' + maleProtein + 'g | ' + Number(maleStep).toLocaleString() + ' ก้าว)');
      dashSheet.getRange(6, 8).setValue('🧘‍♀️ สรุปโภชนาการรายวัน: ฝ่ายหญิง (เป้า ' + femaleMaintenance + ' kcal | โปรตีน ' + femaleProtein + 'g | ' + Number(femaleStep).toLocaleString() + ' ก้าว)');

      // Update row 9 (target badges)
      dashSheet.getRange(9, 3).setValue('เป้า ' + maleProtein + 'g');
      dashSheet.getRange(9, 9).setValue('เป้า ' + femaleProtein + 'g');

      // Update row 33-34 (nutrition & step guidelines)
      if (dashSheet.getLastRow() >= 34) {
        dashSheet.getRange(33, 1).setValue('• ฝ่ายชาย: ดื่มน้ำ 3.0 - 3.5 ลิตร/วัน | เดินอย่างน้อย ' + Number(maleStep).toLocaleString() + ' ก้าว | ชานมหวานปกติเฉพาะวันพักผ่อน (Rest Day)');
        dashSheet.getRange(34, 1).setValue('• ฝ่ายหญิง: ดื่มน้ำ 2.0 - 2.5 ลิตร/วัน | เดินอย่างน้อย ' + Number(femaleStep).toLocaleString() + ' ก้าว | ชานมหวาน 30% ไม่เกิน 2-3 แก้ว/สัปดาห์');
      }
    }
  } catch (err) {
    Logger.log('Could not update sheet C: ' + err);
  }

  return { success: true, settings: payload };
}

function handleSaveProjects(ss, payload) {
  if (!payload || !Array.isArray(payload)) return { success: false, message: 'Invalid projects' };
  PropertiesService.getScriptProperties().setProperty('PROJECTS_LIST', JSON.stringify(payload));
  return { success: true, count: payload.length };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function inspectSpreadsheet() {
  const ss = getSpreadsheet();
  Logger.log('Spreadsheet Name: ' + ss.getName());
  const sheets = ss.getSheets();
  sheets.forEach(sheet => {
    Logger.log('Sheet: ' + sheet.getName() + ' (ID: ' + sheet.getSheetId() + ', Rows: ' + sheet.getLastRow() + ', Cols: ' + sheet.getLastColumn() + ')');
  });
}

/**
 * 반려동물 사료 가격 비교 계산기 - Apps Script 백엔드
 *
 * 설치: 원본 스프레드시트에서 확장 프로그램 > Apps Script 로 열고
 * 이 파일 내용을 Code.gs에 붙여넣은 뒤 웹앱으로 배포한다.
 * (실행 계정: 나 / 액세스 권한: 링크를 아는 모든 사용자)
 *
 * 대상 시트: 3번째 탭, 1행 헤더
 * 컬럼: A 대분류 | B 구매일 | C 소분류 | D 무게(kg/개) | E 가격 | F kg/g당 | G 원산지(제조)/비고
 */

var SHEET_INDEX = 2; // 0-indexed → 3번째 탭
var HEADER_ROW = 1;
var COLUMNS = { CATEGORY: 0, DATE: 1, PRODUCT: 2, WEIGHT: 3, PRICE: 4, UNIT_PRICE: 5, NOTE: 6 };
var CATEGORY_UNIT = { '건식': 'kg', '습식': 'g' };

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[SHEET_INDEX];
}

function getUnit_(category) {
  return CATEGORY_UNIT[category] || 'kg';
}

function toGrams_(weight, category) {
  return getUnit_(category) === 'kg' ? weight * 1000 : weight;
}

function fromGrams_(grams, category) {
  return getUnit_(category) === 'kg' ? grams / 1000 : grams;
}

function parseNumber_(raw) {
  if (typeof raw === 'number') return raw;
  var n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function readRows_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return [];
  var values = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, 7).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var category = String(r[COLUMNS.CATEGORY] || '').trim();
    var product = String(r[COLUMNS.PRODUCT] || '').trim();
    if (!category || !product) continue;
    var weightRaw = parseNumber_(r[COLUMNS.WEIGHT]);
    var price = parseNumber_(r[COLUMNS.PRICE]);
    if (!weightRaw || !price) continue;
    var weightGrams = toGrams_(weightRaw, category);
    rows.push({
      category: category,
      date: r[COLUMNS.DATE] ? String(r[COLUMNS.DATE]) : '',
      product: product,
      weightGrams: weightGrams,
      price: price,
      pricePerGram: price / weightGrams,
      note: r[COLUMNS.NOTE] ? String(r[COLUMNS.NOTE]) : ''
    });
  }
  return rows;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'meta') return jsonOut_(getMeta_());
    if (action === 'compare') {
      return jsonOut_(getComparison_(
        e.parameter.category,
        e.parameter.product,
        Number(e.parameter.weight),
        Number(e.parameter.price)
      ));
    }
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === 'addRecord') {
      return jsonOut_(addRecord_(payload));
    }
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function getMeta_() {
  var rows = readRows_();
  var categories = [];
  var productsByCategory = {};
  rows.forEach(function (r) {
    if (categories.indexOf(r.category) === -1) categories.push(r.category);
    if (!productsByCategory[r.category]) productsByCategory[r.category] = [];
    if (productsByCategory[r.category].indexOf(r.product) === -1) {
      productsByCategory[r.category].push(r.product);
    }
  });
  return { categories: categories, productsByCategory: productsByCategory };
}

function getComparison_(category, product, weightInputGrams, priceInput) {
  var rows = readRows_().filter(function (r) { return r.category === category; });
  var productRows = rows.filter(function (r) { return r.product === product; });

  var inputPricePerGram = weightInputGrams > 0 ? priceInput / weightInputGrams : null;

  var result = { category: category, product: product, inputPricePerGram: inputPricePerGram };

  if (productRows.length > 0) {
    var sum = 0;
    var min = productRows[0];
    productRows.forEach(function (r) {
      sum += r.pricePerGram;
      if (r.pricePerGram < min.pricePerGram) min = r;
    });
    var avgPricePerGram = sum / productRows.length;
    result.productStats = {
      count: productRows.length,
      avgPricePerGram: avgPricePerGram,
      minPricePerGram: min.pricePerGram,
      minRecord: { price: min.price, weightGrams: min.weightGrams, date: min.date },
      vsAvgDiff: inputPricePerGram !== null ? inputPricePerGram - avgPricePerGram : null,
      vsMinDiff: inputPricePerGram !== null ? inputPricePerGram - min.pricePerGram : null
    };
  } else {
    result.productStats = null;
  }

  var byProduct = {};
  rows.forEach(function (r) {
    if (!byProduct[r.product] || r.pricePerGram < byProduct[r.product].pricePerGram) {
      byProduct[r.product] = { product: r.product, minPricePerGram: r.pricePerGram };
    }
  });
  var categoryComparison = Object.keys(byProduct).map(function (k) { return byProduct[k]; });
  categoryComparison.sort(function (a, b) { return a.minPricePerGram - b.minPricePerGram; });
  result.categoryComparison = categoryComparison;

  return result;
}

function addRecord_(payload) {
  var category = String(payload.category || '').trim();
  var product = String(payload.product || '').trim();
  var weightGrams = Number(payload.weightGrams);
  var price = Number(payload.price);
  var note = payload.note ? String(payload.note) : '';
  var date = payload.date ? String(payload.date) : formatDate_(new Date());

  if (!category || !product || !weightGrams || !price) {
    return { error: 'invalid payload' };
  }

  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var insertAt = null;

  if (lastRow > HEADER_ROW) {
    var categoryCol = sheet
      .getRange(HEADER_ROW + 1, COLUMNS.CATEGORY + 1, lastRow - HEADER_ROW, 1)
      .getValues();
    for (var i = categoryCol.length - 1; i >= 0; i--) {
      if (String(categoryCol[i][0]).trim() === category) {
        insertAt = HEADER_ROW + 1 + i + 1;
        break;
      }
    }
  }

  var weightForSheet = fromGrams_(weightGrams, category);
  var pricePerUnit = getUnit_(category) === 'kg' ? (price / weightGrams) * 1000 : price / weightGrams;
  var rowValues = [category, date, product, weightForSheet, price, Math.round(pricePerUnit), note];

  if (insertAt) {
    sheet.insertRowBefore(insertAt);
    sheet.getRange(insertAt, 1, 1, 7).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
    insertAt = sheet.getLastRow();
  }

  return { success: true, row: insertAt };
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yy.MM.dd');
}

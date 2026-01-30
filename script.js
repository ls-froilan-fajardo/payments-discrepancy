// ===================== Global State =====================
let updateLeftTable = null;
let updateRightTable = null;
let isMatchAllActive = false; 

// ===================== Match All Toggle =====================
document.getElementById('matchAllBtn').addEventListener('click', function() {
  isMatchAllActive = !isMatchAllActive;
  this.style.backgroundColor = isMatchAllActive ? '#16a34a' : '';
  this.textContent = isMatchAllActive ? 'Alignment: ON' : 'Match All Payment IDs';
  refreshBoth();
});

function refreshBoth() {
    if (updateLeftTable) updateLeftTable();
    if (updateRightTable) updateRightTable();
}

// ===================== HELPER: Insert Blank Row =====================
function insertBlankRow(tbody, index, numCols) {
  const tr = document.createElement('tr');
  for (let c = 0; c < numCols; c++) {
    const td = document.createElement('td');
    td.style.height = '20px';
    tr.appendChild(td);
  }
  tbody.insertBefore(tr, tbody.rows[index]);
}

// ===================== Global Dynamic Highlight (Bidirectional) =====================
function updatePaymentIDHighlights() {
  const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
  const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');

  const maxLength = Math.max(leftRows.length, rightRows.length);

  for (let index = 0; index < maxLength; index++) {
    const leftRow = leftRows[index];
    const rightRow = rightRows[index];
    
    const leftPaymentCell = leftRow?.cells[0];
    const rightPaymentCell = rightRow?.cells[0];

    const leftVal = leftPaymentCell?.textContent.trim() || "";
    const rightVal = rightPaymentCell?.textContent.trim() || "";

    if (leftVal !== rightVal || leftVal === "" || rightVal === "") {
      if (leftPaymentCell) leftPaymentCell.style.backgroundColor = '#f8d7da'; 
      if (rightPaymentCell) rightPaymentCell.style.backgroundColor = '#f8d7da'; 
    } else {
      if (leftPaymentCell) leftPaymentCell.style.backgroundColor = '';
      if (rightPaymentCell) rightPaymentCell.style.backgroundColor = '';
    }
  }
}

// ================= CSV Panel Initialization =================
function initCSVPanel(fileInputId, filterDivId, outputDivId, addBtnId, removeBtnId, undoBtnId, isRightTable = false) {
  let csvData = [];
  let headerRow = [];
  let selectedRows = new Set();
  let actionHistory = [];
  let colMethodIndex, colPaymentIndex, colHIndex, colFIndex, colMIndex;

  if (isRightTable) updateRightTable = updateOutput;
  else updateLeftTable = updateOutput;

  document.getElementById(fileInputId).addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file);
  });

  // Shift Row(s) Down Logic
  document.getElementById(addBtnId).addEventListener('click', function() {
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if (!tableBody || selectedRows.size === 0) return;
    const allRows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'));
    let firstIdx = allRows.length;
    allRows.forEach((tr, i) => { if (selectedRows.has(tr) && i < firstIdx) firstIdx = i; });

    const numRows = selectedRows.size;
    const addedRows = [];
    for (let i = 0; i < numRows; i++) {
      const tr = document.createElement('tr');
      const numCols = isRightTable ? 4 : 6;
      for (let c = 0; c < numCols; c++) {
        const td = document.createElement('td');
        td.style.height = '20px';
        tr.appendChild(td);
      }
      tr.addEventListener('click', (e) => toggleRowSelection(tr, e));
      tableBody.insertBefore(tr, tableBody.rows[firstIdx]);
      addedRows.push(tr);
    }
    updateTotals();
    updatePaymentIDHighlights();
    actionHistory.push({ type: 'add', rows: addedRows });
  });

  document.getElementById(removeBtnId).addEventListener('click', function() {
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if (!tableBody) return;
    const removedRows = [];
    selectedRows.forEach(tr => {
      if (tr.parentNode) {
        removedRows.push({ row: tr, nextSibling: tr.nextSibling });
        tr.parentNode.removeChild(tr);
      }
    });
    selectedRows.clear();
    updateTotals();
    updatePaymentIDHighlights();
    if (removedRows.length > 0) actionHistory.push({ type: 'delete', rows: removedRows });
  });

  document.getElementById(undoBtnId).addEventListener('click', function() {
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if (!tableBody || actionHistory.length === 0) return;
    const lastAction = actionHistory.pop();
    if (lastAction.type === 'add') {
      lastAction.rows.forEach(tr => { if (tr.parentNode) tr.parentNode.removeChild(tr); });
    } else if (lastAction.type === 'delete') {
      lastAction.rows.forEach(obj => {
        const { row, nextSibling } = obj;
        if (nextSibling && nextSibling.parentNode) tableBody.insertBefore(row, nextSibling);
        else tableBody.appendChild(row);
      });
    }
    updateTotals();
    updatePaymentIDHighlights();
  });

  function toggleRowSelection(tr, e) {
    if (!e.ctrlKey && !e.metaKey) {
        tr.parentNode.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        selectedRows.clear();
    }
    tr.classList.toggle('selected');
    if (tr.classList.contains('selected')) selectedRows.add(tr);
    else selectedRows.delete(tr);
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    headerRow = parseCSVLine(lines[0]);
    csvData = lines.slice(1).map(line => parseCSVLine(line));
    colMethodIndex = headerRow.indexOf("Method");
    colPaymentIndex = headerRow.indexOf(isRightTable ? "Payment ID" : "PaymentRef");
    colFIndex = headerRow.indexOf("Date");
    colMIndex = headerRow.indexOf("Amount");
    colHIndex = isRightTable ? headerRow.indexOf("Card last 4") : headerRow.indexOf("Account");

    if (!isRightTable) generateMethodCheckboxes();
    else generateChannelCheckboxes();
    updateOutput();
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i - 1] !== '\\') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else current += char;
    }
    result.push(current);
    return result.map(c => c.replace(/^"(.*)"$/, '$1'));
  }

  function generateMethodCheckboxes() {
    const div = document.getElementById(filterDivId);
    div.innerHTML = '';
    const methods = [...new Set(csvData.map(r => r[colMethodIndex]?.replace(/\s*\(.*?\)\s*/g, '').trim()).filter(m => m))].sort();
    methods.forEach(method => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = method;
      cb.addEventListener('change', refreshBoth);
      lbl.append(cb, ` ${method}`); div.appendChild(lbl);
    });
  }

  function generateChannelCheckboxes() {
    const div = document.getElementById('channelCheckboxesRight');
    div.innerHTML = '';
    const colChannelIndex = headerRow.indexOf("Channel");
    const channels = [...new Set(csvData.map(r => (r[colChannelIndex] || 'Blank').trim() || 'Blank'))].sort();
    channels.forEach(channel => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = channel;
      cb.addEventListener('change', refreshBoth);
      lbl.append(cb, ` ${channel}`); div.appendChild(lbl);
    });
  }

  function updateOutput() {
    selectedRows.clear();
    const outputDiv = document.getElementById(outputDivId);
    outputDiv.innerHTML = '';
    if (csvData.length === 0) return;

    let checked = Array.from(document.querySelectorAll(`#${filterDivId} input:checked`)).map(cb => cb.value);
    let rows = [...csvData];

    if (checked.length > 0) {
      rows = rows.filter(r => {
          const val = isRightTable ? (r[headerRow.indexOf("Channel")] || 'Blank').trim() || 'Blank' : r[colMethodIndex].replace(/\s*\(.*?\)\s*/g, '').trim();
          return checked.includes(val);
      });
    }

    if (isRightTable && headerRow.indexOf("Status") !== -1) {
        rows = rows.filter(r => r[headerRow.indexOf("Status")].trim().toUpperCase() !== 'FAILED');
    }

    // Default Sorting: Date
    rows.sort((a, b) => new Date(a[colFIndex]) - new Date(b[colFIndex]));

    const table = document.createElement('table');
    const headers = isRightTable ? ['Payment ID', 'Card last 4', 'Date', 'Amount'] : ['PaymentRef', 'Account', 'Date', 'Amount', 'Tip', 'Paid'];
    table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = document.createElement('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.addEventListener('click', (e) => toggleRowSelection(tr, e));
      headers.forEach(h => {
        const td = document.createElement('td');
        td.style.height = '20px';
        if (h === 'PaymentRef' || h === 'Payment ID') td.textContent = r[colPaymentIndex];
        else if (h === 'Account' || h === 'Card last 4') td.textContent = r[colHIndex];
        else if (h === 'Date') td.textContent = r[colFIndex];
        else td.textContent = parseFloat(r[headerRow.indexOf(h)] || 0).toFixed(2);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const totalsRow = document.createElement('tr');
    totalsRow.classList.add('totals-row');
    tbody.appendChild(totalsRow);
    table.appendChild(tbody);
    outputDiv.appendChild(table);

    if (isMatchAllActive && isRightTable) {
        setTimeout(runAlignmentLogic, 10); 
    }

    updateTotals();
    updatePaymentIDHighlights();
  }

  function updateTotals() {
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if (!tableBody) return;
    const totalsRow = tableBody.querySelector('.totals-row');
    const rows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'));
    const numCols = rows[0]?.children.length || 0;
    const sums = new Array(numCols).fill(0);

    rows.forEach(tr => {
      for (let i = 0; i < numCols; i++) {
        const val = parseFloat(tr.children[i]?.textContent);
        if (!isNaN(val)) sums[i] += val;
      }
    });

    totalsRow.innerHTML = '';
    for (let i = 0; i < numCols; i++) {
      const td = document.createElement('td');
      if (i === 0) {
        td.textContent = 'Total';
      } else if (isRightTable) {
        if (i === 1 || i === 2) td.textContent = '';
        else td.textContent = sums[i] ? sums[i].toFixed(2) : '';
      } else {
        if (i === 2) td.textContent = '';
        else td.textContent = sums[i] ? sums[i].toFixed(2) : '';
      }
      totalsRow.appendChild(td);
    }
  }
}

// ===================== Standalone Alignment Logic =====================
function runAlignmentLogic() {
  const leftTbody = document.querySelector('#outputLeft table tbody');
  const rightTbody = document.querySelector('#outputRight table tbody');
  if (!leftTbody || !rightTbody) return;

  let i = 0;
  // Step 1: Align existing IDs
  while (i < Math.max(leftTbody.rows.length - 1, rightTbody.rows.length - 1)) {
    const leftRow = leftTbody.rows[i];
    const rightRow = rightTbody.rows[i];
    if (leftRow?.classList.contains('totals-row') || rightRow?.classList.contains('totals-row')) break;

    const leftID = leftRow?.cells[0]?.textContent.trim();
    const rightID = rightRow?.cells[0]?.textContent.trim();

    if (leftID === rightID || (!leftID && !rightID)) {
      i++; continue;
    }

    let foundInRight = false;
    for (let r = i + 1; r < rightTbody.rows.length - 1; r++) {
      if (rightTbody.rows[r].cells[0].textContent.trim() === leftID) { foundInRight = true; break; }
    }

    let foundInLeft = false;
    for (let l = i + 1; l < leftTbody.rows.length - 1; l++) {
      if (leftTbody.rows[l].cells[0].textContent.trim() === rightID) { foundInLeft = true; break; }
    }

    if (foundInRight) {
      insertBlankRow(leftTbody, i, 6);
    } else if (foundInLeft) {
      insertBlankRow(rightTbody, i, 4);
    } else {
      i++;
    }
  }

  // Step 2: Row Padding - Force tables to equal length before Totals row
  let leftDataRows = leftTbody.querySelectorAll('tr:not(.totals-row)').length;
  let rightDataRows = rightTbody.querySelectorAll('tr:not(.totals-row)').length;

  while (leftDataRows < rightDataRows) {
    insertBlankRow(leftTbody, leftDataRows, 6);
    leftDataRows++;
  }
  while (rightDataRows < leftDataRows) {
    insertBlankRow(rightTbody, rightDataRows, 4);
    rightDataRows++;
  }

  updatePaymentIDHighlights();
}

// ================== Initialize ==================
initCSVPanel('csvFileLeft', 'methodCheckboxesLeft', 'outputLeft', 'addRowBtnLeft', 'removeRowBtnLeft', 'undoBtnLeft', false);
initCSVPanel('csvFileRight', 'channelCheckboxesRight', 'outputRight', 'addRowBtnRight', 'removeRowBtnRight', 'undoBtnRight', true);

// Scroll Sync
const leftBox = document.getElementById('outputLeft');
const rightBox = document.getElementById('outputRight');
leftBox.onscroll = () => rightBox.scrollTop = leftBox.scrollTop;
rightBox.onscroll = () => leftBox.scrollTop = rightBox.scrollTop;

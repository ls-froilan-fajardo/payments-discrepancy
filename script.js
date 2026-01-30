// ===================== Global State =====================
let updateLeftTable = null;
let updateRightTable = null;

// ENABLED BY DEFAULT
let isMatchAllActive = true; 
let isRedFilterActive = true;

// Set initial button styles on load
window.addEventListener('DOMContentLoaded', () => {
  setButtonStates();
});

function setButtonStates() {
  const matchBtn = document.getElementById('matchAllBtn');
  const redBtn = document.getElementById('showRedOnlyBtn');
  
  if (matchBtn) {
    matchBtn.style.backgroundColor = '#16a34a';
    matchBtn.textContent = 'Alignment: ON';
  }
  
  if (redBtn) {
    redBtn.style.backgroundColor = '#dc2626';
    redBtn.textContent = 'Showing Red Only';
  }
}

// ===================== Global Action Listeners =====================
document.getElementById('matchAllBtn').addEventListener('click', function() {
  isMatchAllActive = !isMatchAllActive;
  this.style.backgroundColor = isMatchAllActive ? '#16a34a' : '';
  this.textContent = isMatchAllActive ? 'Alignment: ON' : 'Match All Payment IDs';
  refreshBoth();
});

document.getElementById('showRedOnlyBtn').addEventListener('click', function() {
  isRedFilterActive = !isRedFilterActive;
  this.style.backgroundColor = isRedFilterActive ? '#dc2626' : '';
  this.textContent = isRedFilterActive ? 'Showing Red Only' : 'Show Red Highlights Only';
  applyRedFilter();
});

// ===================== MANUAL ROBUST RESET =====================
document.getElementById('resetViewBtn').addEventListener('click', function() {
    if (confirm("Are you sure you want to clear all data and reset the dashboard?")) {
        // 1. Clear the File Inputs
        document.getElementById('csvFileLeft').value = "";
        document.getElementById('csvFileRight').value = "";

        // 2. Clear the Table Outputs
        document.getElementById('outputLeft').innerHTML = "";
        document.getElementById('outputRight').innerHTML = "";

        // 3. Clear the Filter Checkboxes
        document.getElementById('methodCheckboxesLeft').innerHTML = "";
        document.getElementById('channelCheckboxesRight').innerHTML = "";

        // 4. Reset Global State
        isMatchAllActive = true;
        isRedFilterActive = true;
        setButtonStates();

        console.log("Reconciliation Tool: Full Reset Completed.");
    }
});

function refreshBoth() {
    if (updateLeftTable) updateLeftTable();
    if (updateRightTable) updateRightTable();
    if (isRedFilterActive) applyRedFilter();
}

// ===================== Totals Logic =====================
function updateTotalsDOM(outputId, isRight) {
    const container = document.getElementById(outputId);
    if (!container) return;
    const tableBody = container.querySelector('tbody');
    if (!tableBody) return;
    
    const totalsRow = tableBody.querySelector('.totals-row');
    const rows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'));
    const numCols = rows[0]?.children.length || 0;
    const sums = new Array(numCols).fill(0);

    rows.forEach(tr => {
      if (tr.style.display !== 'none') {
        for (let i = 0; i < numCols; i++) {
          const val = parseFloat(tr.children[i]?.textContent);
          if (!isNaN(val)) sums[i] += val;
        }
      }
    });

    if (totalsRow) {
        totalsRow.innerHTML = '';
        for (let i = 0; i < numCols; i++) {
          const td = document.createElement('td');
          if (i === 0) td.textContent = isRedFilterActive ? 'Filtered Total' : 'Total';
          else if (isRight && (i === 1 || i === 2)) td.textContent = '';
          else if (!isRight && i === 2) td.textContent = '';
          else td.textContent = sums[i] ? sums[i].toFixed(2) : '';
          totalsRow.appendChild(td);
        }
    }
}

function applyRedFilter() {
  const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
  const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');

  for (let i = 0; i < leftRows.length; i++) {
    const lRow = leftRows[i];
    const rRow = rightRows[i];
    const isRed = (lRow?.cells[0]?.style.backgroundColor === 'rgb(248, 215, 218)') || 
                  (rRow?.cells[0]?.style.backgroundColor === 'rgb(248, 215, 218)');

    const displayStyle = isRedFilterActive ? (isRed ? '' : 'none') : '';
    if (lRow) lRow.style.display = displayStyle;
    if (rRow) rRow.style.display = displayStyle;
  }
  updateTotalsDOM('outputLeft', false);
  updateTotalsDOM('outputRight', true);
}

// ===================== Table Initialization =====================
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

  document.getElementById(addBtnId).addEventListener('click', function() {
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if (!tableBody || selectedRows.size === 0) return;
    const firstIdx = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)')).findIndex(tr => selectedRows.has(tr));

    const addedRows = [];
    for (let i = 0; i < selectedRows.size; i++) {
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
    updatePaymentIDHighlights();
    refreshBoth();
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
    refreshBoth();
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
    refreshBoth();
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
    csvData = lines.slice(1).map(line => parseCSVLine(line)).filter(r => r.length > 1);
    
    colMethodIndex = headerRow.indexOf("Method");
    colPaymentIndex = headerRow.indexOf(isRightTable ? "Payment ID" : "PaymentRef");
    colFIndex = headerRow.indexOf("Date");
    colMIndex = headerRow.indexOf("Amount");
    colHIndex = isRightTable ? headerRow.indexOf("Card last 4") : headerRow.indexOf("Account");

    const filterId = isRightTable ? 'channelCheckboxesRight' : 'methodCheckboxesLeft';
    generateCheckboxes(filterId, csvData, isRightTable ? headerRow.indexOf("Channel") : colMethodIndex, !isRightTable);
    updateOutput();
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && line[i-1] !== '\\') q = !q;
      else if (line[i] === ',' && !q) { result.push(cur); cur = ''; }
      else cur += line[i];
    }
    result.push(cur);
    return result.map(c => c.replace(/^"(.*)"$/, '$1').trim());
  }

  function generateCheckboxes(id, data, col, isLeft) {
    const div = document.getElementById(id);
    div.innerHTML = '';
    const items = [...new Set(data.map(r => {
        let v = (r[col] || '').trim();
        return isLeft ? v.replace(/\s*\(.*?\)\s*/g, '').trim() : v;
    }).filter(v => v !== ''))].sort();

    items.forEach(item => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = item;
      cb.addEventListener('change', refreshBoth);
      lbl.append(cb, ` ${item}`); div.appendChild(lbl);
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
      const colIdx = isRightTable ? headerRow.indexOf("Channel") : colMethodIndex;
      rows = rows.filter(r => {
          let v = (r[colIdx] || '').trim();
          if (!isRightTable) v = v.replace(/\s*\(.*?\)\s*/g, '').trim();
          return checked.includes(v);
      });
    }

    if (isRightTable) {
        const sIdx = headerRow.indexOf("Status");
        if (sIdx !== -1) rows = rows.filter(r => (r[sIdx] || '').toUpperCase() !== 'FAILED');
    }

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
        const idx = headerRow.indexOf(h);
        if (h === 'Payment ID' || h === 'PaymentRef') td.textContent = r[colPaymentIndex] || '';
        else if (h === 'Card last 4' || h === 'Account') td.textContent = r[colHIndex] || '';
        else if (h === 'Date') td.textContent = r[colFIndex] || '';
        else td.textContent = idx !== -1 ? parseFloat(r[idx] || 0).toFixed(2) : '0.00';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const totalsRow = document.createElement('tr');
    totalsRow.classList.add('totals-row');
    tbody.appendChild(totalsRow);
    table.appendChild(tbody);
    outputDiv.appendChild(table);

    if (isMatchAllActive && isRightTable) setTimeout(runAlignmentLogic, 10); 
    else {
        updatePaymentIDHighlights();
        isRedFilterActive ? applyRedFilter() : updateTotalsDOM(outputDivId, isRightTable);
    }
  }
}

// ===================== Alignment Engine =====================
function insertBlankRow(tbody, index, numCols) {
  const tr = document.createElement('tr');
  for (let c = 0; c < numCols; c++) {
    const td = document.createElement('td');
    td.style.height = '20px';
    tr.appendChild(td);
  }
  tbody.insertBefore(tr, tbody.rows[index]);
}

function updatePaymentIDHighlights() {
  const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
  const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');
  const maxLength = Math.max(leftRows.length, rightRows.length);

  for (let index = 0; index < maxLength; index++) {
    const lRow = leftRows[index], rRow = rightRows[index];
    const lCell = lRow?.cells[0], rCell = rRow?.cells[0];
    const lV = lCell?.textContent.trim() || "";
    const rV = rCell?.textContent.trim() || "";

    if (lV !== rV || lV === "" || rV === "") {
      if (lCell) lCell.style.backgroundColor = '#f8d7da'; 
      if (rCell) rCell.style.backgroundColor = '#f8d7da'; 
    } else {
      if (lCell) lCell.style.backgroundColor = '';
      if (rCell) rCell.style.backgroundColor = '';
    }
  }
}

function runAlignmentLogic() {
  const leftTbody = document.querySelector('#outputLeft table tbody');
  const rightTbody = document.querySelector('#outputRight table tbody');
  if (!leftTbody || !rightTbody) return;

  let i = 0;
  while (i < Math.max(leftTbody.rows.length - 1, rightTbody.rows.length - 1)) {
    const lRow = leftTbody.rows[i], rRow = rightTbody.rows[i];
    if (lRow?.classList.contains('totals-row') || rRow?.classList.contains('totals-row')) break;

    const lID = lRow?.cells[0]?.textContent.trim() || "";
    const rID = rRow?.cells[0]?.textContent.trim() || "";

    if (lID === rID && lID !== "") { i++; continue; }

    let fInR = false;
    for (let r = i + 1; r < rightTbody.rows.length - 1; r++) {
      if (rightTbody.rows[r].cells[0].textContent.trim() === lID && lID !== "") { fInR = true; break; }
    }
    let fInL = false;
    for (let l = i + 1; l < leftTbody.rows.length - 1; l++) {
      if (leftTbody.rows[l].cells[0].textContent.trim() === rID && rID !== "") { fInL = true; break; }
    }

    if (fInR) insertBlankRow(leftTbody, i, 6);
    else if (fInL) insertBlankRow(rightTbody, i, 4);
    else i++;
  }

  let lCount = leftTbody.querySelectorAll('tr:not(.totals-row)').length;
  let rCount = rightTbody.querySelectorAll('tr:not(.totals-row)').length;
  while (lCount < rCount) { insertBlankRow(leftTbody, lCount, 6); lCount++; }
  while (rCount < lCount) { insertBlankRow(rightTbody, rCount, 4); rCount++; }

  updatePaymentIDHighlights();
  if (isRedFilterActive) applyRedFilter();
  else {
      updateTotalsDOM('outputLeft', false);
      updateTotalsDOM('outputRight', true);
  }
}

initCSVPanel('csvFileLeft', 'methodCheckboxesLeft', 'outputLeft', 'addRowBtnLeft', 'removeRowBtnLeft', 'undoBtnLeft', false);
initCSVPanel('csvFileRight', 'channelCheckboxesRight', 'outputRight', 'addRowBtnRight', 'removeRowBtnRight', 'undoBtnRight', true);

const lBox = document.getElementById('outputLeft'), rBox = document.getElementById('outputRight');
lBox.onscroll = () => rBox.scrollTop = lBox.scrollTop;
rBox.onscroll = () => lBox.scrollTop = rBox.scrollTop;

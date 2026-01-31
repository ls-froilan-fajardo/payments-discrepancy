// ===================== Global State =====================
let leftTableState = null;
let rightTableState = null;
let isMatchAllActive = true; 
let isRedFilterActive = true;
let isSortByAmountActive = false;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

window.addEventListener('DOMContentLoaded', () => {
    setButtonStates();
});

function setButtonStates() {
    const matchBtn = document.getElementById('matchAllBtn');
    const redBtn = document.getElementById('showRedOnlyBtn');
    const sortBtn = document.getElementById('sortAmountBtn');

    if (matchBtn) {
        matchBtn.style.backgroundColor = isMatchAllActive ? '#16a34a' : '';
        matchBtn.textContent = isMatchAllActive ? 'Alignment: ON' : 'Match All Payment IDs';
    }
    if (redBtn) {
        redBtn.style.backgroundColor = isRedFilterActive ? '#dc2626' : '';
        redBtn.textContent = isRedFilterActive ? 'Showing Red Only' : 'Show Red Highlights Only';
    }
    if (sortBtn) {
        sortBtn.style.backgroundColor = isSortByAmountActive ? '#16a34a' : '';
        sortBtn.textContent = isSortByAmountActive ? 'Amount Sort: ON' : 'Sort by Amount';
    }
}

// ===================== Helpers =====================
function normalizeDate(raw, formatType) {
    if (raw === null || raw === undefined) return '';
    const str = String(raw).trim();
    if (str === '') return '';

    let datePart = str.split(/[\sT]/)[0]; 

    if (datePart.includes('-')) {
        const parts = datePart.split('-');
        if (parts.length === 3) {
            let [y, m, d] = parts;
            if (y.length === 2) y = '20' + y;
            m = m.padStart(2, '0');
            d = d.padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return datePart;
    }

    if (datePart.includes('/')) {
        const parts = datePart.split('/');
        if (parts.length !== 3) return datePart;

        let day, month, year;
        const fmt = formatType || 'DD/MM/YYYY';

        if (fmt.startsWith('DD/MM')) {
            [day, month, year] = parts;
        } else if (fmt.startsWith('MM/DD')) {
            [month, day, year] = parts;
        } else {
            [day, month, year] = parts;
        }

        if (year.length === 2) year = '20' + year;
        
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return datePart;
}

function formatToLongDate(isoDate, shortYear = false) {
    if (!isoDate) return ''; 
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;

    let year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (shortYear && year.length === 4) year = year.slice(-2);

    if (monthIndex >= 0 && monthIndex < 12) {
        return `${MONTH_NAMES[monthIndex]} ${day}, ${year}`;
    }
    return isoDate;
}

function parseMoney(val) {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.\-]/g, ''); 
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

// ===================== Global Logic =====================
function updateGlobalDateFilter() {
    const dateSet = new Set();
    const leftFormat = document.getElementById('leftDateFormat')?.value || 'DD/MM/YYYY';

    const extractDates = (state, format) => {
        if (!state || !state.csvData || !state.headerRow) return;
        const dateIdx = state.headerRow.indexOf("Date");
        if (dateIdx !== -1) {
            state.csvData.forEach(row => {
                if (row[dateIdx]) {
                    const d = normalizeDate(row[dateIdx], format);
                    if (d.split('-').length === 3) dateSet.add(d); 
                }
            });
        }
    };

    extractDates(leftTableState, leftFormat);
    extractDates(rightTableState, 'ISO'); 

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
    const select = document.getElementById('globalDateFilter');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">All Dates</option>';
    
    sortedDates.forEach(isoDate => {
        const opt = document.createElement('option');
        opt.value = isoDate;
        opt.textContent = formatToLongDate(isoDate, true); 
        select.appendChild(opt);
    });

    if (dateSet.has(currentVal)) select.value = currentVal;
}

// ===================== Event Listeners =====================
const setupBtn = (id, callback) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', callback);
};

setupBtn('matchAllBtn', function() {
    isMatchAllActive = !isMatchAllActive;
    setButtonStates();
    refreshBoth();
});

setupBtn('showRedOnlyBtn', function() {
    isRedFilterActive = !isRedFilterActive;
    setButtonStates();
    applyRedFilter();
});

setupBtn('sortAmountBtn', function() {
    isSortByAmountActive = !isSortByAmountActive;
    setButtonStates();
    refreshBoth();
});

setupBtn('resetViewBtn', function() {
    if (confirm("Are you sure you want to clear all data and reset the dashboard?")) {
        const clearVal = (id) => { const el = document.getElementById(id); if (el) el.value = ""; };
        const clearHTML = (id) => { const el = document.getElementById(id); if (el) el.innerHTML = ""; };

        clearVal('csvFileLeft');
        clearVal('csvFileRight');
        clearHTML('outputLeft');
        clearHTML('outputRight');
        clearHTML('methodCheckboxesLeft');
        clearHTML('channelCheckboxesRight');
        
        const dateFilter = document.getElementById('globalDateFilter');
        if (dateFilter) dateFilter.innerHTML = '<option value="">All Dates</option>';
        
        isMatchAllActive = true;
        isRedFilterActive = true;
        isSortByAmountActive = false;
        setButtonStates();
    }
});

const dateEl = document.getElementById('globalDateFilter');
if(dateEl) dateEl.addEventListener('change', refreshBoth);

const leftFormatEl = document.getElementById('leftDateFormat');
if(leftFormatEl) leftFormatEl.addEventListener('change', () => {
    updateGlobalDateFilter(); 
    refreshBoth(); 
});

// ===================== Core Functions =====================
function manualRowAction(isRight, actionType) {
    const state = isRight ? rightTableState : leftTableState;
    if (!state) return;

    if (actionType === 'add') state.handleAddRow();
    else if (actionType === 'delete') state.handleDeleteRow();
    else if (actionType === 'undo') state.handleUndo();

    updatePaymentIDHighlights();
    
    if (isMatchAllActive && !isSortByAmountActive) {
        runAlignmentLogic();
    }
    
    if (isRedFilterActive) {
        applyRedFilter();
    } else {
        updateTotalsDOM('outputLeft', false);
        updateTotalsDOM('outputRight', true);
    }
}

function refreshBoth() {
    if (leftTableState) leftTableState.updateOutput();
    if (rightTableState) rightTableState.updateOutput();
}

function updateTotalsDOM(outputId, isRight) {
    const container = document.getElementById(outputId);
    if (!container) return;
    const tableBody = container.querySelector('tbody');
    if (!tableBody) return;
    
    const totalsRow = tableBody.querySelector('.totals-row');
    const rows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'))
                      .filter(tr => tr.style.display !== 'none');
                      
    if (rows.length === 0) {
        if (totalsRow) totalsRow.innerHTML = '';
        return;
    }

    const numCols = rows[0]?.children.length || (isRight ? 8 : 6);
    const sums = new Array(numCols).fill(0);

    rows.forEach(tr => {
        for (let i = 0; i < numCols; i++) {
            const txt = tr.children[i]?.textContent || "";
            const val = parseMoney(txt);
            if (!isNaN(val)) sums[i] += val;
        }
    });

    if (totalsRow) {
        totalsRow.innerHTML = '';
        for (let i = 0; i < numCols; i++) {
            const td = document.createElement('td');
            if (i === 0) {
                td.textContent = isRedFilterActive ? 'Filtered Total' : 'Total';
            } else if (isRight) {
                // Right Cols: 0:ID, 1:Card, 2:Date, 3:Amount, 4:Tips, 5:Paid, 6:Ref, 7:Sur
                if (i === 1 || i === 2) td.textContent = '';
                else td.textContent = sums[i].toFixed(2);
            } else {
                // Left Cols: 0:ID, 1:Acc, 2:Date, 3:Amount, 4:Tip, 5:Paid
                if (i === 1 || i === 2) td.textContent = '';
                else td.textContent = sums[i].toFixed(2);
            }
            totalsRow.appendChild(td);
        }
    }
}

function applyRedFilter() {
    const leftRows = Array.from(document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)'));
    const rightRows = Array.from(document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)'));
    const redColor = 'rgb(248, 215, 218)';

    leftRows.forEach(row => {
        const isRed = row.cells[0]?.style.backgroundColor === redColor;
        row.style.display = (isRedFilterActive && !isRed) ? 'none' : '';
    });

    rightRows.forEach(row => {
        const isRed = row.cells[0]?.style.backgroundColor === redColor;
        row.style.display = (isRedFilterActive && !isRed) ? 'none' : '';
    });

    updateTotalsDOM('outputLeft', false);
    updateTotalsDOM('outputRight', true);
}

// ===================== CSV Panel Class =====================
class CSVPanel {
    constructor(fileInputId, filterDivId, outputDivId, isRightTable) {
        this.fileInputId = fileInputId;
        this.filterDivId = filterDivId;
        this.outputDivId = outputDivId;
        this.isRightTable = isRightTable;
        this.csvData = [];
        this.headerRow = [];
        this.selectedRows = new Set();
        this.actionHistory = [];
        this.init();
    }

    init() {
        const input = document.getElementById(this.fileInputId);
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => this.parseCSV(event.target.result);
                reader.readAsText(file);
            });
        }
    }

    parseCSV(text) {
        if (!text) return;
        const lines = text.trim().split('\n');
        if (lines.length === 0) return;
        this.headerRow = this.parseCSVLine(lines[0]);
        this.csvData = lines.slice(1).map(line => this.parseCSVLine(line)).filter(r => r.length > 1);
        const methodIdx = this.headerRow.indexOf("Method");
        const channelIdx = this.headerRow.indexOf("Channel");
        this.generateCheckboxes(this.isRightTable ? channelIdx : methodIdx);
        updateGlobalDateFilter();
        this.updateOutput();
    }

    parseCSVLine(line) {
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

    generateCheckboxes(col) {
        const div = document.getElementById(this.filterDivId);
        if (!div || col === -1) return;
        div.innerHTML = '';
        const items = [...new Set(this.csvData.map(r => {
            let v = (r[col] || '').trim();
            return !this.isRightTable ? v.replace(/\s*\(.*?\)\s*/g, '').trim() : v;
        }).filter(v => v !== ''))].sort();
        items.forEach(item => {
            const lbl = document.createElement('label');
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = item;
            cb.addEventListener('change', refreshBoth);
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(' ' + item));
            div.appendChild(lbl);
        });
    }

    handleAddRow() {
        const tableBody = document.querySelector(`#${this.outputDivId} table tbody`);
        if (!tableBody || this.selectedRows.size === 0) return;
        const allRows = Array.from(tableBody.querySelectorAll('tr'));
        let firstIdx = allRows.findIndex(tr => this.selectedRows.has(tr));
        if (firstIdx === -1) firstIdx = 0;
        const addedRows = [];
        const numCols = this.isRightTable ? 8 : 6;
        for (let i = 0; i < this.selectedRows.size; i++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < numCols; c++) {
                const td = document.createElement('td');
                td.innerHTML = '&nbsp;';
                tr.appendChild(td);
            }
            tr.addEventListener('click', (e) => this.toggleRowSelection(tr, e));
            if (tableBody.rows[firstIdx]) tableBody.insertBefore(tr, tableBody.rows[firstIdx]);
            else {
                const totals = tableBody.querySelector('.totals-row');
                if (totals) tableBody.insertBefore(tr, totals);
                else tableBody.appendChild(tr);
            }
            addedRows.push(tr);
        }
        this.actionHistory.push({ type: 'add', rows: addedRows });
    }

    handleDeleteRow() {
        const tableBody = document.querySelector(`#${this.outputDivId} table tbody`);
        if (!tableBody) return;
        const rowsToDelete = Array.from(this.selectedRows).filter(tr => tr.parentNode === tableBody);
        if (rowsToDelete.length === 0) return;
        const removedRowsInfo = [];
        rowsToDelete.forEach(tr => {
            removedRowsInfo.push({ row: tr, nextSibling: tr.nextSibling });
            tableBody.removeChild(tr); 
        });
        this.selectedRows.clear();
        this.actionHistory.push({ type: 'delete', rows: removedRowsInfo });
    }

    handleUndo() {
        const tableBody = document.querySelector(`#${this.outputDivId} table tbody`);
        if (!tableBody || this.actionHistory.length === 0) return;
        const lastAction = this.actionHistory.pop();
        if (lastAction.type === 'add') {
            lastAction.rows.forEach(tr => { if (tr.parentNode === tableBody) tableBody.removeChild(tr); });
        } else if (lastAction.type === 'delete') {
            lastAction.rows.reverse().forEach(obj => {
                const { row, nextSibling } = obj;
                if (nextSibling && nextSibling.parentNode === tableBody) {
                    tableBody.insertBefore(row, nextSibling);
                } else {
                    const totals = tableBody.querySelector('.totals-row');
                    if (totals) tableBody.insertBefore(row, totals);
                    else tableBody.appendChild(row);
                }
            });
        }
    }

    toggleRowSelection(tr, e) {
        if (!e.ctrlKey && !e.metaKey) {
            tr.parentNode.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            this.selectedRows.clear();
        }
        tr.classList.toggle('selected');
        if (tr.classList.contains('selected')) this.selectedRows.add(tr);
        else this.selectedRows.delete(tr);
    }

    updateOutput() {
        this.selectedRows.clear();
        const outputDiv = document.getElementById(this.outputDivId);
        outputDiv.innerHTML = '';
        if (this.csvData.length === 0) return;

        let checked = Array.from(document.querySelectorAll(`#${this.filterDivId} input:checked`)).map(cb => cb.value);
        let rows = [...this.csvData];

        if (checked.length > 0) {
            const colIdx = this.isRightTable ? this.headerRow.indexOf("Channel") : this.headerRow.indexOf("Method");
            if (colIdx !== -1) {
                rows = rows.filter(r => {
                    let v = (r[colIdx] || '').trim();
                    if (!this.isRightTable) v = v.replace(/\s*\(.*?\)\s*/g, '').trim();
                    return checked.includes(v);
                });
            }
        }

        if (this.isRightTable) {
            const sIdx = this.headerRow.indexOf("Status");
            if (sIdx !== -1) rows = rows.filter(r => (r[sIdx] || '').toUpperCase() !== 'FAILED');
        }

        const dateFilterVal = document.getElementById('globalDateFilter')?.value;
        const leftFormat = document.getElementById('leftDateFormat')?.value || 'DD/MM/YYYY';
        const dateIdx = this.headerRow.indexOf("Date");
        
        if (dateFilterVal && dateIdx !== -1) {
            const format = this.isRightTable ? 'ISO' : leftFormat;
            rows = rows.filter(r => {
                const normalized = normalizeDate(r[dateIdx], format);
                return normalized === dateFilterVal;
            });
        }

        const sortFormat = this.isRightTable ? 'ISO' : leftFormat;
        const idColName = this.isRightTable ? 'Payment ID' : 'PaymentRef';
        const idIdx = this.headerRow.indexOf(idColName);
        
        const amountColName = 'Amount';
        let amountIdx = this.headerRow.indexOf(amountColName);

        if (isSortByAmountActive && amountIdx !== -1) {
            if (this.isRightTable) {
                const tipIdx = this.headerRow.indexOf('Gratuity amount');
                rows.sort((a, b) => {
                    const netA = parseMoney(a[amountIdx]) - (tipIdx !== -1 ? parseMoney(a[tipIdx]) : 0);
                    const netB = parseMoney(b[amountIdx]) - (tipIdx !== -1 ? parseMoney(b[tipIdx]) : 0);
                    return netB - netA;
                });
            } else {
                rows.sort((a, b) => {
                    const valA = parseMoney(a[amountIdx]);
                    const valB = parseMoney(b[amountIdx]);
                    return valB - valA;
                });
            }
        } else if (dateIdx !== -1) {
            rows.sort((a, b) => {
                const tA = new Date(normalizeDate(a[dateIdx], sortFormat)).getTime() || 0;
                const tB = new Date(normalizeDate(b[dateIdx], sortFormat)).getTime() || 0;
                if (tA !== tB) return tA - tB;
                
                if (idIdx !== -1) {
                    const idA = (a[idIdx] || '').toLowerCase();
                    const idB = (b[idIdx] || '').toLowerCase();
                    if (idA < idB) return -1;
                    if (idA > idB) return 1;
                }
                return 0;
            });
        }

        const table = document.createElement('table');
        const displayHeaders = this.isRightTable 
            ? ['Payment ID', 'Card last 4', 'Date', 'Amount', 'Tips', 'Paid', 'Refunds', 'Surcharge'] 
            : ['PaymentRef', 'Account', 'Date', 'Amount', 'Tip', 'Paid'];
        
        table.innerHTML = `<thead><tr>${displayHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const tbody = document.createElement('tbody');

        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.addEventListener('click', (e) => this.toggleRowSelection(tr, e));
            displayHeaders.forEach(h => {
                const td = document.createElement('td');
                let lookup = h;
                
                if (this.isRightTable) {
                    if (h === 'Amount') {
                        const amtIdx = this.headerRow.indexOf('Amount');
                        const tipIdx = this.headerRow.indexOf('Gratuity amount');
                        const amtVal = amtIdx !== -1 ? parseMoney(r[amtIdx]) : 0;
                        const tipVal = tipIdx !== -1 ? parseMoney(r[tipIdx]) : 0;
                        td.textContent = (amtVal - tipVal).toFixed(2);
                        tr.appendChild(td);
                        return; 
                    }

                    if (h === 'Paid') {
                        lookup = 'Amount';
                    }

                    if (h === 'Tips') lookup = 'Gratuity amount';
                    if (h === 'Refunds') lookup = 'Refunded amount';
                    if (h === 'Surcharge') lookup = 'Surcharge amount';
                }

                const idx = this.headerRow.indexOf(lookup);
                const moneyFields = ['Amount', 'Tips', 'Paid', 'Refunds', 'Tip', 'Gratuity amount', 'Refunded amount', 'Surcharge amount'];
                
                if (idx !== -1) {
                    let val = r[idx];
                    if (['Date'].includes(h) || ['Date'].includes(lookup)) {
                        const format = this.isRightTable ? 'ISO' : leftFormat;
                        const isoDate = normalizeDate(val, format); 
                        val = formatToLongDate(isoDate, true); 
                    }
                    const isMoney = moneyFields.includes(lookup) || h === 'Paid';
                    td.textContent = isMoney ? parseFloat(val || 0).toFixed(2) : (val || '');
                } else {
                    const isTextField = ['Account', 'Card last 4', 'Payment ID', 'PaymentRef'].includes(h);
                    td.textContent = isTextField ? '' : '0.00';
                    if(isTextField && idx !== -1) td.textContent = r[idx] || '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        const totalsRow = document.createElement('tr');
        totalsRow.classList.add('totals-row');
        tbody.appendChild(totalsRow);
        table.appendChild(tbody);
        outputDiv.appendChild(table);

        if (isMatchAllActive && !isSortByAmountActive && this.isRightTable) {
            setTimeout(runAlignmentLogic, 10);
        } else {
            updatePaymentIDHighlights();
            if (isRedFilterActive) applyRedFilter();
            else updateTotalsDOM(this.outputDivId, this.isRightTable);
        }
    }
}

// ===================== Highlight & Comparison Logic =====================
function updatePaymentIDHighlights() {
    const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
    const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');
    const maxLength = Math.max(leftRows.length, rightRows.length);

    for (let index = 0; index < maxLength; index++) {
        const lRow = leftRows[index];
        const rRow = rightRows[index];
        
        // 1. Payment ID Comparison (Column 0)
        const lCellID = lRow?.cells[0];
        const rCellID = rRow?.cells[0];
        const lID = lCellID?.textContent.trim() || "";
        const rID = rCellID?.textContent.trim() || "";

        if (lID !== rID || lID === "" || rID === "") {
            if (lCellID) lCellID.style.backgroundColor = '#f8d7da'; 
            if (rCellID) rCellID.style.backgroundColor = '#f8d7da'; 
        } else {
            if (lCellID) lCellID.style.backgroundColor = '';
            if (rCellID) rCellID.style.backgroundColor = '';
        }

        // 2. Money Comparison Loop (Columns 3, 4, 5)
        // Col 3: Amount (Left) vs Amount (Right - Net)
        // Col 4: Tip (Left) vs Tips (Right)
        // Col 5: Paid (Left) vs Paid (Right - Total)
        const checkCols = [3, 4, 5];

        checkCols.forEach(colIdx => {
            const lCell = lRow?.cells[colIdx];
            const rCell = rRow?.cells[colIdx];
            
            const lVal = lCell ? parseMoney(lCell.textContent) : 0;
            const rVal = rCell ? parseMoney(rCell.textContent) : 0;

            if (lVal.toFixed(2) !== rVal.toFixed(2)) {
                if (lCell) {
                    lCell.style.color = '#dc2626'; 
                    lCell.style.fontWeight = 'bold';
                }
                if (rCell) {
                    rCell.style.color = '#dc2626'; 
                    rCell.style.fontWeight = 'bold';
                }
            } else {
                if (lCell) { lCell.style.color = ''; lCell.style.fontWeight = ''; }
                if (rCell) { rCell.style.color = ''; rCell.style.fontWeight = ''; }
            }
        });
    }
}

function insertBlankRow(tbody, index, numCols) {
    const tr = document.createElement('tr');
    for (let c = 0; c < numCols; c++) {
        const td = document.createElement('td');
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
    }
    if (tbody.rows[index]) tbody.insertBefore(tr, tbody.rows[index]);
    else {
        const totals = tbody.querySelector('.totals-row');
        if (totals) tbody.insertBefore(tr, totals);
        else tbody.appendChild(tr);
    }
}

function runAlignmentLogic() {
    const leftTbody = document.querySelector('#outputLeft table tbody');
    const rightTbody = document.querySelector('#outputRight table tbody');
    if (!leftTbody || !rightTbody) return;

    let i = 0;
    let safetyCounter = 0;
    const maxIterations = 5000; 

    while (i < Math.max(leftTbody.rows.length - 1, rightTbody.rows.length - 1)) {
        if (safetyCounter++ > maxIterations) {
            console.warn("Alignment safety break triggered");
            break;
        }

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
        else if (fInL) insertBlankRow(rightTbody, i, 8); 
        else i++;
    }

    let lCount = leftTbody.querySelectorAll('tr:not(.totals-row)').length;
    let rCount = rightTbody.querySelectorAll('tr:not(.totals-row)').length;
    while (lCount < rCount) { insertBlankRow(leftTbody, lCount, 6); lCount++; }
    while (rCount < lCount) { insertBlankRow(rightTbody, rCount, 8); rCount++; }

    updatePaymentIDHighlights();
    if (isRedFilterActive) applyRedFilter();
    else {
        updateTotalsDOM('outputLeft', false);
        updateTotalsDOM('outputRight', true);
    }
}

// ================== Initialization ==================
leftTableState = new CSVPanel('csvFileLeft', 'methodCheckboxesLeft', 'outputLeft', false);
rightTableState = new CSVPanel('csvFileRight', 'channelCheckboxesRight', 'outputRight', true);

const bindBtn = (id, right, type) => {
    const b = document.getElementById(id);
    if(b) b.onclick = () => manualRowAction(right, type);
};

bindBtn('addRowBtnLeft', false, 'add');
bindBtn('addRowBtnRight', true, 'add');
bindBtn('removeRowBtnLeft', false, 'delete');
bindBtn('removeRowBtnRight', true, 'delete');
bindBtn('undoBtnLeft', false, 'undo');
bindBtn('undoBtnRight', true, 'undo');

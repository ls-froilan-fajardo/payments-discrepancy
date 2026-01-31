// ===================== Global State =====================
let leftTableState = null;
let rightTableState = null;
let globalActionHistory = []; 
let isMatchAllActive = true; 
let isRedFilterActive = true;
let isSortByAmountActive = false;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setButtonStates();
});

// ===================== Theme Logic =====================
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const storedTheme = localStorage.getItem('theme');
    
    // Default is LIGHT
    if (storedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if(themeBtn) themeBtn.textContent = '☀ Light';
    } else {
        document.body.removeAttribute('data-theme');
        if(themeBtn) themeBtn.textContent = '🌙 Dark';
    }

    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                themeBtn.textContent = '🌙 Dark';
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                themeBtn.textContent = '☀ Light';
                localStorage.setItem('theme', 'dark');
            }
            refreshBoth();
        });
    }
}

function setButtonStates() {
    const matchBtn = document.getElementById('matchAllBtn');
    const redBtn = document.getElementById('showRedOnlyBtn');
    const sortBtn = document.getElementById('sortAmountBtn');

    if (matchBtn) {
        matchBtn.style.backgroundColor = isMatchAllActive ? '#16a34a' : '';
        matchBtn.textContent = isMatchAllActive ? 'Alignment: ON' : 'Match IDs';
    }
    if (redBtn) {
        redBtn.style.backgroundColor = isRedFilterActive ? '#dc2626' : '';
        redBtn.textContent = isRedFilterActive ? 'Red Only' : 'Show Red';
    }
    if (sortBtn) {
        sortBtn.style.backgroundColor = isSortByAmountActive ? '#16a34a' : '';
        sortBtn.textContent = isSortByAmountActive ? 'Amount Sort: ON' : 'Sort Amount';
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
            m = m.padStart(2, '0'); d = d.padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return datePart;
    }
    if (datePart.includes('/')) {
        const parts = datePart.split('/');
        if (parts.length !== 3) return datePart;
        let day, month, year;
        if (formatType.startsWith('DD/MM')) { [day, month, year] = parts; } 
        else if (formatType.startsWith('MM/DD')) { [month, day, year] = parts; } 
        else { [day, month, year] = parts; }
        if (year.length === 2) year = '20' + year;
        day = day.padStart(2, '0'); month = month.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (datePart.includes('.')) {
        const parts = datePart.split('.');
        if (parts.length !== 3) return datePart;
        let day, month, year;
        if (formatType.startsWith('MM.DD')) { [month, day, year] = parts; } 
        else { [day, month, year] = parts; }
        if (year.length === 2) year = '20' + year;
        day = day.padStart(2, '0'); month = month.padStart(2, '0');
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

// ===================== Floating Widget Logic =====================
const widget = document.getElementById('floatingWidget');
const header = document.getElementById('floatingHeader');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

if (header) {
    header.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = widget.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        widget.style.bottom = 'auto'; widget.style.right = 'auto';
        widget.style.left = `${initialLeft}px`; widget.style.top = `${initialTop}px`;
        widget.style.opacity = '0.9';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        widget.style.left = `${initialLeft + dx}px`; widget.style.top = `${initialTop + dy}px`;
    });
    document.addEventListener('mouseup', () => { isDragging = false; widget.style.opacity = '1'; });
}

function updateFloatingStats() {
    const selectedCells = document.querySelectorAll('td.selected-cell');
    let sum = 0; let count = 0;
    selectedCells.forEach(cell => {
        const val = parseMoney(cell.textContent);
        if (!isNaN(val)) sum += val;
        count++;
    });
    const sumEl = document.getElementById('floatSum');
    const countEl = document.getElementById('floatCount');
    if (sumEl) sumEl.textContent = sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (countEl) countEl.textContent = count;
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
    if (confirm("Clear all data and reset?")) {
        if (leftTableState) leftTableState.resetData();
        if (rightTableState) rightTableState.resetData();
        globalActionHistory = [];
        const dateFilter = document.getElementById('globalDateFilter');
        if(dateFilter) dateFilter.innerHTML = '<option value="">All Dates</option>';
        isMatchAllActive = true; 
        isRedFilterActive = true; 
        isSortByAmountActive = false;
        updateFloatingStats();
        setButtonStates();
    }
});

const dateEl = document.getElementById('globalDateFilter');
if(dateEl) dateEl.addEventListener('change', refreshBoth);
const leftFormatEl = document.getElementById('leftDateFormat');
if(leftFormatEl) leftFormatEl.addEventListener('change', () => { updateGlobalDateFilter(); refreshBoth(); });

// Unified Buttons
setupBtn('btnShift', () => performUnifiedAction('add'));
setupBtn('btnRemove', () => performUnifiedAction('delete'));
setupBtn('btnUndo', () => performUnifiedAction('undo'));
setupBtn('btnUndoAll', () => performUnifiedAction('undoAll'));

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); performUnifiedAction('add'); }
    if (e.code === 'Delete') { e.preventDefault(); performUnifiedAction('delete'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); performUnifiedAction('undo'); }
});

// ===================== Core Functions =====================
function performUnifiedAction(actionType) {
    const isLeftActive = leftTableState && leftTableState.selectedRows.size > 0;
    const isRightActive = rightTableState && rightTableState.selectedRows.size > 0;

    // === UNDO ALL LOGIC ===
    if (actionType === 'undoAll') {
        // Loop backwards through all history
        while (globalActionHistory.length > 0) {
            const lastAction = globalActionHistory.pop();
            // Pass false to skip UI update for performance
            if (lastAction.affectedLeft && leftTableState) leftTableState.handleUndo(false);
            if (lastAction.affectedRight && rightTableState) rightTableState.handleUndo(false);
        }
        // Update once at end
        if (leftTableState) leftTableState.updateOutput();
        if (rightTableState) rightTableState.updateOutput();
        updatePostAction();
        return;
    }

    if (actionType === 'undo') {
        if (globalActionHistory.length === 0) return;
        const lastAction = globalActionHistory.pop();
        if (lastAction.affectedLeft && leftTableState) leftTableState.handleUndo(true);
        if (lastAction.affectedRight && rightTableState) rightTableState.handleUndo(true);
        updatePostAction();
        return;
    }

    if (!isLeftActive && !isRightActive) return;

    globalActionHistory.push({
        type: actionType,
        affectedLeft: isLeftActive,
        affectedRight: isRightActive
    });

    if (isLeftActive) {
        if (actionType === 'add') leftTableState.handleAddRow();
        else if (actionType === 'delete') leftTableState.handleDeleteRow();
    }
    if (isRightActive) {
        if (actionType === 'add') rightTableState.handleAddRow();
        else if (actionType === 'delete') rightTableState.handleDeleteRow();
    }

    updatePostAction();
}

function updatePostAction() {
    updatePaymentIDHighlights();
    if (isMatchAllActive && !isSortByAmountActive) { }
    if (isRedFilterActive) applyRedFilter();
    else {
        updateTotalsDOM('outputLeft', false);
        updateTotalsDOM('outputRight', true);
    }
    updateFloatingStats();
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
    const rows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)')).filter(tr => tr.style.display !== 'none');
    
    if (rows.length === 0) { 
        if (totalsRow) totalsRow.innerHTML = ''; 
        return; 
    }

    const numCols = rows[0]?.children.length || (isRight ? 8 : 6);
    const sums = new Array(numCols).fill(0);

    rows.forEach(tr => {
        for (let i = 0; i < numCols; i++) {
            const txt = tr.children[i]?.textContent || "";
            if (txt.trim() === "" || txt === "&nbsp;") continue;
            const val = parseMoney(txt);
            if (!isNaN(val)) sums[i] += val;
        }
    });

    if (totalsRow) {
        totalsRow.innerHTML = '';
        for (let i = 0; i < numCols; i++) {
            const td = document.createElement('td');
            if (i === 0) {
                td.textContent = isRedFilterActive ? 'Filtered' : 'Total';
            } else if (isRight) {
                if (i === 1 || i === 2) td.textContent = '';
                else td.textContent = sums[i].toFixed(2);
            } else {
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
    const redBgVar = 'var(--highlight-red-bg)';
    const filter = (rows) => {
        rows.forEach(row => {
            const isRed = row.cells[0]?.style.backgroundColor.includes('var(--highlight-red-bg)');
            row.style.display = (isRedFilterActive && !isRed) ? 'none' : '';
        });
    };
    filter(leftRows); filter(rightRows);
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

    resetData() {
        this.csvData = [];
        this.headerRow = [];
        this.selectedRows.clear();
        this.actionHistory = [];
        document.getElementById(this.outputDivId).innerHTML = '';
        document.getElementById(this.filterDivId).innerHTML = '';
        const fileInput = document.getElementById(this.fileInputId);
        if(fileInput) fileInput.value = '';
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
            const cb = document.createElement('input'); 
            cb.type = 'checkbox'; 
            cb.value = item;
            cb.checked = false; // Default unchecked
            cb.addEventListener('change', refreshBoth);
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(' ' + item));
            div.appendChild(lbl);
        });
    }

    // === EDIT METHODS ===
    handleAddRow() {
        if (this.selectedRows.size === 0) return;
        
        const selectedTrs = Array.from(this.selectedRows);
        let minIndex = Infinity;
        let targetColIdx = 0; 

        selectedTrs.forEach(tr => {
            const idx = parseInt(tr.dataset.sourceIndex);
            if (!isNaN(idx) && idx < minIndex) {
                minIndex = idx;
                const selCell = tr.querySelector('.selected-cell');
                if (selCell) targetColIdx = selCell.cellIndex;
            }
        });

        if (minIndex === Infinity) return;

        const originalRow = this.csvData[minIndex];
        const ghostRow = [...originalRow]; 
        ghostRow._isBlank = true;

        this.csvData.splice(minIndex, 0, ghostRow);
        this.actionHistory.push({ type: 'add', index: minIndex });
        
        this.updateOutput();
        this.reselectRowBySourceIndex(minIndex + 1, targetColIdx);
    }

    handleDeleteRow() {
        if (this.selectedRows.size === 0) return;
        const selectedTrs = Array.from(this.selectedRows);
        const indices = selectedTrs.map(tr => parseInt(tr.dataset.sourceIndex)).filter(i => !isNaN(i));
        const uniqueIndices = [...new Set(indices)].sort((a, b) => b - a);
        
        const deletedItems = [];
        uniqueIndices.forEach(idx => {
            const deleted = this.csvData.splice(idx, 1);
            deletedItems.push({ index: idx, row: deleted[0] });
        });

        this.actionHistory.push({ type: 'delete', items: deletedItems });
        this.selectedRows.clear();
        this.updateOutput();
    }

    // === MODIFIED: Accepts param to skip UI update for "Undo All" ===
    handleUndo(shouldUpdateUI = true) {
        if (this.actionHistory.length === 0) return;
        const lastAction = this.actionHistory.pop();

        if (lastAction.type === 'add') {
            this.csvData.splice(lastAction.index, 1);
        } else if (lastAction.type === 'delete') {
            lastAction.items.forEach(item => {
                this.csvData.splice(item.index, 0, item.row);
            });
        }
        
        if (shouldUpdateUI) {
            this.updateOutput();
        }
    }

    reselectRowBySourceIndex(idx, colIdx = 0) {
        const tableBody = document.querySelector(`#${this.outputDivId} table tbody`);
        if (!tableBody) return;
        const target = Array.from(tableBody.querySelectorAll('tr')).find(tr => parseInt(tr.dataset.sourceIndex) === idx);
        if (target) {
            const targetCell = target.cells[colIdx] || target.cells[0];
            this.toggleRowSelection(target, { ctrlKey: true, target: targetCell });
        }
    }

    // === SELECTION LOGIC ===
    toggleRowSelection(tr, e) {
        const isMulti = e.ctrlKey || e.metaKey;
        const cell = e.target.closest('td');

        if (!isMulti) {
            if (leftTableState) leftTableState.clearSelectionInternal();
            if (rightTableState) rightTableState.clearSelectionInternal();
        }

        if (cell) {
            if (isMulti && cell.classList.contains('selected-cell')) {
                cell.classList.remove('selected-cell');
            } else {
                cell.classList.add('selected-cell');
            }
        } else {
            tr.cells[0]?.classList.add('selected-cell');
        }

        const hasSelectedCells = tr.querySelector('.selected-cell') !== null;
        if (hasSelectedCells) {
            tr.classList.add('active-row');
            this.selectedRows.add(tr);
        } else {
            tr.classList.remove('active-row');
            this.selectedRows.delete(tr);
        }

        updateFloatingStats();
    }

    clearSelectionInternal() {
        const tableBody = document.querySelector(`#${this.outputDivId} table tbody`);
        if (!tableBody) return;
        const rows = tableBody.querySelectorAll('tr.active-row');
        rows.forEach(r => r.classList.remove('active-row'));
        const cells = tableBody.querySelectorAll('td.selected-cell');
        cells.forEach(c => c.classList.remove('selected-cell'));
        this.selectedRows.clear();
    }

    clearSelection() {
        this.clearSelectionInternal();
        updateFloatingStats();
    }

    updateOutput() {
        this.selectedRows.clear();
        const outputDiv = document.getElementById(this.outputDivId);
        outputDiv.innerHTML = '';
        if (this.csvData.length === 0) return;

        let checked = Array.from(document.querySelectorAll(`#${this.filterDivId} input:checked`)).map(cb => cb.value);
        let rows = this.csvData.map((row, index) => ({ data: row, originalIndex: index }));

        const allCheckboxes = document.querySelectorAll(`#${this.filterDivId} input`);
        if (allCheckboxes.length > 0 && checked.length === 0) {
            rows = [];
        } else if (checked.length > 0) {
            const colIdx = this.isRightTable ? this.headerRow.indexOf("Channel") : this.headerRow.indexOf("Method");
            if (colIdx !== -1) {
                rows = rows.filter(wrapper => {
                    let v = (wrapper.data[colIdx] || '').trim();
                    if (!this.isRightTable) v = v.replace(/\s*\(.*?\)\s*/g, '').trim();
                    return checked.includes(v);
                });
            }
        }

        if (this.isRightTable) {
            const sIdx = this.headerRow.indexOf("Status");
            if (sIdx !== -1) rows = rows.filter(w => (w.data[sIdx] || '').toUpperCase() !== 'FAILED');
        }
        
        const dateFilterVal = document.getElementById('globalDateFilter')?.value;
        const leftFormat = document.getElementById('leftDateFormat')?.value || 'DD/MM/YYYY';
        const dateIdx = this.headerRow.indexOf("Date");
        if (dateFilterVal && dateIdx !== -1) {
            const format = this.isRightTable ? 'ISO' : leftFormat;
            rows = rows.filter(w => normalizeDate(w.data[dateIdx], format) === dateFilterVal);
        }

        const sortFormat = this.isRightTable ? 'ISO' : leftFormat;
        const idColName = this.isRightTable ? 'Payment ID' : 'PaymentRef';
        const idIdx = this.headerRow.indexOf(idColName);
        const paidColName = this.isRightTable ? 'Amount' : 'Paid'; 
        const paidIdx = this.headerRow.indexOf(paidColName);

        if (isSortByAmountActive && paidIdx !== -1) {
            rows.sort((a, b) => {
                const valA = parseMoney(a.data[paidIdx]); const valB = parseMoney(b.data[paidIdx]);
                return valB - valA; 
            });
        } else if (dateIdx !== -1) {
            rows.sort((a, b) => {
                const tA = new Date(normalizeDate(a.data[dateIdx], sortFormat)).getTime() || 0;
                const tB = new Date(normalizeDate(b.data[dateIdx], sortFormat)).getTime() || 0;
                if (tA !== tB) return tA - tB;
                if (idIdx !== -1) {
                    const idA = (a.data[idIdx] || '').toLowerCase(); const idB = (b.data[idIdx] || '').toLowerCase();
                    if (idA < idB) return -1; if (idA > idB) return 1;
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

        rows.forEach(wrapper => {
            const r = wrapper.data; 
            const isBlank = r._isBlank; 
            const tr = document.createElement('tr');
            tr.dataset.sourceIndex = wrapper.originalIndex;
            tr.addEventListener('click', (e) => this.toggleRowSelection(tr, e));
            
            displayHeaders.forEach(h => {
                const td = document.createElement('td');
                if (isBlank) { td.innerHTML = '&nbsp;'; tr.appendChild(td); return; }

                let lookup = h;
                if (this.isRightTable) {
                    if (h === 'Amount') { 
                        const amtIdx = this.headerRow.indexOf('Amount');
                        const tipIdx = this.headerRow.indexOf('Gratuity amount');
                        const amtVal = amtIdx !== -1 ? parseMoney(r[amtIdx]) : 0;
                        const tipVal = tipIdx !== -1 ? parseMoney(r[tipIdx]) : 0;
                        td.textContent = (amtVal - tipVal).toFixed(2); tr.appendChild(td); return; 
                    }
                    if (h === 'Paid') lookup = 'Amount';
                    if (h === 'Tips') lookup = 'Gratuity amount';
                    if (h === 'Refunds') lookup = 'Refunded amount';
                    if (h === 'Surcharge') lookup = 'Surcharge amount';
                }
                const idx = this.headerRow.indexOf(lookup);
                
                if (idx !== -1) {
                    let val = r[idx];
                    if (['Date'].includes(h) || ['Date'].includes(lookup)) {
                        const format = this.isRightTable ? 'ISO' : leftFormat;
                        const isoDate = normalizeDate(val, format); 
                        val = formatToLongDate(isoDate, true); 
                    }
                    const isMoney = ['Amount', 'Tips', 'Paid', 'Refunds', 'Tip', 'Gratuity amount', 'Refunded amount', 'Surcharge amount'].includes(lookup) || h === 'Paid';
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

// ===================== Highlights & Alignment =====================
function updatePaymentIDHighlights() {
    const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
    const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');
    const maxLength = Math.max(leftRows.length, rightRows.length);

    // CSS Vars
    const redBg = 'var(--highlight-red-bg)';
    const redText = 'var(--highlight-red-text)';

    for (let index = 0; index < maxLength; index++) {
        const lRow = leftRows[index]; const rRow = rightRows[index];
        const lCellID = lRow?.cells[0]; const rCellID = rRow?.cells[0];
        const lID = lCellID?.textContent.trim() || ""; const rID = rCellID?.textContent.trim() || "";

        // Only Keep White if BOTH Exist AND Match
        if (lID !== "" && rID !== "" && lID === rID) {
            if (lCellID) lCellID.style.backgroundColor = '';
            if (rCellID) rCellID.style.backgroundColor = '';
        } else {
            if (lCellID) lCellID.style.backgroundColor = redBg; 
            if (rCellID) rCellID.style.backgroundColor = redBg; 
        }

        [3, 4, 5].forEach(colIdx => {
            const lCell = lRow?.cells[colIdx]; const rCell = rRow?.cells[colIdx];
            if (!lCell || !rCell) return;
            const lText = lCell.textContent.trim(); const rText = rCell.textContent.trim();
            
            // Reset styles
            lCell.style.color = ''; lCell.style.fontWeight = '';
            rCell.style.color = ''; rCell.style.fontWeight = '';

            if (lText === '' && rText === '') return;

            const lVal = parseMoney(lText); const rVal = parseMoney(rText);

            if (Math.abs(lVal - rVal) > 0.009) {
                if (lVal < rVal && lCell) { lCell.style.color = redText; lCell.style.fontWeight = 'bold'; } 
                else if (rVal < lVal && rCell) { rCell.style.color = redText; rCell.style.fontWeight = 'bold'; }
            }
        });
    }
}

function insertBlankRow(tbody, index, numCols) {
    const tr = document.createElement('tr');
    for (let c = 0; c < numCols; c++) { const td = document.createElement('td'); td.innerHTML = '&nbsp;'; tr.appendChild(td); }
    if (tbody.rows[index]) tbody.insertBefore(tr, tbody.rows[index]);
    else { const totals = tbody.querySelector('.totals-row'); if (totals) tbody.insertBefore(tr, totals); else tbody.appendChild(tr); }
}

function runAlignmentLogic() {
    const leftTbody = document.querySelector('#outputLeft table tbody');
    const rightTbody = document.querySelector('#outputRight table tbody');
    if (!leftTbody || !rightTbody) return;
    let i = 0; let safetyCounter = 0; const maxIterations = 5000; 

    while (i < Math.max(leftTbody.rows.length - 1, rightTbody.rows.length - 1)) {
        if (safetyCounter++ > maxIterations) break;
        const lRow = leftTbody.rows[i]; const rRow = rightTbody.rows[i];
        if (lRow?.classList.contains('totals-row') || rRow?.classList.contains('totals-row')) break;
        
        const lID = lRow?.cells[0]?.textContent.trim() || ""; 
        const rID = rRow?.cells[0]?.textContent.trim() || "";
        
        if (lID === "" && rID === "") { i++; continue; } 
        if (lID === rID && lID !== "") { i++; continue; }
        
        let fInR = false; for (let r = i + 1; r < rightTbody.rows.length - 1; r++) { if (rightTbody.rows[r].cells[0].textContent.trim() === lID && lID !== "") { fInR = true; break; } }
        let fInL = false; for (let l = i + 1; l < leftTbody.rows.length - 1; l++) { if (leftTbody.rows[l].cells[0].textContent.trim() === rID && rID !== "") { fInL = true; break; } }
        if (fInR) insertBlankRow(leftTbody, i, 6); else if (fInL) insertBlankRow(rightTbody, i, 8); else i++;
    }
    let lCount = leftTbody.querySelectorAll('tr:not(.totals-row)').length;
    let rCount = rightTbody.querySelectorAll('tr:not(.totals-row)').length;
    while (lCount < rCount) { insertBlankRow(leftTbody, lCount, 6); lCount++; }
    while (rCount < lCount) { insertBlankRow(rightTbody, rCount, 8); rCount++; }
    updatePaymentIDHighlights();
    if (isRedFilterActive) applyRedFilter(); else { updateTotalsDOM('outputLeft', false); updateTotalsDOM('outputRight', true); }
}

leftTableState = new CSVPanel('csvFileLeft', 'methodCheckboxesLeft', 'outputLeft', false);
rightTableState = new CSVPanel('csvFileRight', 'channelCheckboxesRight', 'outputRight', true);

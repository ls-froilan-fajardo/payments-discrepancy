// ===================== Global Dynamic Payment ID Highlight =====================
function updatePaymentIDHighlights() {
  const leftRows = document.querySelectorAll('#outputLeft table tbody tr:not(.totals-row)');
  const rightRows = document.querySelectorAll('#outputRight table tbody tr:not(.totals-row)');

  rightRows.forEach((tr, index) => {
    const paymentIDCell = tr.cells[0]; // Payment ID in right table
    const leftPaymentCell = leftRows[index]?.cells[0]; // PaymentRef in left table
    if(paymentIDCell) {
      if(!leftPaymentCell || paymentIDCell.textContent !== leftPaymentCell.textContent) {
        paymentIDCell.style.backgroundColor = '#f8d7da'; // red highlight
      } else {
        paymentIDCell.style.backgroundColor = ''; // remove highlight
      }
    }
  });
}

// ================= CSV Panel Initialization =================
function initCSVPanel(fileInputId, filterDivId, outputDivId, addBtnId, removeBtnId, undoBtnId, sortRadioName, isRightTable=false){
  let csvData = [];
  let headerRow = [];
  let selectedRows = new Set();
  let lastClickedRow = null;
  let actionHistory = [];
  let colMethodIndex, colPaymentIndex, colHIndex, colFIndex, colMIndex;

  document.getElementById(fileInputId).addEventListener('change', function(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file);
  });

  document.querySelectorAll(`input[name="${sortRadioName}"]`).forEach(radio => radio.addEventListener('change', updateOutput));

  // Add row
  document.getElementById(addBtnId).addEventListener('click', function(){
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody || selectedRows.size===0) return;
    const allRows = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'));
    let lastIndex = -1;
    allRows.forEach((tr,i)=>{ if(selectedRows.has(tr)) lastIndex=i; });
    const numRows = selectedRows.size;
    const addedRows = [];
    for(let i=0;i<numRows;i++){
      const tr=document.createElement('tr');
      const numCols = isRightTable ? 4 : 6; // right table has only 4 columns now
      for(let c=0;c<numCols;c++){
        const td=document.createElement('td');
        td.textContent='';
        td.contentEditable=false;
        td.style.height='20px';
        tr.appendChild(td);
      }
      tr.addEventListener('click',(e)=>toggleRowSelection(tr,e));
      if(lastIndex>=0 && lastIndex<tableBody.rows.length-1){
        tableBody.insertBefore(tr, tableBody.rows[lastIndex+1]);
        lastIndex++;
      } else tableBody.appendChild(tr);
      addedRows.push(tr);
    }
    updateTotals();
    updatePaymentIDHighlights(); // <-- dynamic highlight
    actionHistory.push({type:'add', rows:addedRows});
  });

  // Remove row
  document.getElementById(removeBtnId).addEventListener('click', function(){
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody) return;
    const removedRows = [];
    selectedRows.forEach(tr=>{
      if(tr.parentNode){
        removedRows.push({row:tr, nextSibling:tr.nextSibling});
        tr.parentNode.removeChild(tr);
      }
    });
    selectedRows.clear();
    lastClickedRow=null;
    updateTotals();
    updatePaymentIDHighlights(); // <-- dynamic highlight
    if(removedRows.length>0) actionHistory.push({type:'delete', rows:removedRows});
  });

  // Undo
  document.getElementById(undoBtnId).addEventListener('click', function(){
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody || actionHistory.length===0) return;
    const lastAction = actionHistory.pop();
    if(lastAction.type==='add'){
      lastAction.rows.forEach(tr=>{ if(tr.parentNode) tr.parentNode.removeChild(tr); });
    } else if(lastAction.type==='delete'){
      lastAction.rows.forEach(obj=>{
        const {row, nextSibling} = obj;
        if(nextSibling && nextSibling.parentNode) tableBody.insertBefore(row, nextSibling);
        else tableBody.appendChild(row);
      });
    }
    updateTotals();
    updatePaymentIDHighlights(); // <-- dynamic highlight
  });

  function toggleRowSelection(tr,e){
    const allRows = Array.from(tr.parentNode.querySelectorAll('tr:not(.totals-row)'));
    if(e.shiftKey && lastClickedRow){
      const startIndex = allRows.indexOf(lastClickedRow);
      const endIndex = allRows.indexOf(tr);
      const [min,max] = [Math.min(startIndex,endIndex), Math.max(startIndex,endIndex)];
      for(let i=min;i<=max;i++){ allRows[i].classList.add('selected'); selectedRows.add(allRows[i]); }
    } else if(e.ctrlKey || e.metaKey){
      if(selectedRows.has(tr)){ tr.classList.remove('selected'); selectedRows.delete(tr); }
      else { tr.classList.add('selected'); selectedRows.add(tr); }
      lastClickedRow = tr;
    } else {
      selectedRows.forEach(r=>r.classList.remove('selected'));
      selectedRows.clear();
      tr.classList.add('selected');
      selectedRows.add(tr);
      lastClickedRow = tr;
    }
  }

  function parseCSV(text){
    const lines = text.trim().split('\n');
    headerRow = parseCSVLine(lines[0]);
    csvData = lines.slice(1).map(line => parseCSVLine(line));

    colMethodIndex = headerRow.indexOf("Method");
    colPaymentIndex = headerRow.indexOf(isRightTable ? "Payment ID" : "PaymentRef");
    colFIndex = headerRow.indexOf("Date");
    colMIndex = headerRow.indexOf("Amount");
    colHIndex = isRightTable ? headerRow.indexOf("Card last 4") : headerRow.indexOf("Account");

    if(!isRightTable){
      generateMethodCheckboxes();
    } else {
      generateChannelCheckboxes();
    }

    updateOutput();
  }

  function parseCSVLine(line){
    const result=[];
    let current='', inQuotes=false;
    for(let i=0;i<line.length;i++){
      const char=line[i];
      if(char==='"' && line[i-1]!=='\\') inQuotes=!inQuotes;
      else if(char===',' && !inQuotes){ result.push(current); current=''; }
      else current+=char;
    }
    result.push(current);
    return result.map(c=>c.replace(/^"(.*)"$/,'$1'));
  }

  function cleanMethod(method){ return method? method.replace(/\s*\(.*?\)\s*/g,'').trim() : ''; }

  // ===================== Left Table Method Filter =====================
  function generateMethodCheckboxes(){
    const div = document.getElementById(filterDivId);
    div.innerHTML='';
    const methods = [...new Set(csvData.map(r=>cleanMethod(r[colMethodIndex])).filter(m=>m!=''))].sort();
    methods.forEach(method=>{
      const label=document.createElement('label');
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.value=method;
      checkbox.addEventListener('change', updateOutput);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' '+method));
      div.appendChild(label);
    });
  }

  // ===================== Right Table Channel Filter =====================
  function generateChannelCheckboxes(){
    const div = document.getElementById('channelCheckboxesRight');
    div.innerHTML='';
    if(csvData.length===0) return;
    const colChannelIndex = headerRow.indexOf("Channel");
    if(colChannelIndex === -1) return;
    const channels = [...new Set(csvData.map(r=>{
      let val = r[colChannelIndex]?r[colChannelIndex].trim():'Blank';
      return val===''?'Blank':val;
    }))].sort();
    channels.forEach(channel=>{
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type='checkbox';
      checkbox.value = channel;
      checkbox.addEventListener('change', updateOutput);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + channel));
      div.appendChild(label);
    });
  }

  // ===================== Update Output Table =====================
  function updateOutput(){
    selectedRows.clear();
    lastClickedRow=null;
    const outputDiv=document.getElementById(outputDivId);
    outputDiv.innerHTML='';

    let checkedFilters = Array.from(document.querySelectorAll(`#${filterDivId} input:checked`)).map(cb=>cb.value);

    let filteredRows = csvData;

    // Left table method filter
    if(!isRightTable && checkedFilters.length>0){
      filteredRows = csvData.filter(r=>checkedFilters.includes(cleanMethod(r[colMethodIndex])));
    }

    // Right table channel filter
    if(isRightTable && checkedFilters.length>0){
      const colChannelIndex = headerRow.indexOf("Channel");
      filteredRows = filteredRows.filter(r=>{
        let val = r[colChannelIndex]?r[colChannelIndex].trim():'Blank';
        val = val===''?'Blank':val;
        return checkedFilters.includes(val);
      });
    }

    // Remove rows where Status = FAILED
    if(isRightTable){
      const colStatusIndex = headerRow.indexOf("Status");
      if(colStatusIndex !== -1){
        filteredRows = filteredRows.filter(r => (r[colStatusIndex] || '').trim().toUpperCase() !== 'FAILED');
      }
    }

    // Sorting
    const sortOption = document.querySelector(`input[name="${sortRadioName}"]:checked`)?.value || 'date';
    if(sortOption==='amount') filteredRows.sort((a,b)=>parseFloat(b[colMIndex]||0)-parseFloat(a[colMIndex]||0));
    else filteredRows.sort((a,b)=>new Date(a[colFIndex])-new Date(b[colFIndex]));

    // Build table
    const table=document.createElement('table');
    const headers = isRightTable 
      ? ['Payment ID', 'Card last 4', 'Date', 'Amount']
      : ['PaymentRef', 'Account', 'Date','Amount','Tip','Paid'];
    table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody=document.createElement('tbody');

    filteredRows.forEach(r=>{
      const tr=document.createElement('tr');
      tr.addEventListener('click',(e)=>toggleRowSelection(tr,e));
      headers.forEach((h,j)=>{
        const td=document.createElement('td');
        td.contentEditable=false;
        td.style.height='20px';
        if(h==='PaymentRef' || h==='Payment ID') td.textContent = r[colPaymentIndex];
        else if(h==='Account' || h==='Card last 4') td.textContent = r[colHIndex];
        else if(h==='Date') td.textContent = r[colFIndex];
        else if(h==='Amount') td.textContent = colMIndex!==-1 && r[colMIndex] ? parseFloat(r[colMIndex]).toFixed(2) : '0.00';
        else if(!isRightTable){
          const colTipIndex = headerRow.indexOf("Tip");
          const colPaidIndex = headerRow.indexOf("Paid");
          if(h==='Tip') td.textContent = colTipIndex!==-1 && r[colTipIndex] ? parseFloat(r[colTipIndex]).toFixed(2) : '0.00';
          if(h==='Paid') td.textContent = colPaidIndex!==-1 && r[colPaidIndex] ? parseFloat(r[colPaidIndex]).toFixed(2) : '0.00';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const totalsRow=document.createElement('tr');
    totalsRow.classList.add('totals-row');
    updateTotalsRow(totalsRow, tbody, isRightTable);
    tbody.appendChild(totalsRow);

    table.appendChild(tbody);
    outputDiv.appendChild(table);

    updatePaymentIDHighlights(); // <-- dynamic highlight
  }

  // ================= Dynamic Totals ===================
  function updateTotals(){
    const tableBody=document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody) return;
    const totalsRow=tableBody.querySelector('.totals-row');
    if(!totalsRow) return;
    updateTotalsRow(totalsRow, tableBody, isRightTable);
  }

  function updateTotalsRow(totalsRow, tbody, isRightTable=false){
    const rows = Array.from(tbody.querySelectorAll('tr:not(.totals-row)'));
    if(rows.length===0) return;

    const numCols = rows[0].children.length;
    const sums = new Array(numCols).fill(0);

    rows.forEach(tr => {
      for(let i=0; i<numCols; i++){
        const val = parseFloat(tr.children[i]?.textContent);
        if(!isNaN(val)) sums[i] += val;
      }
    });

    totalsRow.innerHTML = '';
    for(let i=0; i<numCols; i++){
      const td = document.createElement('td');
      td.contentEditable = false;
      td.style.height = '20px';

      if(isRightTable && (i === 1 || i === 2)) td.textContent = '';
      else if(!isRightTable && i === 2) td.textContent = '';
      else td.textContent = i === 0 ? 'Total' : (sums[i] ? sums[i].toFixed(2) : '');

      totalsRow.appendChild(td);
    }
  }
}

// ================== Initialize Panels ==================
initCSVPanel('csvFileLeft','methodCheckboxesLeft','outputLeft','addRowBtnLeft','removeRowBtnLeft','undoBtnLeft','sortOptionLeft', false);
initCSVPanel('csvFileRight','channelCheckboxesRight','outputRight','addRowBtnRight','removeRowBtnRight','undoBtnRight','sortOptionRight', true);

// ================= Scroll Sync =================
const leftTableContainer = document.getElementById('outputLeft');
const rightTableContainer = document.getElementById('outputRight');
leftTableContainer.addEventListener('scroll', ()=>{
  rightTableContainer.scrollTop = leftTableContainer.scrollTop;
  rightTableContainer.scrollLeft = leftTableContainer.scrollLeft;
});
rightTableContainer.addEventListener('scroll', ()=>{
  leftTableContainer.scrollTop = rightTableContainer.scrollTop;
  leftTableContainer.scrollLeft = rightTableContainer.scrollLeft;
});

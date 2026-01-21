function initCSVPanel(fileInputId, filterDivId, outputDivId, addBtnId, removeBtnId, undoBtnId, sortRadioName, isChannelFilter=false){
  let csvData = [];
  let headerRow = [];
  let selectedRows = new Set();
  let lastClickedRow = null;
  let actionHistory = [];
  let colMethodIndex, colPaymentIndex, colHIndex, colFIndex, colMIndex, colNIndex, colOIndex, colChannelIndex;

  document.getElementById(fileInputId).addEventListener('change', function(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file);
  });

  document.querySelectorAll(`input[name="${sortRadioName}"]`).forEach(radio => radio.addEventListener('change', updateOutput));

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
      const numCols = 6;
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
    actionHistory.push({type:'add', rows:addedRows});
  });

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
    if(removedRows.length>0) actionHistory.push({type:'delete', rows:removedRows});
  });

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
    colPaymentIndex = headerRow.indexOf(isChannelFilter ? "Payment ID" : "PaymentRef");
    colFIndex = headerRow.indexOf("Date");
    colMIndex = headerRow.indexOf("Amount");
    colNIndex = headerRow.indexOf("Tip");
    colOIndex = headerRow.indexOf("Paid");
    colChannelIndex = headerRow.indexOf("Channel");

    // Column 2: Account (left) or Card last 4 (right)
    colHIndex = isChannelFilter ? headerRow.indexOf("Card last 4") : headerRow.indexOf("Account");

    if(!isChannelFilter) generateCheckboxes();
    else generateChannelCheckboxes();
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

  function generateCheckboxes(){
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

  function generateChannelCheckboxes(){
    const div = document.getElementById(filterDivId);
    div.innerHTML='';
    const channels = [...new Set(csvData.map(r=>{
      let val = r[colChannelIndex]?r[colChannelIndex].trim():'Blank';
      val = val===''?'Blank':val;
      return val;
    }))].sort();
    channels.forEach(channel=>{
      const label=document.createElement('label');
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.value=channel;
      checkbox.addEventListener('change', updateOutput);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' '+channel));
      div.appendChild(label);
    });
  }

  function updateOutput(){
    selectedRows.clear();
    lastClickedRow=null;
    const outputDiv=document.getElementById(outputDivId);
    outputDiv.innerHTML='';

    let checkedFilters = Array.from(document.querySelectorAll(`#${filterDivId} input:checked`)).map(cb=>cb.value);
    if(checkedFilters.length===0){ outputDiv.innerHTML='<i>No selection</i>'; return; }

    let allRows=[];
    if(!isChannelFilter){
      checkedFilters.forEach(method=>{
        const rows = csvData.filter(r=>cleanMethod(r[colMethodIndex])===method);
        const standaloneRows = rows.filter(r=>!r[colPaymentIndex]);
        const nonBlankRows = rows.filter(r=>r[colPaymentIndex]);
        standaloneRows.forEach(r=>{
          allRows.push({paymentRef:'Standalone', colH:r[colHIndex]||'', colF:r[colFIndex]||'', totalM:parseFloat(r[colMIndex])||0, totalN:parseFloat(r[colNIndex])||0, totalO:parseFloat(r[colOIndex])||0});
        });
        const grouped={};
        nonBlankRows.forEach(r=>{
          const key=r[colPaymentIndex]; if(!grouped[key]) grouped[key]=[]; grouped[key].push(r);
        });
        Object.keys(grouped).forEach(paymentRef=>{
          const g=grouped[paymentRef];
          const totalM=g.reduce((s,r)=>s+(parseFloat(r[colMIndex])||0),0);
          const totalN=g.reduce((s,r)=>s+(parseFloat(r[colNIndex])||0),0);
          const totalO=g.reduce((s,r)=>s+(parseFloat(r[colOIndex])||0),0);
          allRows.push({paymentRef, colH:g[0][colHIndex]||'', colF:g[0][colFIndex]||'', totalM,totalN,totalO});
        });
      });
    } else {
      allRows = csvData.filter(r=>{
        let val = r[colChannelIndex]?r[colChannelIndex].trim():'Blank';
        val = val===''?'Blank':val;
        return checkedFilters.includes(val);
      }).map(r=>{
        return {paymentRef:r[colPaymentIndex]||'', colH:r[colHIndex]||'', colF:r[colFIndex]||'', totalM:parseFloat(r[colMIndex])||0, totalN:parseFloat(r[colNIndex])||0, totalO:parseFloat(r[colOIndex])||0};
      });
    }

    const sortOption = document.querySelector(`input[name="${sortRadioName}"]:checked`).value;
    if(sortOption==='amount') allRows.sort((a,b)=>parseFloat(b.totalO)-parseFloat(a.totalO));
    else allRows.sort((a,b)=>new Date(a.colF)-new Date(b.colF));

    const table=document.createElement('table');
    const headers = [isChannelFilter ? 'Payment ID' : 'PaymentRef', isChannelFilter ? 'Card last 4' : 'Account', 'Date','Amount','Tip','Paid'];
    table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody=document.createElement('tbody');

    allRows.forEach(r=>{
      const tr=document.createElement('tr');
      tr.addEventListener('click',(e)=>toggleRowSelection(tr,e));
      headers.forEach(h=>{
        const td=document.createElement('td');
        if(h==='PaymentRef' || h==='Payment ID') td.textContent = r.paymentRef;
        else if(h==='Account' || h==='Card last 4') td.textContent = r.colH;
        else if(h==='Date') td.textContent = r.colF;
        else if(h==='Amount') td.textContent = r.totalM.toFixed(2);
        else if(h==='Tip') td.textContent = r.totalN.toFixed(2);
        else if(h==='Paid') td.textContent = r.totalO.toFixed(2);
        td.contentEditable=false;
        td.style.height='20px';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const totalsRow=document.createElement('tr');
    totalsRow.classList.add('totals-row');
    updateTotalsRow(totalsRow, tbody);
    tbody.appendChild(totalsRow);

    table.appendChild(tbody);
    outputDiv.appendChild(table);
  }

  function updateTotals(){
    const tableBody=document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody) return;
    const totalsRow=tableBody.querySelector('.totals-row');
    if(!totalsRow) return;
    updateTotalsRow(totalsRow, tableBody);
  }

  function updateTotalsRow(totalsRow, tbody){
    const rows=Array.from(tbody.querySelectorAll('tr:not(.totals-row)'));
    const totalM=rows.reduce((s,r)=>s+(parseFloat(r.children[3].textContent)||0),0);
    const totalN=rows.reduce((s,r)=>s+(parseFloat(r.children[4].textContent)||0),0);
    const totalO=rows.reduce((s,r)=>s+(parseFloat(r.children[5].textContent)||0),0);
    totalsRow.innerHTML='';
    const cols = ['Total','', '', totalM.toFixed(2), totalN.toFixed(2), totalO.toFixed(2)];
    cols.forEach(val=>{
      const td=document.createElement('td');
      td.textContent=val;
      td.contentEditable=false;
      td.style.height='20px';
      totalsRow.appendChild(td);
    });
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

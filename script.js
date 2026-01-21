// ================= CSV Panel Initialization =================
function initCSVPanel(fileInputId, filterDivId, outputDivId, addBtnId, removeBtnId, undoBtnId, sortRadioName, isChannelFilter=false){
  let csvData = [];
  let headerRow = [];
  let selectedRows = new Set();
  let lastClickedRow = null;
  let actionHistory = [];
  let colPIndex, colQIndex, colHIndex, colFIndex, colMIndex, colNIndex, colOIndex, colChannelIndex;

  document.getElementById(fileInputId).addEventListener('change', function(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file);
  });

  document.querySelectorAll(`input[name="${sortRadioName}"]`).forEach(radio => radio.addEventListener('change', updateOutput));

  document.getElementById(addBtnId).addEventListener('click', addRows);
  document.getElementById(removeBtnId).addEventListener('click', removeRows);
  document.getElementById(undoBtnId).addEventListener('click', undoAction);

  // ------------------ CSV Parsing ------------------
  function parseCSV(text){
    const lines = text.trim().split('\n');
    headerRow = parseCSVLine(lines[0]);
    csvData = lines.slice(1).map(line => parseCSVLine(line));

    colPIndex = headerRow.indexOf("Method");
    colQIndex = headerRow.indexOf("PaymentRef");
    colHIndex = headerRow.indexOf("Account");
    colFIndex = headerRow.indexOf("Date");
    colMIndex = headerRow.indexOf("Amount");
    colNIndex = headerRow.indexOf("Tip");
    colOIndex = headerRow.indexOf("Paid");
    colChannelIndex = headerRow.indexOf("Channel");

    if(!isChannelFilter) generateCheckboxes();
    else generateChannelCheckboxes();
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

  function parseCustomDate(dateStr){
    if(!dateStr) return null;
    const match=dateStr.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/);
    if(!match) return null;
    const [,dd,mm,yy,hh,min]=match;
    return new Date(2000+parseInt(yy), parseInt(mm)-1, parseInt(dd), parseInt(hh), parseInt(min));
  }

  // ------------------ Checkbox Generators ------------------
  function generateCheckboxes(){
    const div = document.getElementById(filterDivId);
    div.innerHTML='';
    const methods = [...new Set(csvData.map(r=>cleanMethod(r[colPIndex])).filter(m=>m!=''))].sort();
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
      return val===''?'Blank':val;
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

  // ------------------ Table & Filter ------------------
  function updateOutput() {
    selectedRows.clear();
    lastClickedRow = null;
    const outputDiv = document.getElementById(outputDivId);
    outputDiv.innerHTML = '';

    const checkedFilters = Array.from(document.querySelectorAll(`#${filterDivId} input:checked`)).map(cb => cb.value);
    if (checkedFilters.length === 0) {
      outputDiv.innerHTML = '<i>No selection</i>';
      return;
    }

    let allRows = [];
    if (!isChannelFilter) {
      checkedFilters.forEach(method => {
        const rows = csvData.filter(r => cleanMethod(r[colPIndex]) === method);
        const standaloneRows = rows.filter(r => !r[colQIndex]);
        const nonBlankRows = rows.filter(r => r[colQIndex]);

        standaloneRows.forEach(r => allRows.push({
          paymentRef: 'Standalone',
          colH: r[colHIndex] || '',
          colF: r[colFIndex] || '',
          totalM: parseFloat(r[colMIndex]) || 0,
          totalN: parseFloat(r[colNIndex]) || 0,
          totalO: parseFloat(r[colOIndex]) || 0
        }));

        const grouped = {};
        nonBlankRows.forEach(r=>{
          const key=r[colQIndex]; if(!grouped[key]) grouped[key]=[]; grouped[key].push(r);
        });
        Object.keys(grouped).forEach(paymentRef=>{
          const g = grouped[paymentRef];
          allRows.push({
            paymentRef,
            colH: g[0][colHIndex] || '',
            colF: g[0][colFIndex] || '',
            totalM: g.reduce((s,r)=>s+(parseFloat(r[colMIndex])||0),0),
            totalN: g.reduce((s,r)=>s+(parseFloat(r[colNIndex])||0),0),
            totalO: g.reduce((s,r)=>s+(parseFloat(r[colOIndex])||0),0)
          });
        });
      });
    } else {
      allRows = csvData.filter(r=>{
        let val = r[colChannelIndex]?r[colChannelIndex].trim():'Blank';
        val = val===''?'Blank':val;
        return checkedFilters.includes(val);
      }).map(r=>{
        return {
          paymentRef: r[colQIndex]||'',
          colH: r[colHIndex]||'',
          colF: r[colFIndex]||'',
          totalM: parseFloat(r[colMIndex])||0,
          totalN: parseFloat(r[colNIndex])||0,
          totalO: parseFloat(r[colOIndex])||0,
          channel: r[colChannelIndex]||'Blank'
        };
      });
    }

    const sortOption = document.querySelector(`input[name="${sortRadioName}"]:checked`).value;
    if(sortOption==='amount') allRows.sort((a,b)=>parseFloat(b.totalO)-parseFloat(a.totalO));
    else allRows.sort((a,b)=>parseCustomDate(a.colF)-parseCustomDate(b.colF));

    const table=document.createElement('table');
    let headers = ['PaymentRef','Account','Date','Amount','Tip','Paid'];
    if(isChannelFilter) headers.push('Channel');
    table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody=document.createElement('tbody');

    allRows.forEach(r=>{
      const tr=document.createElement('tr');
      tr.addEventListener('click',(e)=>toggleRowSelection(tr,e));
      headers.forEach(h=>{
        const td=document.createElement('td');
        if(!isChannelFilter){
          if(h==='PaymentRef') td.textContent = r.paymentRef;
          else if(h==='Account') td.textContent = r.colH;
          else if(h==='Date') td.textContent = r.colF;
          else if(h==='Amount') td.textContent = r.totalM.toFixed(2);
          else if(h==='Tip') td.textContent = r.totalN.toFixed(2);
          else if(h==='Paid') td.textContent = r.totalO.toFixed(2);
        } else {
          if(h==='PaymentRef') td.textContent = r.paymentRef;
          else if(h==='Account') td.textContent = r.colH;
          else if(h==='Date') td.textContent = r.colF;
          else if(h==='Amount') td.textContent = r.totalM.toFixed(2);
          else if(h==='Tip') td.textContent = r.totalN.toFixed(2);
          else if(h==='Paid') td.textContent = r.totalO.toFixed(2);
          else if(h==='Channel') td.textContent = r.channel;
        }
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

  function addRows(){
    const tableBody = document.querySelector(`#${outputDivId} table tbody`);
    if(!tableBody || selectedRows.size===0) return;
    const allRowsArray = Array.from(tableBody.querySelectorAll('tr:not(.totals-row)'));
    let lastIndex = -1;
    allRowsArray.forEach((tr,i)=>{ if(selectedRows.has(tr)) lastIndex=i; });
    const numRows = selectedRows.size;
    const addedRows = [];
    for(let i=0;i<numRows;i++){
      const tr=document.createElement('tr');
      const numCols = isChannelFilter ? 7 : 6;
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
  }

  function removeRows(){
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
  }

  function undoAction(){
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
    if(isChannelFilter) cols.push('');
    cols.forEach(val=>{
      const td=document.createElement('td');
      td.textContent=val;
      td.contentEditable=false;
      td.style.height='20px';
      totalsRow.appendChild(td);
    });
  }
}

// ------------------ Initialize Panels ------------------
initCSVPanel('csvFileLeft','methodCheckboxesLeft','outputLeft','addRowBtnLeft','removeRowBtnLeft','undoBtnLeft','sortOptionLeft', false);
initCSVPanel('csvFileRight','channelCheckboxesRight','outputRight','addRowBtnRight','removeRowBtnRight','undoBtnRight','sortOptionRight', true);

// ------------------ Synchronized Scroll ------------------
const leftTableContainer = document.getElementById('outputLeft');
const rightTableContainer = document.getElementById('outputRight');

let isSyncingLeftScroll = false;
let isSyncingRightScroll = false;

leftTableContainer.addEventListener('scroll', () => {
  if (!isSyncingLeftScroll) {
    isSyncingRightScroll = true;
    rightTableContainer.scrollTop = leftTableContainer.scrollTop;
  }
  isSyncingLeftScroll = false;
});

rightTableContainer.addEventListener('scroll', () => {
  if (!isSyncingRightScroll) {
    isSyncingLeftScroll = true;
    leftTableContainer.scrollTop = rightTableContainer.scrollTop;
  }
  isSyncingRightScroll = false;
});

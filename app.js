(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const regionNames = {CHINA: 'China mainland', INDIA: 'India', ROW: 'Rest of world'};
  const model = globalThis.EBModel;
  const data = globalThis.EB_DATA;
  const dateFormatter = new Intl.DateTimeFormat('en-US', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  const monthFormatter = new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});
  const shortMonthFormatter = new Intl.DateTimeFormat('en-US', {month: 'short', timeZone: 'UTC'});
  const axisFormatter = new Intl.DateTimeFormat('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'});
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const dateObject = (value) => new Date(`${value}T00:00:00Z`);
  const formatDate = (value) => value === 'currentPD' ? 'Current' : value === 'unauthorized' ? 'Unavailable' : value ? dateFormatter.format(dateObject(value)) : '—';
  const formatMonth = (value) => monthFormatter.format(dateObject(value));
  const formatSpeed = (value) => value == null ? 'Not numeric' : `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)} days / month`;

  function chartCard(chart, result) {
    const isB = chart === 'b';
    let title, wait, kicker;
    kicker = 'ESTIMATED BULLETIN';
    switch (result.status) {
      case 'projected':
        title = formatMonth(result.estimatedBulletin);
        wait = `${result.bulletinSteps} ${result.bulletinSteps === 1 ? 'month' : 'months'} after ${formatMonth(state.latestBulletin)}`;
        if (isB && result.closureAdjusted) kicker = 'ESTIMATE WITH CLOSURE ASSUMPTION';
        break;
      case 'current': title = 'Current'; wait = 'No cutoff-date wait in the latest bulletin'; kicker = 'LATEST STATUS'; break;
      case 'reached': title = 'Already reached'; wait = 'Your date is at or before the latest cutoff'; kicker = 'LATEST STATUS'; break;
      case 'stalled': title = 'No forward pace'; wait = 'Zero net movement in this window'; kicker = 'NO ESTIMATE'; break;
      case 'retrogressing': title = 'Moving backward'; wait = 'Negative net movement in this window'; kicker = 'NO ESTIMATE'; break;
      case 'unavailable': title = 'Unavailable'; wait = 'The latest bulletin is marked U'; kicker = 'LATEST STATUS'; break;
      default: title = 'No estimate'; wait = 'This window cannot produce an estimate'; kicker = 'NO ESTIMATE';
    }
    const reason = ['stalled', 'retrogressing', 'insufficient', 'unavailable'].includes(result.status)
      ? `<p class="result-reason">${escape(result.reason || 'A forward estimate cannot be calculated from this window.')}</p>` : '';
    const adjustment = isB && result.status === 'projected' && result.closureAdjusted
      ? `<p class="closure-detail">Moved from <strong>${escape(formatMonth(result.unadjustedEstimatedBulletin))}</strong> to October under the closure assumption, adding ${result.closureAdjustmentMonths} ${result.closureAdjustmentMonths === 1 ? 'month' : 'months'}.</p>` : '';
    return `<article class="result-card ${chart}" data-chart="${chart}" data-status="${escape(result.status)}" aria-labelledby="chart-${chart}-title">
      <div class="chart-label" id="chart-${chart}-title"><i aria-hidden="true"></i>CHART ${chart.toUpperCase()}</div>
      <p class="chart-name">${isB ? 'Dates for filing' : 'Final action dates'}</p>
      <p class="result-kicker">${kicker}</p><p class="result-value${result.status === 'projected' ? '' : ' state'}">${escape(title)}</p>
      <p class="result-wait">${escape(wait)}</p>
      <dl class="result-stats"><div><dt>Latest cutoff</dt><dd>${escape(formatDate(result.latestCutoff))}</dd></div><div><dt>${state.windowMonths}-month average</dt><dd>${escape(formatSpeed(result.speedDaysPerMonth))}</dd></div><div><dt>Priority-date gap</dt><dd>${result.gapDays == null ? 'Not numeric' : `${result.gapDays.toLocaleString('en-US')} days`}</dd></div></dl>${reason}${adjustment}</article>`;
  }

  function renderHistory(history) {
    $('history-table-caption').textContent = `${state.category} ${regionNames[state.region]} cutoff dates in the selected averaging window`;
    $('history-table').innerHTML = history.map((row) => `<tr><td>${escape(formatMonth(row.bulletin))}</td><td>${escape(formatDate(row.b))}</td><td>${escape(formatDate(row.a))}</td></tr>`).join('');
    const numeric = [];
    for (const row of history) for (const chart of ['a', 'b']) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row[chart] || '')) numeric.push(model.toDay(row[chart]));
    }
    if (!numeric.length) {
      const allCurrent = history.length > 0 && history.every((row) => row.a === 'currentPD' && row.b === 'currentPD');
      $('history-chart').innerHTML = `<div class="chart-empty"><strong>${allCurrent ? 'Current throughout this window' : 'No numeric cutoff dates'}</strong><p>${allCurrent ? 'Both charts are marked C throughout the selected history. There are no numeric dates to average.' : 'Current, unavailable, and missing dates are shown in the table below.'}</p></div>`;
      return;
    }
    const width = 800, height = 220, left = 84, right = 20, top = 14, bottom = 30;
    const low = Math.min(...numeric), high = Math.max(...numeric), pad = Math.max((high - low) * 0.14, 30);
    const min = low - pad, max = high + pad;
    const firstMonth = dateObject(state.windowStart).getUTCFullYear() * 12 + dateObject(state.windowStart).getUTCMonth();
    const x = (bulletin) => {
      const date = dateObject(bulletin);
      return left + ((date.getUTCFullYear() * 12 + date.getUTCMonth() - firstMonth) / state.windowMonths) * (width - left - right);
    };
    const y = (day) => top + ((max - day) / (max - min)) * (height - top - bottom);
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="plot-title plot-description"><title id="plot-title">${escape(state.category)} ${escape(regionNames[state.region])}: Chart A and Chart B cutoff history</title><desc id="plot-description">Cutoff dates for ${history.length} observations across ${state.windowMonths} monthly intervals, ${escape(formatMonth(state.windowStart))} through ${escape(formatMonth(state.windowEnd))}. Missing and nonnumeric values are gaps. Exact values are available in the table below.</desc>`;
    for (let i = 0; i < 4; i++) {
      const day = min + ((max - min) * i / 3), py = y(day);
      svg += `<line class="plot-grid" x1="${left}" x2="${width - right}" y1="${py}" y2="${py}"/><text class="plot-axis" x="${left - 13}" y="${py + 3}" text-anchor="end">${escape(axisFormatter.format(new Date(day * 86400000)))}</text>`;
    }
    const tickCount = Math.min(state.windowMonths, 6);
    const showTickYears = state.windowStart.slice(0, 4) !== state.windowEnd.slice(0, 4);
    for (let tick = 0; tick <= tickCount; tick++) {
      const offset = Math.round(tick * state.windowMonths / tickCount);
      const bulletin = model.shiftMonths(state.windowStart, offset), px = x(bulletin);
      const label = (showTickYears ? axisFormatter : shortMonthFormatter).format(dateObject(bulletin));
      svg += `<text class="plot-axis" x="${px}" y="${height - 6}" text-anchor="middle">${escape(label)}</text>`;
    }
    const byBulletin = new Map(history.map((row) => [row.bulletin, row]));
    for (const chart of ['a', 'b']) {
      let path = '', connected = false, points = '';
      for (let i = 0; i <= state.windowMonths; i++) {
        const bulletin = model.shiftMonths(state.windowStart, i), row = byBulletin.get(bulletin), cutoff = row && row[chart];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff || '')) { connected = false; continue; }
        const px = x(bulletin), py = y(model.toDay(cutoff));
        path += `${connected ? 'L' : 'M'}${px},${py} `;
        points += `<circle class="plot-point ${chart}" cx="${px}" cy="${py}" r="${state.windowMonths > 24 ? 2.5 : 4}"><title>Chart ${chart.toUpperCase()} · ${escape(formatMonth(bulletin))}: ${escape(formatDate(cutoff))}</title></circle>`;
        connected = true;
      }
      svg += `<path class="plot-line ${chart}" d="${path}"/>${points}`;
    }
    $('history-chart').innerHTML = `${svg}</svg>`;
  }

  let state;

  function updateWindowPresets() {
    for (const {months, id} of windowPresets) {
      const start = model.shiftMonths(lastBulletin, -months);
      const active = $('window-start').value === start && $('window-end').value === lastBulletin;
      $(id).setAttribute('aria-pressed', String(active));
    }
  }

  function clearResults(message) {
    $('form-error').textContent = message;
    $('form-error').hidden = false;
    $('result-cards').innerHTML = '';
    $('target-summary').textContent = 'Check your inputs';
    $('history-heading').textContent = 'Selected progression history';
    $('history-chart').innerHTML = '';
    $('history-table').innerHTML = '';
    $('window-label').textContent = 'Check your inputs to continue';
    $('chart-caption').textContent = 'The selected window determines the average speed';
    $('estimate-note').textContent = 'Choose a valid priority date and averaging window to see estimates.';
  }

  function calculate() {
    updateWindowPresets();
    const input = $('priority-date');
    if (!input.checkValidity()) {
      clearResults('Enter a valid priority date to calculate an estimate.');
      return;
    }
    try {
      state = model.estimate({rows: data.rows, category: $('category').value, region: $('region').value, priorityDate: input.value, windowStart: $('window-start').value, windowEnd: $('window-end').value});
      $('form-error').hidden = true;
      $('latest-bulletin').textContent = formatMonth(state.latestBulletin);
      $('window-label').textContent = `${state.windowMonths} ${state.windowMonths === 1 ? 'month' : 'months'} · ${state.history.length} observations`;
      $('target-summary').textContent = `${state.category} · ${regionNames[state.region]} · ${formatDate(state.priorityDate)}`;
      $('result-cards').innerHTML = chartCard('b', state.charts.b) + chartCard('a', state.charts.a);
      $('estimate-note').textContent = `Speed: ${axisFormatter.format(dateObject(state.windowStart))} – ${axisFormatter.format(dateObject(state.windowEnd))}. Waits start at ${formatMonth(state.latestBulletin)}, rounded up to a monthly bulletin.`;
      $('history-heading').textContent = `${state.windowMonths} ${state.windowMonths === 1 ? 'month' : 'months'} of progression`;
      $('chart-caption').textContent = `${state.history.length} observations · ${axisFormatter.format(dateObject(state.windowStart))} – ${axisFormatter.format(dateObject(state.windowEnd))}`;
      renderHistory(state.history);
    } catch (error) {
      clearResults(error.message);
    }
  }
  if (!model || !data || !Array.isArray(data.rows) || !data.rows.length) {
    $('form-error').hidden = false;
    $('form-error').textContent = 'The bundled bulletin data could not be loaded. Keep data/bulletins.js and model.js beside the app when moving the folder.';
    $('latest-bulletin').textContent = 'Data unavailable';
    return;
  }
  const bulletinDates = [...new Set(data.rows.map((row) => row.bulletin))].sort();
  const lastBulletin = bulletinDates[bulletinDates.length - 1];
  const windowPresets = [{months: 6, id: 'reset-window'}, {months: 12, id: 'latest-12-months'}];
  const options = bulletinDates.slice().reverse().map((bulletin) => `<option value="${escape(bulletin)}">${escape(axisFormatter.format(dateObject(bulletin)))}</option>`).join('');
  $('window-start').innerHTML = options;
  $('window-end').innerHTML = options;
  function applyWindowPreset(months) {
    const start = model.shiftMonths(lastBulletin, -months);
    if (!bulletinDates.includes(start)) {
      updateWindowPresets();
      clearResults(`The latest ${months} months are not available in the saved history. Choose a custom start and end bulletin.`);
      return;
    }
    $('window-start').value = start;
    $('window-end').value = lastBulletin;
    // Setting select values does not emit change events, so refresh explicitly.
    calculate();
  }
  $('calculator-form').addEventListener('submit', (event) => {event.preventDefault(); calculate();});
  $('category').addEventListener('change', calculate);
  $('region').addEventListener('change', calculate);
  $('priority-date').addEventListener('change', calculate);
  $('window-start').addEventListener('change', calculate);
  $('window-end').addEventListener('change', calculate);
  for (const {months, id} of windowPresets) $(id).addEventListener('click', () => applyWindowPreset(months));
  applyWindowPreset(6);
}());

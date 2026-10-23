(function () {
  'use strict';

  const storageKey = 'eb-calculator-language';
  const messages = {
    en: {
      documentTitle: 'Employment-Based Priority Date Calculator',
      description: 'Estimate when EB1, EB2, and EB3 Chart A and Chart B reach your priority date using a custom window of saved Visa Bulletin history.',
      pageTitle: 'When could your date be reached?', latestBulletin: 'Latest saved bulletin',
      yourDetails: 'YOUR DETAILS', setTarget: 'Set your target', category: 'Employment category',
      region: 'Chargeability region', china: 'China — mainland', india: 'India', restOfWorld: 'Rest of world',
      priorityDate: 'Priority date', priorityHint: 'A sample date is filled in. Replace it with yours.',
      averagingWindow: 'Averaging window',
      windowHelp: 'Choose the historical period used to calculate each chart’s average progression speed. That speed is then used to estimate when the cutoff date could reach your priority date.',
      startBulletin: 'Start bulletin', endBulletin: 'End bulletin',
      windowHint: 'Both endpoints count. Choose at least one monthly interval.', historyShortcuts: 'Recent history shortcuts',
      latestTwelve: 'Use latest 12 months', latestTwentyFour: 'Use latest 24 months', sharedWindow: 'Both charts use the same history window.',
      estimateResults: 'Estimate results', yourEstimates: 'YOUR ESTIMATES',
      closureTitle: 'Chart B closure assumption',
      closureNote: 'Chart B is assumed closed from May through September. A projected date in these months moves to October of the same year, the start of the next fiscal year. This adjustment applies to future Chart B estimates only.',
      historyEyebrow: 'THE HISTORY BEHIND THE ESTIMATE', chartB: 'Chart B', chartA: 'Chart A',
      verticalAxis: 'Cutoff dates on vertical axis', viewDates: 'View the underlying dates', bulletinMonth: 'Bulletin month',
      methodEyebrow: 'A SIMPLE, VISIBLE ASSUMPTION', methodHeading: 'Your selected pace continues.',
      methodDescription: 'The selected history sets the speed. The latest saved cutoff is always the starting point for your estimate.',
      averageSpeed: 'Average speed', speedFormula: '(Window end cutoff − window start cutoff) ÷ months',
      speedDescription: 'Signed calendar-day movement across the selected window', estimatedWait: 'Estimated wait',
      waitFormula: '(Your date − latest cutoff) ÷ average speed', waitDescription: 'Projected from the latest saved bulletin, rounded up',
      disclaimer: 'A historical extrapolation, not a prediction or a filing / approval determination.', runsLocally: 'Runs locally', noDataSent: 'No data sent'
    },
    'zh-CN': {
      documentTitle: '职业移民优先日期计算器',
      description: '根据自选时段的历史签证公告，估算 EB1、EB2 和 EB3 的表 A、表 B 何时推进至您的优先日期。',
      pageTitle: '何时能到您的优先日期？', latestBulletin: '最新已保存的签证公告',
      yourDetails: '您的信息', setTarget: '设定您的目标', category: '职业移民类别',
      region: '排期所属地区', china: '中国大陆', india: '印度', restOfWorld: '世界其他地区',
      priorityDate: '优先日期', priorityHint: '当前填入的是示例日期，请替换为您的优先日期。',
      averagingWindow: '平均速度计算区间',
      windowHelp: '选择一段历史时期，用于分别计算表 A 和表 B 的平均排期推进速度，再据此估算排期何时能到您的优先日期。',
      startBulletin: '起始公告月份', endBulletin: '结束公告月份',
      windowHint: '计算包含起止月份，两者至少间隔一个月。', historyShortcuts: '近期历史区间快捷选项',
      latestTwelve: '使用最近 12 个月', latestTwentyFour: '使用最近 24 个月', sharedWindow: '表 A 和表 B 使用相同的历史区间。',
      estimateResults: '估算结果', yourEstimates: '您的估算结果',
      closureTitle: '表 B 关闭假设',
      closureNote: '假设表 B 在每年 5 月至 9 月关闭。若预计到达月份在此期间，则顺延至同年 10 月（下一财年开始）。此调整仅适用于表 B 的未来估算。',
      historyEyebrow: '估算所依据的历史数据', chartB: '表 B', chartA: '表 A',
      verticalAxis: '纵轴为排期截止日期', viewDates: '查看原始日期', bulletinMonth: '公告月份',
      methodEyebrow: '简单且明确的假设', methodHeading: '假设所选区间的推进速度持续。',
      methodDescription: '所选历史区间决定平均推进速度，估算始终从最新保存的排期截止日期开始。',
      averageSpeed: '平均推进速度', speedFormula: '（区间结束排期日期 − 区间起始排期日期）÷ 月数',
      speedDescription: '按自然日计算区间内的净推进，倒退计为负值', estimatedWait: '预计等待时间',
      waitFormula: '（您的优先日期 − 最新排期截止日期）÷ 平均推进速度', waitDescription: '从最新保存的公告月份起算，向上取整至整月',
      disclaimer: '本工具仅根据历史数据外推，不构成预测，也不判断递交申请或获批资格。', runsLocally: '本地运行', noDataSent: '不发送数据'
    }
  };

  let locale = 'en';
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(messages, saved)) locale = saved;
  } catch (_) { /* Browser storage may be unavailable when opened as a local file. */ }

  function applyLanguage(nextLocale, notify) {
    if (!Object.hasOwn(messages, nextLocale)) return;
    locale = nextLocale;
    const copy = messages[locale];
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = copy.description;
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const text = copy[node.dataset.i18n];
      if (text !== undefined) node.textContent = text;
    }
    for (const node of document.querySelectorAll('[data-i18n-aria-label]')) {
      const text = copy[node.dataset.i18nAriaLabel];
      if (text !== undefined) node.setAttribute('aria-label', text);
    }
    document.getElementById('language-select').value = locale;
    if (notify) {
      try { localStorage.setItem(storageKey, locale); } catch (_) { /* Language switching still works without storage. */ }
      document.dispatchEvent(new CustomEvent('eb-language-change', {detail: {locale}}));
    }
  }

  globalThis.EBI18n = Object.freeze({getLocale: () => locale});
  document.getElementById('language-select').addEventListener('change', (event) => applyLanguage(event.target.value, true));
  applyLanguage(locale, false);
}());

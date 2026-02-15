(function() {
  'use strict';

  const SUPABASE_URL = 'https://qcnzleiyekbgsiyomwin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbnpsZWl5ZWtiZ3NpeW9td2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Mjk2NzMsImV4cCI6MjA4NDAwNTY3M30.NlGUfxDPzMgtu_J0vX7FMe-ikxafboGh5GMr-tsaLfI';

  const params = new URLSearchParams(window.location.search);
  const APP_LANG = params.get('lang') === 'ja' ? 'ja' : 'en';
  const currencyParam = (params.get('currency') || '').trim().toLowerCase();
  const deviceId = (params.get('device') || '').trim();
  const source = (params.get('source') || 'app').trim();
  const extensionToken = (params.get('ext_token') || '').trim();

  if (extensionToken) {
    params.delete('ext_token');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', clean);
  }

  const I18N = {
    en: {
      title: 'THE TOLL - Pricing',
      subtitle: 'Choose Your Plan',
      headline: 'Build focus and movement into every work session.',
      subcopy: 'Choose a plan and continue to secure Stripe checkout.',
      trialNote: '14-day free trial available for new accounts.',
      secureNote: 'Secure checkout powered by Stripe.',
      currencyChip: 'Billing currency: {currency}',
      yearlyBadge: 'Best Value',
      yearlyLabel: 'Yearly Plan',
      monthlyLabel: 'Monthly Plan',
      yearlySub: 'Equivalent to {value} per month',
      monthlySub: 'Flexible billing. Cancel anytime.',
      yearlyCta: 'Start yearly',
      monthlyCta: 'Start monthly',
      yearlySavePct: 'Save {pct}% vs monthly',
      yearlySaveAmount: 'Save {amount} vs monthly total',
      compareTitle: 'Free vs Pro',
      featureCol: 'Feature',
      freeCol: 'Free',
      proCol: 'Pro',
      compareRows: [
        { feature: 'Blocked sites', free: 'Up to 5', pro: 'Unlimited' },
        { feature: 'Grace period', free: '20 min fixed', pro: 'Custom' },
        { feature: 'Exercise mode', free: 'Squat only', pro: 'Choose exercise' },
        { feature: 'Schedule', free: 'Simple templates', pro: 'Advanced control' },
        { feature: 'Adult block', free: 'Available', pro: 'Available' }
      ],
      trustLines: [
        'Designed for remote workers who need structure.',
        'No hidden fees. Manage subscription anytime.'
      ],
      back: 'Back',
      opening: 'Opening Stripe checkout...',
      preparing: 'Preparing checkout...',
      failed: 'Failed to prepare checkout.',
      needLogin: 'Please log in and link your account first.'
    },
    ja: {
      title: 'THE TOLL - 料金プラン',
      subtitle: 'プランを選択',
      headline: '仕事中の集中力と運動習慣を、同時に作る。',
      subcopy: 'プランを選択すると、Stripeの安全な決済に進みます。',
      trialNote: '新規アカウントは14日間の無料体験を利用できます。',
      secureNote: 'Stripeの安全な決済を利用しています。',
      currencyChip: '請求通貨: {currency}',
      yearlyBadge: 'おすすめ',
      yearlyLabel: '年額プラン',
      monthlyLabel: '月額プラン',
      yearlySub: '月換算 {value}',
      monthlySub: '柔軟な月払い。いつでも解約可能です。',
      yearlyCta: '年額で始める',
      monthlyCta: '月額で始める',
      yearlySavePct: '月額合計より {pct}% お得',
      yearlySaveAmount: '月額合計より {amount} お得',
      compareTitle: 'FREE と PRO の比較',
      featureCol: '機能',
      freeCol: 'FREE',
      proCol: 'PRO',
      compareRows: [
        { feature: 'ブロックサイト数', free: '最大5件', pro: '無制限' },
        { feature: '解放時間', free: '20分固定', pro: '自由設定' },
        { feature: '運動モード', free: 'スクワット固定', pro: '種目選択可' },
        { feature: 'スケジュール', free: '簡易テンプレ', pro: '詳細設定' },
        { feature: 'アダルトブロック', free: '利用可', pro: '利用可' }
      ],
      trustLines: [
        '在宅ワーカー向けに、続けやすさを重視して設計。',
        '隠れた手数料なし。いつでもサブスク管理可能。'
      ],
      back: '戻る',
      opening: 'Stripe決済画面を開いています...',
      preparing: '決済を準備しています...',
      failed: '決済の準備に失敗しました。',
      needLogin: '先にログインとデバイス連携を行ってください。'
    }
  };

  const PRICE_BOOK = {
    usd: { monthly: 4.99, yearly: 39.99, currency: 'USD' },
    jpy: { monthly: 500, yearly: 5980, currency: 'JPY' }
  };

  const el = {
    subtitle: document.getElementById('subtitle'),
    headline: document.getElementById('headline'),
    subcopy: document.getElementById('subcopy'),
    trialNote: document.getElementById('trial-note'),
    secureNote: document.getElementById('secure-note'),
    currencyChip: document.getElementById('currency-chip'),
    yearlyBtn: document.getElementById('yearly-btn'),
    monthlyBtn: document.getElementById('monthly-btn'),
    yearlyBadge: document.getElementById('yearly-badge'),
    yearlyLabel: document.getElementById('yearly-label'),
    monthlyLabel: document.getElementById('monthly-label'),
    yearlyPrice: document.getElementById('yearly-price'),
    monthlyPrice: document.getElementById('monthly-price'),
    yearlySub: document.getElementById('yearly-sub'),
    monthlySub: document.getElementById('monthly-sub'),
    yearlySave: document.getElementById('yearly-save'),
    yearlyCta: document.getElementById('yearly-cta'),
    monthlyCta: document.getElementById('monthly-cta'),
    compareTitle: document.getElementById('compare-title'),
    featureColTitle: document.getElementById('feature-col-title'),
    freeColTitle: document.getElementById('free-col-title'),
    proColTitle: document.getElementById('pro-col-title'),
    compareBody: document.getElementById('compare-body'),
    trustRow: document.getElementById('trust-row'),
    status: document.getElementById('status-msg'),
    backBtn: document.getElementById('back-btn')
  };

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function t(key, params = {}) {
    let template = (I18N[APP_LANG] && I18N[APP_LANG][key]) || I18N.en[key] || key;
    if (typeof template !== 'string') return template;
    Object.entries(params).forEach(([k, v]) => {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return template;
  }

  function detectCurrencyHint() {
    if (currencyParam === 'jpy' || currencyParam === 'usd') return currencyParam;
    const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
    const firstLocale = (langs[0] || navigator.language || '').toLowerCase();
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const isJapan = firstLocale.includes('ja') || firstLocale.includes('-jp') || tz === 'asia/tokyo';
    return isJapan ? 'jpy' : 'usd';
  }

  function formatMoney(amount, currency) {
    const locale = APP_LANG === 'ja' ? 'ja-JP' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount);
  }

  function formatPerMonth(monthly, yearly, currency) {
    const perMonth = yearly / 12;
    const raw = formatMoney(perMonth, currency);
    return currency === 'JPY' ? raw.replace('.00', '') : raw;
  }

  function getSaveText(pricing) {
    const monthlyTotal = pricing.monthly * 12;
    const saved = Math.max(0, monthlyTotal - pricing.yearly);
    const pct = monthlyTotal > 0 ? Math.floor((saved / monthlyTotal) * 100) : 0;
    if (pct >= 5) {
      return t('yearlySavePct', { pct });
    }
    return t('yearlySaveAmount', { amount: formatMoney(saved, pricing.currency) });
  }

  function renderComparison() {
    const rows = t('compareRows');
    if (!el.compareBody || !Array.isArray(rows)) return;
    el.compareBody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const tdFeature = document.createElement('td');
      const tdFree = document.createElement('td');
      const tdPro = document.createElement('td');
      tdFeature.textContent = row.feature;
      tdFree.textContent = row.free;
      tdPro.textContent = row.pro;
      tr.appendChild(tdFeature);
      tr.appendChild(tdFree);
      tr.appendChild(tdPro);
      el.compareBody.appendChild(tr);
    });
  }

  function renderTrust() {
    const lines = t('trustLines');
    if (!el.trustRow || !Array.isArray(lines)) return;
    el.trustRow.innerHTML = '';
    lines.forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      el.trustRow.appendChild(p);
    });
  }

  function applyTextAndPrice() {
    const currencyKey = detectCurrencyHint();
    const pricing = PRICE_BOOK[currencyKey] || PRICE_BOOK.usd;

    document.documentElement.lang = APP_LANG;
    document.title = t('title');
    el.subtitle.textContent = t('subtitle');
    el.headline.textContent = t('headline');
    el.subcopy.textContent = t('subcopy');
    el.trialNote.textContent = t('trialNote');
    el.secureNote.textContent = t('secureNote');
    el.currencyChip.textContent = t('currencyChip', { currency: pricing.currency });

    el.yearlyBadge.textContent = t('yearlyBadge');
    el.yearlyLabel.textContent = t('yearlyLabel');
    el.monthlyLabel.textContent = t('monthlyLabel');

    const yearlyPriceText = `${formatMoney(pricing.yearly, pricing.currency)} / ${APP_LANG === 'ja' ? '年' : 'year'}`;
    const monthlyPriceText = `${formatMoney(pricing.monthly, pricing.currency)} / ${APP_LANG === 'ja' ? '月' : 'month'}`;
    el.yearlyPrice.textContent = yearlyPriceText;
    el.monthlyPrice.textContent = monthlyPriceText;

    const perMonthText = formatPerMonth(pricing.monthly, pricing.yearly, pricing.currency);
    el.yearlySub.textContent = t('yearlySub', { value: perMonthText });
    el.monthlySub.textContent = t('monthlySub');
    el.yearlySave.textContent = getSaveText(pricing);

    el.yearlyCta.textContent = t('yearlyCta');
    el.monthlyCta.textContent = t('monthlyCta');

    el.compareTitle.textContent = t('compareTitle');
    el.featureColTitle.textContent = t('featureCol');
    el.freeColTitle.textContent = t('freeCol');
    el.proColTitle.textContent = t('proCol');
    renderComparison();
    renderTrust();

    el.backBtn.textContent = t('back');
  }

  function setStatus(msg) {
    el.status.textContent = msg || '';
  }

  function setLoading(loading) {
    el.monthlyBtn.disabled = loading;
    el.yearlyBtn.disabled = loading;
    el.backBtn.disabled = loading;
  }

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token || null;
    if (!accessToken) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      accessToken = refreshed?.session?.access_token || null;
    }
    return accessToken;
  }

  async function startCheckout(plan) {
    setLoading(true);
    setStatus(t('preparing'));
    try {
      const currency = detectCurrencyHint();
      const accessToken = extensionToken || await getAccessToken();

      const endpoint = accessToken ? 'create-checkout' : 'create-checkout-device';
      const headers = accessToken
        ? {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          }
        : {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          };

      const body = accessToken
        ? { plan, lang: APP_LANG, source, device_id: deviceId || null, currency }
        : { device_id: deviceId, plan, lang: APP_LANG, source, currency };

      if (!accessToken && !deviceId) {
        setStatus(t('needLogin'));
        setLoading(false);
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.url) {
        const detail = payload?.error || `HTTP ${res.status}`;
        setStatus(`${t('failed')} ${detail}`);
        setLoading(false);
        return;
      }

      setStatus(t('opening'));
      window.location.href = payload.url;
    } catch (e) {
      setStatus(`${t('failed')} ${e?.message || e}`);
      setLoading(false);
    }
  }

  function backToApp() {
    if (source === 'extension') {
      window.close();
      return;
    }
    const qs = new URLSearchParams();
    qs.set('lang', APP_LANG);
    if (deviceId) qs.set('device', deviceId);
    window.location.href = `/${qs.toString() ? `?${qs.toString()}` : ''}`;
  }

  applyTextAndPrice();
  el.monthlyBtn.addEventListener('click', () => startCheckout('monthly'));
  el.yearlyBtn.addEventListener('click', () => startCheckout('yearly'));
  el.backBtn.addEventListener('click', backToApp);
})();

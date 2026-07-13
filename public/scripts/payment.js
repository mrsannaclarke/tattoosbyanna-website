const form = document.querySelector('#payment-form');
const amountInput = document.querySelector('#amount');
const tipInput = document.querySelector('#tip');
const tipWrap = document.querySelector('#tip-input-wrap');
const tipPrefix = document.querySelector('#tip-prefix');
const tipSuffix = document.querySelector('#tip-suffix');
const tipButtons = [...document.querySelectorAll('[data-tip-mode]')];
const clearTipButton = document.querySelector('#clear-tip');
const totalOutput = document.querySelector('#total');
const errorOutput = document.querySelector('#form-error');
const submitButton = document.querySelector('#submit-button');
const calcInputs = [document.querySelector('#calc-first'), document.querySelector('#calc-second')];
const calcOperation = document.querySelector('#calc-operation');
const calcResult = document.querySelector('#calc-result');

let tipMode = null;

const parseMoney = (value) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned || !/^\d*(?:\.\d{0,2})?$/.test(cleaned)) return 0;
  return Math.round(Number(cleaned) * 100);
};

const formatCurrency = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(cents / 100);

const getTipCents = () => {
  if (!tipMode || !tipInput.value.trim()) return 0;
  if (tipMode === 'amount') return parseMoney(tipInput.value);
  const percentage = Number(tipInput.value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(percentage) || percentage < 0) return 0;
  return Math.round(parseMoney(amountInput.value) * percentage / 100);
};

const updateTotal = () => {
  totalOutput.textContent = formatCurrency(parseMoney(amountInput.value) + getTipCents());
};

const selectTipMode = (mode) => {
  tipMode = mode;
  tipInput.value = '';
  tipWrap.hidden = false;
  clearTipButton.hidden = false;
  tipPrefix.textContent = mode === 'amount' ? '$' : '';
  tipSuffix.textContent = mode === 'percentage' ? '%' : '';
  tipInput.placeholder = mode === 'amount' ? '0.00' : '0';
  tipInput.setAttribute('aria-label', mode === 'amount' ? 'Optional tip in dollars' : 'Optional tip percentage');
  tipButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tipMode === mode)));
  updateTotal();
  tipInput.focus();
};

tipButtons.forEach((button) => button.addEventListener('click', () => selectTipMode(button.dataset.tipMode)));
clearTipButton.addEventListener('click', () => {
  tipMode = null;
  tipInput.value = '';
  tipWrap.hidden = true;
  clearTipButton.hidden = true;
  tipButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  updateTotal();
});

[amountInput, tipInput].forEach((input) => input.addEventListener('input', updateTotal));

const updateCalculator = () => {
  const first = Number(calcInputs[0].value.replace(/[^0-9.-]/g, ''));
  const second = Number(calcInputs[1].value.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    calcResult.value = '0';
    return;
  }
  const operations = {
    multiply: () => first * second,
    divide: () => second === 0 ? null : first / second,
    add: () => first + second,
    subtract: () => first - second,
  };
  const result = operations[calcOperation.value]();
  calcResult.value = result === null || !Number.isFinite(result) ? '—' : Number(result.toFixed(2)).toLocaleString();
};

[...calcInputs, calcOperation].forEach((control) => control.addEventListener('input', updateCalculator));

const getApiPath = () => {
  const isLocalFrontend = ['localhost', '127.0.0.1'].includes(location.hostname);
  return isLocalFrontend
    ? 'http://127.0.0.1:8787/.netlify/functions/create-checkout-session'
    : '/.netlify/functions/create-checkout-session';
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorOutput.hidden = true;

  const name = document.querySelector('#name').value.trim();
  const email = document.querySelector('#email').value.trim();
  const amountCents = parseMoney(amountInput.value);
  const tipCents = getTipCents();

  if (!name || !email || !form.checkValidity()) {
    form.reportValidity();
    return;
  }
  if (amountCents < 100) {
    errorOutput.textContent = 'Please enter a payment amount of at least $1.00.';
    errorOutput.hidden = false;
    amountInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Opening secure payment…';

  try {
    const response = await fetch(getApiPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, amountCents, tipCents, tipMode }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start payment.');
    window.location.assign(data.url);
  } catch (error) {
    errorOutput.textContent = error.message || 'Unable to start payment. Please try again.';
    errorOutput.hidden = false;
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Continue to secure payment';
  }
});

updateTotal();

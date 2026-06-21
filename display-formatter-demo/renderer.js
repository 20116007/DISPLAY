const valueInput = document.getElementById('valueInput');
const formatSelect = document.getElementById('formatSelect');
const errorOutput = document.getElementById('errorOutput');

let rawValue = 1234.5678;

async function initFormatDropdown() {
  const patterns = await window.formatterApi.getFormatPatterns();

  formatSelect.innerHTML = '';
  patterns.forEach((pattern) => {
    const option = document.createElement('option');
    option.value = pattern;
    option.textContent = pattern;
    formatSelect.appendChild(option);
  });

  const defaultPattern = '####.###';
  formatSelect.value = patterns.includes(defaultPattern)
    ? defaultPattern
    : patterns[0];
}

function parseInputValue(text) {
  const trimmed = String(text).trim();
  if (trimmed === '') {
    return { valid: false, empty: true };
  }

  const numericValue = Number(trimmed);
  if (Number.isNaN(numericValue)) {
    return { valid: false, empty: false };
  }

  return { valid: true, value: numericValue, empty: false };
}

async function applyFormatToValueBox() {
  const result = await window.formatterApi.formatValue(
    rawValue,
    formatSelect.value,
  );

  if (result.error) {
    errorOutput.hidden = false;
    errorOutput.textContent = result.error;
    return;
  }

  errorOutput.hidden = true;
  errorOutput.textContent = '';
  valueInput.value = result.formatted;
}

function onValueInput() {
  const parsed = parseInputValue(valueInput.value);

  if (parsed.empty) {
    errorOutput.hidden = true;
    errorOutput.textContent = '';
    return;
  }

  if (!parsed.valid) {
    errorOutput.hidden = false;
    errorOutput.textContent = 'Please enter a valid number.';
    return;
  }

  rawValue = parsed.value;
  errorOutput.hidden = true;
  errorOutput.textContent = '';
}

valueInput.addEventListener('input', onValueInput);
formatSelect.addEventListener('change', applyFormatToValueBox);

initFormatDropdown().then(applyFormatToValueBox);

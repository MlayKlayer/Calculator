const display = document.getElementById("calc-display");
const buttons = document.querySelectorAll(".button-grid .btn");
const tipButton = document.querySelector(".btn-tip");

const tipOverlay = document.getElementById("tip-overlay");
const tipClose = document.getElementById("tip-close");
const baseAmountInput = document.getElementById("base-amount");
const peopleCount = document.getElementById("people-count");
const stepperButtons = document.querySelectorAll(".stepper-btn");
const tipChips = document.querySelectorAll(".chip");
const customTipInput = document.getElementById("custom-tip");
const roundToggle = document.getElementById("round-per-person");
const roundingNote = document.getElementById("rounding-note");

const perPersonOutput = document.getElementById("per-person");
const tipTotalOutput = document.getElementById("tip-total");
const totalAmountOutput = document.getElementById("total-amount");
const priceInput = document.getElementById("product-price");
const paidInput = document.getElementById("paid-amount");
const paidSecondaryInput = document.getElementById("paid-amount-secondary");
const useCalcButton = document.getElementById("use-calc");
const splitToggle = document.getElementById("split-toggle");
const splitFields = document.getElementById("split-fields");
const changeLabel = document.getElementById("change-label");
const changeValue = document.getElementById("change-value");
const paidTotalOutput = document.getElementById("paid-total");
const priceTotalOutput = document.getElementById("price-total");
const changeHint = document.getElementById("change-hint");
const paidInputRow = paidInput.closest(".input-row");
const installHint = document.getElementById("install-hint");
const installHintDismiss = document.getElementById("install-hint-dismiss");

let displayValue = "0";
let storedValue = null;
let pendingOperator = null;
let resetDisplay = false;
let hasError = false;

let people = 1;
let tipPercent = 10;
let roundPerPerson = false;
let tipCustomPercentEnabled = false;
const FX_RATE = 1.95583;
const changeState = {
  priceCurrency: "EUR",
  paidCurrency: "EUR",
  outputCurrency: "EUR",
  splitEnabled: false,
  paidManual: false,
};

const PREFS_KEY = "mincalc.prefs.v1";
const INSTALL_HINT_KEY = "mincalc.installHintDismissed.v1";
let deferredInstallPrompt = null;

const safeStorage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      return null;
    }
    return true;
  },
};

const operators = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => (b === 0 ? null : a / b),
};

const formatNumber = (value) => {
  if (hasError) return "Error";
  if (value.length > 12) return parseFloat(value).toPrecision(8);
  return value;
};

const parseMoney = (raw) => {
  if (raw === null || raw === undefined) return 0;
  let value = String(raw).trim();
  if (!value) return 0;
  value = value.replace(/\s+/g, "");
  value = value.replace(/,/g, ".");
  value = value.replace(/[^0-9.]/g, "");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value =
      value.slice(0, firstDot + 1) +
      value.slice(firstDot + 1).replace(/\./g, "");
  }
  if (value.endsWith(".")) value = value.slice(0, -1);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeNumberString = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const noSpaces = trimmed.replace(/\s+/g, "");
  let result = "";
  let separator = null;
  for (const char of noSpaces) {
    if (/\d/.test(char)) {
      result += char;
      continue;
    }
    if ((char === "," || char === ".") && !separator) {
      separator = char;
      result += char;
    }
  }
  return result;
};

const parseLocaleNumber = (value) => {
  const normalized = normalizeNumberString(value);
  if (!normalized) return Number.NaN;
  const dotted = normalized.replace(",", ".");
  const parsed = Number.parseFloat(dotted);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const sanitizeMoneyInputValue = (value, cursorPosition) => {
  let result = "";
  let separator = null;
  let newCursor = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const isDigit = /\d/.test(char);
    const isSeparator = char === "," || char === ".";
    const keep = isDigit || (isSeparator && !separator);
    if (keep) {
      if (isSeparator && !separator) {
        separator = char;
      }
      result += char;
    }
    if (index < cursorPosition && keep) {
      newCursor += 1;
    }
  }
  return { value: result, cursor: newCursor };
};

const sanitizeMoneyInput = (input) => {
  const cursorPosition =
    input.selectionStart === null ? input.value.length : input.selectionStart;
  const sanitized = sanitizeMoneyInputValue(input.value, cursorPosition);
  if (sanitized.value === input.value) return;
  input.value = sanitized.value;
  if (input.selectionStart !== null) {
    input.setSelectionRange(sanitized.cursor, sanitized.cursor);
  }
};

const sanitizeNumberInputValue = (value, cursorPosition) => {
  let result = "";
  let separator = null;
  let newCursor = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const isDigit = /\d/.test(char);
    const isSeparator = char === "," || char === ".";
    const keep = isDigit || (isSeparator && !separator);
    if (keep) {
      if (isSeparator && !separator) {
        separator = char;
      }
      result += char;
    }
    if (index < cursorPosition && keep) {
      newCursor += 1;
    }
  }
  return { value: result, cursor: newCursor };
};

const sanitizeNumericInput = (input) => {
  const cursorPosition =
    input.selectionStart === null ? input.value.length : input.selectionStart;
  const sanitized = sanitizeNumberInputValue(input.value, cursorPosition);
  if (sanitized.value === input.value) return;
  input.value = sanitized.value;
  if (input.selectionStart !== null) {
    input.setSelectionRange(sanitized.cursor, sanitized.cursor);
  }
};

function getCalcValue() {
  if (hasError) return 0;
  const value = parseFloat(displayValue);
  return Number.isNaN(value) ? 0 : value;
}

const updateDisplay = () => {
  display.textContent = formatNumber(displayValue);
  tipButton.disabled = hasError;
};

const clampNumber = (value, min, max, fallback) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const normalizeCurrency = (value, fallback) => {
  if (value === "EUR" || value === "BGN") return value;
  return fallback;
};

const readPrefs = () => {
  const raw = safeStorage.get(PREFS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

const writePrefs = () => {
  const prefs = {
    changeOutputCurrency: changeState.outputCurrency,
    priceCurrency: changeState.priceCurrency,
    paidCurrency: changeState.paidCurrency,
    splitPaymentEnabled: changeState.splitEnabled,
    tipPeople: people,
    tipPercent: tipPercent,
    tipRoundPerPerson: roundPerPerson,
    tipCustomPercentEnabled: tipCustomPercentEnabled,
  };
  safeStorage.set(PREFS_KEY, JSON.stringify(prefs));
};

const clearAll = () => {
  displayValue = "0";
  storedValue = null;
  pendingOperator = null;
  resetDisplay = false;
  hasError = false;
  updateDisplay();
};

const clearEntry = () => {
  displayValue = "0";
  resetDisplay = false;
  hasError = false;
  updateDisplay();
};

const handleNumber = (num) => {
  if (hasError) return;
  if (resetDisplay) {
    displayValue = num === "." ? "0." : num;
    resetDisplay = false;
    updateDisplay();
    return;
  }

  if (num === "." && displayValue.includes(".")) return;
  if (displayValue === "0" && num !== ".") {
    displayValue = num;
  } else {
    displayValue += num;
  }
  updateDisplay();
};

const handleOperator = (operator) => {
  if (hasError) return;

  const current = parseFloat(displayValue);
  if (storedValue === null) {
    storedValue = current;
  } else if (!resetDisplay) {
    const result = operators[pendingOperator]?.(storedValue, current);
    if (result === null) {
      triggerError();
      return;
    }
    storedValue = result;
    displayValue = String(result);
  }

  pendingOperator = operator;
  resetDisplay = true;
  updateDisplay();
};

const handleEquals = () => {
  if (hasError || pendingOperator === null) return;
  const current = parseFloat(displayValue);
  const result = operators[pendingOperator]?.(storedValue ?? 0, current);
  if (result === null) {
    triggerError();
    return;
  }
  displayValue = String(result);
  storedValue = null;
  pendingOperator = null;
  resetDisplay = true;
  updateDisplay();
};

const handleBackspace = () => {
  if (hasError) return;
  if (resetDisplay) {
    displayValue = "0";
    resetDisplay = false;
    updateDisplay();
    return;
  }
  displayValue = displayValue.length > 1 ? displayValue.slice(0, -1) : "0";
  updateDisplay();
};

const triggerError = () => {
  displayValue = "Error";
  hasError = true;
  storedValue = null;
  pendingOperator = null;
  resetDisplay = false;
  updateDisplay();
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.number !== undefined) {
      handleNumber(button.dataset.number);
      return;
    }

    if (button.dataset.operator) {
      handleOperator(button.dataset.operator);
      return;
    }

    const action = button.dataset.action;
    if (action === "ac") clearAll();
    if (action === "clear") clearEntry();
    if (action === "backspace") handleBackspace();
    if (action === "equals") handleEquals();
    if (action === "tip" && !hasError) openTipModal();
  });
});

tipButton.addEventListener("click", () => {
  if (!hasError) openTipModal();
});

const parseBaseAmount = () => {
  return Math.max(0, parseMoney(baseAmountInput.value));
};

const setValueNeutral = (element, isNeutral) => {
  element.classList.toggle("value-neutral", isNeutral);
};

const animateValue = (element) => {
  element.classList.remove("value-change");
  void element.offsetWidth;
  element.classList.add("value-change");
};

const updateTipOutputs = () => {
  const base = parseBaseAmount();
  const tipAmount = base * (tipPercent / 100);
  const total = base + tipAmount;
  const perPerson = total / people;
  const roundedPerPerson = roundPerPerson
    ? Math.round(perPerson * 2) / 2
    : perPerson;
  const displayTotal = roundPerPerson ? roundedPerPerson * people : total;
  const displayTip = roundPerPerson ? displayTotal - base : tipAmount;

  perPersonOutput.textContent = `$${roundedPerPerson.toFixed(2)}`;
  tipTotalOutput.textContent = `$${displayTip.toFixed(2)}`;
  totalAmountOutput.textContent = `$${displayTotal.toFixed(2)}`;
  setValueNeutral(perPersonOutput, roundedPerPerson === 0);
  animateValue(perPersonOutput);
};

const setPeople = (value) => {
  people = Math.min(10, Math.max(1, value));
  peopleCount.textContent = String(people);
  updateTipOutputs();
  writePrefs();
};

const setTipPercent = (value) => {
  tipPercent = Math.min(50, Math.max(0, value));
  customTipInput.value = "";
  tipCustomPercentEnabled = false;
  tipChips.forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.tip) === tipPercent);
  });
  updateTipOutputs();
  writePrefs();
};

const parseMoneyInput = (input) => {
  return Math.max(0, parseMoney(input.value));
};

const toBaseCurrency = (amount, currency) =>
  currency === "BGN" ? amount : amount * FX_RATE;

const fromBaseCurrency = (amount, currency) =>
  currency === "BGN" ? amount : amount / FX_RATE;

const formatMoney = (value) => value.toFixed(2);

const setToggleGroup = (role, currency) => {
  const buttons = document.querySelectorAll(`[data-role="${role}"]`);
  buttons.forEach((button) => {
    const isActive = button.dataset.currency === currency;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const updateSecondaryCurrency = () => {
  const secondaryCurrency = changeState.paidCurrency === "EUR" ? "BGN" : "EUR";
  const secondaryButton = document.querySelector(
    '[data-role="paid-secondary-currency"]'
  );
  secondaryButton.dataset.currency = secondaryCurrency;
  secondaryButton.textContent = secondaryCurrency;
  secondaryButton.setAttribute("aria-pressed", "true");
};

function syncPaidFromCalc() {
  if (changeState.paidManual) return;
  const calcValue = getCalcValue();
  paidInput.value = formatMoney(calcValue);
  updateChangeOutputs();
}

const flashPaidInput = () => {
  if (!paidInputRow) return;
  paidInputRow.classList.remove("flash");
  void paidInputRow.offsetWidth;
  paidInputRow.classList.add("flash");
};

const updateChangeOutputs = () => {
  const price = parseMoneyInput(priceInput);
  const paidPrimary = parseMoneyInput(paidInput);
  const paidSecondary = parseMoneyInput(paidSecondaryInput);

  const priceBase = toBaseCurrency(price, changeState.priceCurrency);
  const paidPrimaryBase = toBaseCurrency(paidPrimary, changeState.paidCurrency);
  const paidSecondaryBase = changeState.splitEnabled
    ? toBaseCurrency(
        paidSecondary,
        changeState.paidCurrency === "EUR" ? "BGN" : "EUR"
      )
    : 0;

  const paidBaseTotal = paidPrimaryBase + paidSecondaryBase;
  const deltaBase = paidBaseTotal - priceBase;
  const isChange = deltaBase >= 0;
  const displayAmount = Math.abs(deltaBase);

  const displayAmountConverted = fromBaseCurrency(
    displayAmount,
    changeState.outputCurrency
  );
  const paidConverted = fromBaseCurrency(
    paidBaseTotal,
    changeState.outputCurrency
  );
  const priceConverted = fromBaseCurrency(
    priceBase,
    changeState.outputCurrency
  );

  changeLabel.textContent = isChange ? "Change" : "Remaining";
  changeValue.textContent = formatMoney(displayAmountConverted);
  paidTotalOutput.textContent = formatMoney(paidConverted);
  priceTotalOutput.textContent = formatMoney(priceConverted);
  changeHint.classList.toggle("is-visible", !isChange);
};

const openTipModal = () => {
  const currentValue = hasError ? 0 : parseFloat(displayValue) || 0;
  baseAmountInput.value = currentValue.toFixed(2);
  if (tipCustomPercentEnabled) {
    customTipInput.value = String(tipPercent);
    tipChips.forEach((chip) => chip.classList.remove("active"));
    updateTipOutputs();
  } else {
    setTipPercent(tipPercent);
  }
  setPeople(people);
  tipOverlay.classList.add("open");
  tipOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => baseAmountInput.focus(), 120);
};

const closeTipModal = () => {
  tipOverlay.classList.remove("open");
  tipOverlay.setAttribute("aria-hidden", "true");
};

baseAmountInput.addEventListener("input", () => {
  sanitizeMoneyInput(baseAmountInput);
  updateTipOutputs();
});

stepperButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const delta = Number(button.dataset.step);
    setPeople(people + delta);
  });
});

tipChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const value = Number(chip.dataset.tip);
    setTipPercent(value);
  });
});

customTipInput.addEventListener("input", () => {
  sanitizeNumericInput(customTipInput);
  const value = parseLocaleNumber(customTipInput.value);
  tipChips.forEach((chip) => chip.classList.remove("active"));
  tipPercent = Number.isNaN(value) ? 0 : Math.min(50, Math.max(0, value));
  tipCustomPercentEnabled = customTipInput.value.trim() !== "";
  updateTipOutputs();
  writePrefs();
});

roundToggle.addEventListener("change", () => {
  roundPerPerson = roundToggle.checked;
  roundingNote.classList.toggle("is-visible", roundPerPerson);
  updateTipOutputs();
  writePrefs();
});

tipOverlay.addEventListener("click", (event) => {
  if (event.target === tipOverlay) closeTipModal();
});

tipClose.addEventListener("click", closeTipModal);

priceInput.addEventListener("input", () => {
  sanitizeMoneyInput(priceInput);
  updateChangeOutputs();
});

paidInput.addEventListener("input", () => {
  sanitizeMoneyInput(paidInput);
  changeState.paidManual = true;
  updateChangeOutputs();
});

paidSecondaryInput.addEventListener("input", () => {
  sanitizeMoneyInput(paidSecondaryInput);
  updateChangeOutputs();
});

useCalcButton.addEventListener("click", () => {
  changeState.paidManual = false;
  syncPaidFromCalc();
  changeState.paidManual = true;
  flashPaidInput();
});

document.querySelectorAll('[data-role="price-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.priceCurrency = button.dataset.currency;
    setToggleGroup("price-currency", changeState.priceCurrency);
    updateChangeOutputs();
    writePrefs();
  });
});

document.querySelectorAll('[data-role="paid-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.paidCurrency = button.dataset.currency;
    setToggleGroup("paid-currency", changeState.paidCurrency);
    updateSecondaryCurrency();
    updateChangeOutputs();
    writePrefs();
  });
});

document.querySelectorAll('[data-role="output-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.outputCurrency = button.dataset.currency;
    setToggleGroup("output-currency", changeState.outputCurrency);
    updateChangeOutputs();
    writePrefs();
  });
});

splitToggle.addEventListener("click", () => {
  changeState.splitEnabled = !changeState.splitEnabled;
  splitToggle.setAttribute("aria-pressed", String(changeState.splitEnabled));
  splitFields.classList.toggle("is-open", changeState.splitEnabled);
  updateChangeOutputs();
  writePrefs();
});

window.addEventListener("keydown", (event) => {
  if (tipOverlay.classList.contains("open")) {
    if (event.key === "Escape") closeTipModal();
    return;
  }

  if (/^[0-9]$/.test(event.key)) handleNumber(event.key);
  if (event.key === ".") handleNumber(".");
  if (["+", "-", "*", "/"].includes(event.key)) handleOperator(event.key);
  if (event.key === "Enter" || event.key === "=") handleEquals();
  if (event.key === "Backspace") handleBackspace();
  if (event.key === "Escape") clearAll();
});

const applyPrefs = () => {
  const prefs = readPrefs();
  if (!prefs) return;

  changeState.outputCurrency = normalizeCurrency(
    prefs.changeOutputCurrency,
    changeState.outputCurrency
  );
  changeState.priceCurrency = normalizeCurrency(
    prefs.priceCurrency,
    changeState.priceCurrency
  );
  changeState.paidCurrency = normalizeCurrency(
    prefs.paidCurrency,
    changeState.paidCurrency
  );
  changeState.splitEnabled =
    typeof prefs.splitPaymentEnabled === "boolean"
      ? prefs.splitPaymentEnabled
      : changeState.splitEnabled;

  const nextPeople = clampNumber(prefs.tipPeople, 1, 10, people);
  const nextTipPercent = clampNumber(prefs.tipPercent, 0, 50, tipPercent);
  const nextRound =
    typeof prefs.tipRoundPerPerson === "boolean"
      ? prefs.tipRoundPerPerson
      : roundPerPerson;
  const nextCustomEnabled =
    typeof prefs.tipCustomPercentEnabled === "boolean"
      ? prefs.tipCustomPercentEnabled
      : tipCustomPercentEnabled;

  people = nextPeople;
  tipPercent = nextTipPercent;
  roundPerPerson = nextRound;
  tipCustomPercentEnabled = nextCustomEnabled;
};

const applyPrefsToUI = () => {
  setToggleGroup("output-currency", changeState.outputCurrency);
  setToggleGroup("price-currency", changeState.priceCurrency);
  setToggleGroup("paid-currency", changeState.paidCurrency);
  updateSecondaryCurrency();

  splitToggle.setAttribute("aria-pressed", String(changeState.splitEnabled));
  splitFields.classList.toggle("is-open", changeState.splitEnabled);

  peopleCount.textContent = String(people);
  if (tipCustomPercentEnabled) {
    customTipInput.value = String(tipPercent);
    tipChips.forEach((chip) => chip.classList.remove("active"));
    updateTipOutputs();
  } else {
    setTipPercent(tipPercent);
  }
  roundToggle.checked = roundPerPerson;
  roundingNote.classList.toggle("is-visible", roundPerPerson);
};

const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isMobileDevice = () =>
  /iphone|ipad|ipod|android/i.test(window.navigator.userAgent);

const isInstallHintDismissed = () => safeStorage.get(INSTALL_HINT_KEY) === "1";

const showInstallHint = () => {
  if (!installHint) return;
  installHint.classList.add("is-visible");
};

const hideInstallHint = () => {
  if (!installHint) return;
  installHint.classList.remove("is-visible");
};

const maybeShowInstallHint = () => {
  if (isInstalled()) return;
  if (isInstallHintDismissed()) return;
  const supportedInstall = Boolean(deferredInstallPrompt);
  if (supportedInstall || isMobileDevice()) {
    showInstallHint();
  }
};

if (installHintDismiss) {
  installHintDismiss.addEventListener("click", () => {
    safeStorage.set(INSTALL_HINT_KEY, "1");
    hideInstallHint();
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  maybeShowInstallHint();
});

updateDisplay();
applyPrefs();
applyPrefsToUI();
updateTipOutputs();
updateChangeOutputs();

maybeShowInstallHint();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

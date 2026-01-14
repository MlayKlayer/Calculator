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

const perPersonOutput = document.getElementById("per-person");
const tipTotalOutput = document.getElementById("tip-total");
const totalAmountOutput = document.getElementById("total-amount");

const priceAmountInput = document.getElementById("price-amount");
const paidAmountInput = document.getElementById("paid-amount");
const paidAmountSecondaryInput = document.getElementById("paid-amount-secondary");
const splitToggle = document.getElementById("split-toggle");
const splitPanel = document.getElementById("split-panel");
const syncPaidButton = document.getElementById("sync-paid");
const changeLabel = document.getElementById("change-label");
const changeValue = document.getElementById("change-value");
const priceDisplay = document.getElementById("price-display");
const paidDisplay = document.getElementById("paid-display");

const FX_RATE = 1.95583;

let displayValue = "0";
let storedValue = null;
let pendingOperator = null;
let resetDisplay = false;
let hasError = false;

let people = 1;
let tipPercent = 10;

const changeState = {
  priceCurrency: "EUR",
  paidCurrency: "EUR",
  paidSecondaryCurrency: "BGN",
  outputCurrency: "EUR",
  splitEnabled: false,
  paidLocked: false,
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

const updateDisplay = () => {
  display.textContent = formatNumber(displayValue);
  tipButton.disabled = hasError;
  syncPaidFromCalc();
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

const parseBaseAmount = () => {
  const value = parseFloat(baseAmountInput.value);
  if (Number.isNaN(value) || value < 0) return 0;
  return value;
};

const updateTipOutputs = () => {
  const base = parseBaseAmount();
  const tipAmount = base * (tipPercent / 100);
  const total = base + tipAmount;
  const perPerson = total / people;

  perPersonOutput.textContent = `$${perPerson.toFixed(2)}`;
  tipTotalOutput.textContent = `$${tipAmount.toFixed(2)}`;
  totalAmountOutput.textContent = `$${total.toFixed(2)}`;
};

const setPeople = (value) => {
  people = Math.min(10, Math.max(1, value));
  peopleCount.textContent = String(people);
  updateTipOutputs();
};

const setTipPercent = (value) => {
  tipPercent = Math.min(50, Math.max(0, value));
  customTipInput.value = "";
  tipChips.forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.tip) === tipPercent);
  });
  updateTipOutputs();
};

const openTipModal = () => {
  const currentValue = hasError ? 0 : parseFloat(displayValue) || 0;
  baseAmountInput.value = currentValue.toFixed(2);
  setTipPercent(tipPercent);
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
  if (parseFloat(baseAmountInput.value) < 0) baseAmountInput.value = "0";
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
  const value = parseFloat(customTipInput.value);
  tipChips.forEach((chip) => chip.classList.remove("active"));
  tipPercent = Number.isNaN(value) ? 0 : Math.min(50, Math.max(0, value));
  updateTipOutputs();
});

tipOverlay.addEventListener("click", (event) => {
  if (event.target === tipOverlay) closeTipModal();
});

tipClose.addEventListener("click", closeTipModal);

const parseMoney = (value) => {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const toBGN = (value, currency) =>
  currency === "EUR" ? value * FX_RATE : value;

const fromBGN = (value, currency) =>
  currency === "EUR" ? value / FX_RATE : value;

const formatCurrency = (value, currency) => {
  const symbol = currency === "EUR" ? "€" : "лв";
  return `${symbol}${value.toFixed(2)}`;
};

const updateChangeOutputs = () => {
  const price = parseMoney(priceAmountInput.value);
  const paid = parseMoney(paidAmountInput.value);
  const paidSecondary = parseMoney(paidAmountSecondaryInput.value);

  const priceBGN = toBGN(price, changeState.priceCurrency);
  const paidBGN = toBGN(paid, changeState.paidCurrency);
  const secondaryBGN = changeState.splitEnabled
    ? toBGN(paidSecondary, changeState.paidSecondaryCurrency)
    : 0;

  const paidTotalBGN = paidBGN + secondaryBGN;
  const outputPrice = fromBGN(priceBGN, changeState.outputCurrency);
  const outputPaid = fromBGN(paidTotalBGN, changeState.outputCurrency);
  const diff = outputPaid - outputPrice;

  if (diff >= 0) {
    changeLabel.textContent = "Change";
    changeValue.textContent = formatCurrency(diff, changeState.outputCurrency);
  } else {
    changeLabel.textContent = "Remaining";
    changeValue.textContent = formatCurrency(Math.abs(diff), changeState.outputCurrency);
  }

  priceDisplay.textContent = formatCurrency(outputPrice, changeState.outputCurrency);
  paidDisplay.textContent = formatCurrency(outputPaid, changeState.outputCurrency);
};

const setToggleState = (target, currency) => {
  document.querySelectorAll(`.toggle-btn[data-target="${target}"]`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.currency === currency);
  });
};

const syncPaidFromCalc = () => {
  if (changeState.paidLocked || document.activeElement === paidAmountInput) return;
  if (hasError) return;
  const currentValue = parseFloat(displayValue);
  const safeValue = Number.isNaN(currentValue) ? 0 : currentValue;
  paidAmountInput.value = safeValue.toFixed(2);
  updateChangeOutputs();
};

const handlePaidManualEdit = () => {
  changeState.paidLocked = true;
  updateChangeOutputs();
};

priceAmountInput.addEventListener("input", updateChangeOutputs);
paidAmountInput.addEventListener("input", handlePaidManualEdit);
paidAmountSecondaryInput.addEventListener("input", updateChangeOutputs);

paidAmountInput.addEventListener("focus", () => {
  changeState.paidLocked = true;
});

syncPaidButton.addEventListener("click", () => {
  changeState.paidLocked = false;
  syncPaidFromCalc();
});

splitToggle.addEventListener("click", () => {
  changeState.splitEnabled = !changeState.splitEnabled;
  splitToggle.classList.toggle("active", changeState.splitEnabled);
  splitToggle.setAttribute("aria-pressed", String(changeState.splitEnabled));
  splitPanel.classList.toggle("open", changeState.splitEnabled);
  splitPanel.setAttribute("aria-hidden", String(!changeState.splitEnabled));
  updateChangeOutputs();
});

const toggleButtons = document.querySelectorAll(".toggle-btn");

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { target, currency } = button.dataset;
    if (target === "price") changeState.priceCurrency = currency;
    if (target === "paid") {
      changeState.paidCurrency = currency;
      changeState.paidSecondaryCurrency = currency === "EUR" ? "BGN" : "EUR";
      setToggleState("paid-secondary", changeState.paidSecondaryCurrency);
    }
    if (target === "paid-secondary") changeState.paidSecondaryCurrency = currency;
    if (target === "output") changeState.outputCurrency = currency;
    setToggleState(target, currency);
    updateChangeOutputs();
  });
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

updateDisplay();
setTipPercent(tipPercent);
updateTipOutputs();
updateChangeOutputs();

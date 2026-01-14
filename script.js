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

let displayValue = "0";
let storedValue = null;
let pendingOperator = null;
let resetDisplay = false;
let hasError = false;

let people = 1;
let tipPercent = 10;
const FX_RATE = 1.95583;
const changeState = {
  priceCurrency: "EUR",
  paidCurrency: "EUR",
  outputCurrency: "EUR",
  splitEnabled: false,
  paidManual: false,
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

function getCalcValue() {
  if (hasError) return 0;
  const value = parseFloat(displayValue);
  return Number.isNaN(value) ? 0 : value;
}

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

tipButton.addEventListener("click", () => {
  if (!hasError) openTipModal();
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
  setValueNeutral(perPersonOutput, perPerson === 0);
  animateValue(perPersonOutput);
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

const parseMoneyInput = (input) => {
  const value = parseFloat(input.value);
  if (Number.isNaN(value) || value < 0) return 0;
  return value;
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

priceInput.addEventListener("input", () => {
  if (parseFloat(priceInput.value) < 0) priceInput.value = "0";
  updateChangeOutputs();
});

paidInput.addEventListener("input", () => {
  if (parseFloat(paidInput.value) < 0) paidInput.value = "0";
  changeState.paidManual = true;
  updateChangeOutputs();
});

paidSecondaryInput.addEventListener("input", () => {
  if (parseFloat(paidSecondaryInput.value) < 0) paidSecondaryInput.value = "0";
  updateChangeOutputs();
});

useCalcButton.addEventListener("click", () => {
  changeState.paidManual = false;
  syncPaidFromCalc();
});

document.querySelectorAll('[data-role="price-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.priceCurrency = button.dataset.currency;
    setToggleGroup("price-currency", changeState.priceCurrency);
    updateChangeOutputs();
  });
});

document.querySelectorAll('[data-role="paid-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.paidCurrency = button.dataset.currency;
    setToggleGroup("paid-currency", changeState.paidCurrency);
    updateSecondaryCurrency();
    updateChangeOutputs();
  });
});

document.querySelectorAll('[data-role="output-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.outputCurrency = button.dataset.currency;
    setToggleGroup("output-currency", changeState.outputCurrency);
    updateChangeOutputs();
  });
});

splitToggle.addEventListener("click", () => {
  changeState.splitEnabled = !changeState.splitEnabled;
  splitToggle.setAttribute("aria-pressed", String(changeState.splitEnabled));
  splitFields.classList.toggle("is-open", changeState.splitEnabled);
  updateChangeOutputs();
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
updateSecondaryCurrency();
updateChangeOutputs();

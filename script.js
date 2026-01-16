const mainRoot = document.getElementById("calcMain");
const changeRoot = document.getElementById("calcChange");

let activeKeyboardTarget = "main";
let hasMainCalculator = false;

const isTextEntryElement = (element) =>
  !!element &&
  (element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable === true);

const isTextEntry = (element) => isTextEntryElement(element);

const shouldMainConsumeTypingEvent = (event) => {
  if (!hasMainCalculator) return false;
  const target = event?.target;
  if (isTextEntryElement(target)) return false;
  const activeElement = document.activeElement;
  if (isTextEntryElement(activeElement)) return false;
  return activeKeyboardTarget === "main";
};

if (mainRoot) {
  const setMain = () => {
    if (!hasMainCalculator) return;
    activeKeyboardTarget = "main";
  };
  mainRoot.addEventListener("pointerdown", setMain);
  mainRoot.addEventListener("mousedown", setMain);
  mainRoot.addEventListener("touchstart", setMain, { passive: true });
}

if (changeRoot) {
  const setChange = () => {
    activeKeyboardTarget = "change";
  };
  const isChangeNumericInput = (element) =>
    element instanceof HTMLInputElement &&
    element.matches('input[inputmode="decimal"]');
  changeRoot.addEventListener("pointerdown", setChange);
  changeRoot.addEventListener("mousedown", setChange);
  changeRoot.addEventListener("touchstart", setChange, { passive: true });
  changeRoot.addEventListener("focusin", (event) => {
    if (isTextEntryElement(event.target)) activeKeyboardTarget = "change";
    const target = event.target;
    if (!isChangeNumericInput(target)) return;
    if (!target.value.trim()) return;
    target.select();
  });
}

document.addEventListener("focusin", (event) => {
  const element = event.target;
  if (!isTextEntry(element)) return;
  const tipRoot =
    element.closest('[data-tip-modal="true"]') ||
    element.closest(".tip-modal") ||
    element.closest("#tipModal");
  if (!tipRoot) return;
  if (String(element.value || "").trim() === "") return;
  setTimeout(() => {
    try {
      element.select();
    } catch (_) {}
  }, 0);
});

const display = mainRoot.querySelector("#calc-display");
const buttons = mainRoot.querySelectorAll(".button-grid .btn");
const tipButton = mainRoot.querySelector(".btn-tip");

hasMainCalculator = Boolean(display && buttons.length);
if (!hasMainCalculator) {
  activeKeyboardTarget = "change";
}

const tipOverlay = mainRoot.querySelector("#tip-overlay");
const tipClose = mainRoot.querySelector("#tip-close");
const baseAmountInput = mainRoot.querySelector("#base-amount");
const peopleCount = mainRoot.querySelector("#people-count");
const stepperButtons = mainRoot.querySelectorAll(".stepper-btn");
const tipChips = mainRoot.querySelectorAll(".chip");
const customTipInput = mainRoot.querySelector("#custom-tip");
const roundToggle = mainRoot.querySelector("#round-per-person");
const roundingNote = mainRoot.querySelector("#rounding-note");

const perPersonOutput = mainRoot.querySelector("#per-person");
const tipTotalOutput = mainRoot.querySelector("#tip-total");
const totalAmountOutput = mainRoot.querySelector("#total-amount");
const priceInput = changeRoot.querySelector("#product-price");
const paidInput = changeRoot.querySelector("#paid-amount");
const paidSecondaryInput = changeRoot.querySelector("#paid-amount-secondary");
const splitToggle = changeRoot.querySelector("#split-toggle");
const splitFields = changeRoot.querySelector("#split-fields");
const changeLabel = changeRoot.querySelector("#change-label");
const changeValue = changeRoot.querySelector("#change-value");
const paidTotalOutput = changeRoot.querySelector("#paid-total");
const priceTotalOutput = changeRoot.querySelector("#price-total");
const changeHint = changeRoot.querySelector("#change-hint");
const changeResetButton = changeRoot.querySelector("#change-reset");
const installHint = document.getElementById("install-hint");
const installHintDismiss = document.getElementById("install-hint-dismiss");
const themeToggle = document.getElementById("theme-toggle");
const themeOverlay = document.getElementById("theme-overlay");
const copyToast = document.getElementById("copy-toast");
const feedbackFooter = document.getElementById("feedbackFooter");
const feedbackSlotDesktop = document.getElementById("feedbackSlotDesktop");
const feedbackSlotMobile = document.getElementById("feedbackSlotMobile");
const layoutRoot = document.querySelector(".layout");
const mobilePortraitQuery = window.matchMedia(
  "(max-width: 768px) and (orientation: portrait)"
);

const resultDisplays = [
  display,
  changeValue,
  perPersonOutput,
  tipTotalOutput,
  totalAmountOutput,
].filter(Boolean);
resultDisplays.forEach((element) => element.classList.add("result-display"));

const placeFeedback = () => {
  if (!feedbackFooter || !feedbackSlotDesktop || !feedbackSlotMobile) return;
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const activePanel = layoutRoot?.dataset.activePanel;
  const usePortraitSlot =
    mobilePortraitQuery.matches && (activePanel === "change" || activePanel === "tip");
  const targetSlot = usePortraitSlot
    ? activePanel === "tip"
      ? feedbackSlotDesktop
      : feedbackSlotMobile
    : isMobile
      ? feedbackSlotMobile
      : feedbackSlotDesktop;
  if (feedbackFooter.parentElement !== targetSlot) {
    targetSlot.appendChild(feedbackFooter);
  }
};

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
};

const PREFS_KEY = "mincalc.prefs.v1";
const INSTALL_HINT_KEY = "mincalc.installHintDismissed.v1";
const THEME_KEY = "themeMode";
const ACTIVE_PANEL_KEY = "mincalc.activePanel.v1";
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

const getStoredActivePanel = () => {
  const stored = safeStorage.get(ACTIVE_PANEL_KEY);
  return stored === "tip" || stored === "change" ? stored : "change";
};

const setActivePanel = (panel, { persist = true } = {}) => {
  if (!layoutRoot) return;
  if (panel !== "tip" && panel !== "change") return;
  layoutRoot.dataset.activePanel = panel;
  if (persist) {
    safeStorage.set(ACTIVE_PANEL_KEY, panel);
  }
  placeFeedback();
};

const applyStoredPanel = () => {
  if (!layoutRoot) return;
  const panel = getStoredActivePanel();
  setActivePanel(panel, { persist: false });
};

const themeModes = ["dark", "light", "auto"];
let themeMode = themeModes.includes(safeStorage.get(THEME_KEY))
  ? safeStorage.get(THEME_KEY)
  : "dark";
const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
let themeOverlayTimeout = null;

const setThemeDataset = (mode) => {
  document.documentElement.dataset.theme = mode;
};

const applyAutoTheme = () => {
  setThemeDataset(themeQuery.matches ? "dark" : "light");
};

const applyThemeMode = (mode, { persist = true, announce = false } = {}) => {
  if (!themeModes.includes(mode)) return;
  themeMode = mode;
  if (persist) {
    safeStorage.set(THEME_KEY, mode);
  }
  if (mode === "auto") {
    applyAutoTheme();
  } else {
    setThemeDataset(mode);
  }
  if (announce) {
    showThemeOverlay(mode);
  }
};

const showThemeOverlay = (mode) => {
  if (!themeOverlay) return;
  themeOverlay.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  themeOverlay.classList.add("is-visible");
  themeOverlay.setAttribute("aria-hidden", "false");
  if (themeOverlayTimeout) {
    window.clearTimeout(themeOverlayTimeout);
  }
  themeOverlayTimeout = window.setTimeout(() => {
    themeOverlay.classList.remove("is-visible");
    themeOverlay.setAttribute("aria-hidden", "true");
  }, 1000);
};

const handleThemeQueryChange = () => {
  if (themeMode === "auto") {
    applyAutoTheme();
  }
};

if (typeof themeQuery.addEventListener === "function") {
  themeQuery.addEventListener("change", handleThemeQueryChange);
} else if (typeof themeQuery.addListener === "function") {
  themeQuery.addListener(handleThemeQueryChange);
}

const PANEL_SWIPE_THRESHOLD = 36;
const PANEL_SWIPE_TOLERANCE = 48;
let panelSwipeStart = null;

const shouldHandlePanelGesture = (eventTarget) => {
  if (!layoutRoot || !mobilePortraitQuery.matches) return false;
  if (isTextEntryElement(eventTarget)) return false;
  return true;
};

const getActivePanel = () => layoutRoot?.dataset.activePanel;

const toggleActivePanel = () => {
  const activePanel = getActivePanel();
  if (activePanel === "tip") {
    setActivePanel("change");
  } else if (activePanel === "change") {
    setActivePanel("tip");
  }
};

const handlePanelSwipeStart = (event) => {
  if (!shouldHandlePanelGesture(event.target)) return;
  const activePanel = getActivePanel();
  if (!activePanel) return;
  if (
    (activePanel === "tip" && event.currentTarget !== mainRoot) ||
    (activePanel === "change" && event.currentTarget !== changeRoot)
  ) {
    return;
  }
  const [touch] = event.touches;
  if (!touch) return;
  panelSwipeStart = {
    x: touch.clientX,
    y: touch.clientY,
  };
};

const handlePanelSwipeEnd = (event) => {
  if (!panelSwipeStart) return;
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  const deltaX = touch.clientX - panelSwipeStart.x;
  const deltaY = touch.clientY - panelSwipeStart.y;
  panelSwipeStart = null;
  if (Math.abs(deltaX) < PANEL_SWIPE_THRESHOLD) return;
  if (Math.abs(deltaY) > PANEL_SWIPE_TOLERANCE) return;
  toggleActivePanel();
};

const setupPanelNavigation = () => {
  if (!layoutRoot || !mainRoot || !changeRoot) return;
  applyStoredPanel();
  [mainRoot, changeRoot].forEach((panel) => {
    panel.addEventListener("touchstart", handlePanelSwipeStart, {
      passive: true,
    });
    panel.addEventListener("touchend", handlePanelSwipeEnd, {
      passive: true,
    });
  });
  const handlePortraitChange = () => {
    applyStoredPanel();
    placeFeedback();
  };
  if (typeof mobilePortraitQuery.addEventListener === "function") {
    mobilePortraitQuery.addEventListener("change", handlePortraitChange);
  } else if (typeof mobilePortraitQuery.addListener === "function") {
    mobilePortraitQuery.addListener(handlePortraitChange);
  }
  document.addEventListener("click", (event) => {
    if (!layoutRoot || !mobilePortraitQuery.matches) return;
    const activePanel = getActivePanel();
    if (!activePanel) return;
    const heading =
      activePanel === "tip"
        ? mainRoot.querySelector(".tip-header")
        : changeRoot.querySelector(".panel-header");
    if (!heading) return;
    if (heading.contains(event.target)) {
      toggleActivePanel();
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  applyStoredPanel();
  placeFeedback();
});
window.addEventListener("resize", placeFeedback);
setupPanelNavigation();

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

const resultRenderState = new Map();

const parseDisplayNumber = (text) => {
  if (!text) return null;
  const numericText = text.replace(/[^0-9.,+-]/g, "");
  if (!numericText) return null;
  const normalized = numericText.includes(",") && !numericText.includes(".")
    ? numericText.replace(",", ".")
    : numericText;
  const value = parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
};

const isZeroDisplayValue = (text) => {
  const value = parseDisplayNumber(text);
  return value !== null && Math.abs(value) === 0;
};

const shouldConfirmDisplayValue = (text) => {
  const value = parseDisplayNumber(text);
  return value !== null && Math.abs(value) > 0;
};

const buildResultContent = (text) => {
  if (!text) return document.createTextNode("");
  if (/e/i.test(text)) return document.createTextNode(text);
  const match = text.match(/^(\D*)([+-]?)(\d+)([.,]\d+)?$/);
  if (!match) return document.createTextNode(text);
  const [, currency, sign, integer, decimal] = match;
  const fragment = document.createDocumentFragment();
  if (currency) {
    const currencySpan = document.createElement("span");
    currencySpan.className = "result-currency";
    currencySpan.textContent = currency;
    fragment.appendChild(currencySpan);
  }
  const integerSpan = document.createElement("span");
  integerSpan.className = "result-int";
  integerSpan.textContent = `${sign}${integer}`;
  fragment.appendChild(integerSpan);
  if (decimal) {
    const decimalSpan = document.createElement("span");
    decimalSpan.className = "result-decimal";
    decimalSpan.textContent = decimal;
    fragment.appendChild(decimalSpan);
  }
  return fragment;
};

const setResultContent = (element, text) => {
  const wrapper = document.createElement("span");
  wrapper.className = "result-content";
  wrapper.appendChild(buildResultContent(text));
  element.replaceChildren(wrapper);
};

const updateResultDisplay = (element, nextText) => {
  if (!element) return;
  const state = resultRenderState.get(element) ?? {};
  if (state.timeoutId) window.clearTimeout(state.timeoutId);
  if (state.breatheTimeout) window.clearTimeout(state.breatheTimeout);
  if (state.confirmTimeout) window.clearTimeout(state.confirmTimeout);

  const previousText =
    element.dataset.currentValue ?? element.textContent?.trim() ?? "";

  element.classList.remove("result-breathe");
  void element.offsetWidth;
  element.classList.add("result-breathe");
  state.breatheTimeout = window.setTimeout(() => {
    element.classList.remove("result-breathe");
  }, 140);

  state.timeoutId = window.setTimeout(() => {
    if (previousText && previousText !== nextText) {
      if (state.ghostTimeout) window.clearTimeout(state.ghostTimeout);
      element.dataset.ghost = previousText;
      element.classList.add("has-ghost");
      state.ghostTimeout = window.setTimeout(() => {
        if (element.dataset.ghost === previousText) {
          element.classList.remove("has-ghost");
          delete element.dataset.ghost;
        }
      }, 2100);
    }

    setResultContent(element, nextText);
    element.dataset.currentValue = nextText;

    const isZero = isZeroDisplayValue(nextText);
    element.classList.toggle("result-zero", isZero);

    if (!isZero && shouldConfirmDisplayValue(nextText)) {
      element.classList.remove("result-confirm");
      void element.offsetWidth;
      element.classList.add("result-confirm");
      state.confirmTimeout = window.setTimeout(() => {
        element.classList.remove("result-confirm");
      }, 140);
    }
  }, 50);

  resultRenderState.set(element, state);
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

let copyToastTimeout = null;

const showCopyToast = () => {
  if (!copyToast) return;
  copyToast.classList.add("is-visible");
  if (copyToastTimeout) {
    window.clearTimeout(copyToastTimeout);
  }
  copyToastTimeout = window.setTimeout(() => {
    copyToast.classList.remove("is-visible");
  }, 1000);
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const getCopyText = (element) => {
  const text = element.textContent?.trim() ?? "";
  if (!text) return null;
  const numeric = parseLocaleNumber(text);
  if (!Number.isFinite(numeric) || Math.abs(numeric) === 0) return null;
  return text;
};

const handleCopy = async (element) => {
  const text = getCopyText(element);
  if (!text) return;
  try {
    await copyTextToClipboard(text);
    showCopyToast();
  } catch (error) {
    showCopyToast();
  }
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

const updateDisplay = () => {
  if (display) {
    updateResultDisplay(display, formatNumber(displayValue));
  }
  if (tipButton) {
    tipButton.disabled = hasError;
  }
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

if (hasMainCalculator) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      activeKeyboardTarget = "main";
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
}

if (tipButton) {
  tipButton.addEventListener("click", () => {
    if (!hasError) openTipModal();
  });
}

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

  updateResultDisplay(perPersonOutput, `$${roundedPerPerson.toFixed(2)}`);
  updateResultDisplay(tipTotalOutput, `$${displayTip.toFixed(2)}`);
  updateResultDisplay(totalAmountOutput, `$${displayTotal.toFixed(2)}`);
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
  const buttons = changeRoot.querySelectorAll(`[data-role="${role}"]`);
  buttons.forEach((button) => {
    const isActive = button.dataset.currency === currency;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const updateSecondaryCurrency = () => {
  const secondaryCurrency = changeState.paidCurrency === "EUR" ? "BGN" : "EUR";
  const secondaryButton = changeRoot.querySelector(
    '[data-role="paid-secondary-currency"]'
  );
  secondaryButton.dataset.currency = secondaryCurrency;
  secondaryButton.textContent = secondaryCurrency;
  secondaryButton.setAttribute("aria-pressed", "true");
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
  updateResultDisplay(changeValue, formatMoney(displayAmountConverted));
  paidTotalOutput.textContent = formatMoney(paidConverted);
  priceTotalOutput.textContent = formatMoney(priceConverted);
  changeHint.classList.toggle("is-visible", !isChange);
};

const openTipModal = () => {
  if (!tipOverlay) return;
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
  if (!tipOverlay) return;
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

if (tipOverlay) {
  tipOverlay.addEventListener("click", (event) => {
    if (event.target === tipOverlay) closeTipModal();
  });
}

if (tipClose) {
  tipClose.addEventListener("click", closeTipModal);
}

priceInput.addEventListener("input", () => {
  sanitizeMoneyInput(priceInput);
  updateChangeOutputs();
});

paidInput.addEventListener("input", () => {
  sanitizeMoneyInput(paidInput);
  updateChangeOutputs();
});

paidSecondaryInput.addEventListener("input", () => {
  sanitizeMoneyInput(paidSecondaryInput);
  updateChangeOutputs();
});

if (changeResetButton) {
  changeResetButton.addEventListener("click", () => {
    priceInput.value = "";
    paidInput.value = "";
    paidSecondaryInput.value = "";
    updateChangeOutputs();
    priceInput.focus();
  });
}

changeRoot.querySelectorAll('[data-role="price-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.priceCurrency = button.dataset.currency;
    setToggleGroup("price-currency", changeState.priceCurrency);
    updateChangeOutputs();
    writePrefs();
  });
});

changeRoot.querySelectorAll('[data-role="paid-currency"]').forEach((button) => {
  button.addEventListener("click", () => {
    changeState.paidCurrency = button.dataset.currency;
    setToggleGroup("paid-currency", changeState.paidCurrency);
    updateSecondaryCurrency();
    updateChangeOutputs();
    writePrefs();
  });
});

changeRoot.querySelectorAll('[data-role="output-currency"]').forEach((button) => {
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

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentIndex = themeModes.indexOf(themeMode);
    const nextMode = themeModes[(currentIndex + 1) % themeModes.length];
    applyThemeMode(nextMode, { announce: true });
  });
}

[display, changeValue, perPersonOutput].forEach((element) => {
  if (!element) return;
  element.addEventListener("click", () => {
    handleCopy(element);
  });
});

window.addEventListener("keydown", (event) => {
  if (!shouldMainConsumeTypingEvent(event)) return;
  if (tipOverlay?.classList.contains("open")) {
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
applyThemeMode(themeMode, { persist: false });
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

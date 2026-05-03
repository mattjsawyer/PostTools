(() => {
  const referenceRatio = 16 / 9;

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("aspect-ratio-form");

    if (!form) {
      return;
    }

    const fields = {
      width: {
        card: document.querySelector('[data-field="width"]'),
        input: document.getElementById("width-value"),
      },
      height: {
        card: document.querySelector('[data-field="height"]'),
        input: document.getElementById("height-value"),
      },
      ratio: {
        card: document.querySelector('[data-field="ratio"]'),
        input: document.getElementById("ratio-value"),
      },
    };

    const clearButton = document.getElementById("aspect-clear-button");
    const ratioCard = document.querySelector(".ratio-card");
    const ratioFilter = document.getElementById("ratio-filter");
    const customRatioInput = document.getElementById("custom-ratio-value");
    const ratioButtons = Array.from(document.querySelectorAll(".ratio-table-button"));
    const ratioRows = Array.from(document.querySelectorAll("[data-ratio-group]"));
    const knownRatios = buildKnownRatios(ratioButtons);
    const selectedRatioSummary = document.getElementById("selected-ratio-summary");
    const resultRatio = document.getElementById("result-ratio");
    const resultResolution = document.getElementById("result-resolution");
    const resultComparison = document.getElementById("result-comparison");
    const visualFrame = document.getElementById("aspect-visual-frame");
    const visualXLabel = document.getElementById("visual-x-label");
    const visualYLabel = document.getElementById("visual-y-label");

    const initialRatio = ratioButtons.find((button) => button.classList.contains("is-selected")) || ratioButtons[0];
    let selectedRatioId = initialRatio ? initialRatio.dataset.ratioId : "";
    let selectedRatio = initialRatio ? parseRatio(initialRatio.dataset.ratio) : referenceRatio;
    let selectedRatioLabel = initialRatio ? initialRatio.dataset.ratioLabel : "16:9";
    let selectedDecimalLabel = initialRatio ? initialRatio.dataset.decimalLabel : "1.78";
    let lastTableRatio = {
      id: selectedRatioId,
      ratio: selectedRatio,
      label: selectedRatioLabel,
      decimalLabel: selectedDecimalLabel,
    };
    let previousSolveFor = getSolveFor();
    let lastCalculatedRatioDetails = null;

    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", calculate);
    form.addEventListener("change", calculate);
    clearButton.addEventListener("click", clearAll);
    ratioFilter.addEventListener("change", updateRatioFilter);
    customRatioInput.addEventListener("input", syncCustomRatio);

    ratioButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const ratio = parseRatio(button.dataset.ratio);

        if (!isPositive(ratio)) {
          return;
        }

        selectedRatioId = button.dataset.ratioId;
        selectedRatio = ratio;
        selectedRatioLabel = button.dataset.ratioLabel;
        selectedDecimalLabel = button.dataset.decimalLabel;
        lastTableRatio = {
          id: selectedRatioId,
          ratio: selectedRatio,
          label: selectedRatioLabel,
          decimalLabel: selectedDecimalLabel,
        };
        customRatioInput.value = "";
        markSelectedRatio();
        calculate();
      });
    });

    markSelectedRatio();
    updateRatioFilter();
    calculate();

    function clearAll() {
      fields.width.input.value = "";
      fields.height.input.value = "";
      customRatioInput.value = "";
      restoreTableRatio();
      markSelectedRatio();
      calculate();
    }

    function calculate() {
      const solveFor = getSolveFor();

      if (previousSolveFor === "ratio" && solveFor !== "ratio" && hasUsableRatio(lastCalculatedRatioDetails)) {
        applyCalculatedRatio(lastCalculatedRatioDetails);
      }

      let width = parseDimension(fields.width.input.value);
      let height = parseDimension(fields.height.input.value);
      let ratioDetails = solveFor === "ratio"
        ? buildCalculatedRatioDetails(width, height, knownRatios)
        : buildSelectedRatioDetails();

      syncSolvedField(solveFor);
      syncRatioControls(solveFor);

      if (solveFor === "height") {
        height = isPositive(width) && isPositive(ratioDetails.ratio) ? width / ratioDetails.ratio : null;
        updateSolvedInput("height", height);
      } else if (solveFor === "width") {
        width = isPositive(height) && isPositive(ratioDetails.ratio) ? height * ratioDetails.ratio : null;
        updateSolvedInput("width", width);
      }

      if (solveFor === "ratio") {
        ratioDetails = buildCalculatedRatioDetails(width, height, knownRatios);
        lastCalculatedRatioDetails = hasUsableRatio(ratioDetails) ? ratioDetails : null;
      }

      updateRatioField(ratioDetails);
      updateSelectedRatioSummary(solveFor, ratioDetails);
      updateVisualizationFrame(ratioDetails.ratio);

      if (!isPositive(width) || !isPositive(height) || !isPositive(ratioDetails.ratio)) {
        previousSolveFor = solveFor;
        showEmptyResult(ratioDetails);
        return;
      }

      updateResult(Math.round(width), Math.round(height), ratioDetails);
      previousSolveFor = solveFor;
    }

    function syncSolvedField(solveFor) {
      Object.entries(fields).forEach(([fieldName, field]) => {
        const isRatioField = fieldName === "ratio";
        const isSolved = solveFor === "ratio"
          ? isRatioField
          : !isRatioField && fieldName === solveFor;
        const isInput = solveFor === "ratio"
          ? !isRatioField
          : !isRatioField && fieldName !== solveFor;
        const isReadOnly = isRatioField || isSolved;

        field.card.classList.toggle("is-solved", isSolved);
        field.card.classList.toggle("is-input", isInput);
        field.input.readOnly = isReadOnly;
        field.input.setAttribute("aria-readonly", String(isReadOnly));
      });
    }

    function updateSolvedInput(fieldName, value) {
      fields[fieldName].input.value = formatPixelValue(value);
    }

    function updateRatioField(ratioDetails) {
      fields.ratio.input.value = isPositive(ratioDetails.ratio) ? ratioDetails.text : "";
    }

    function updateSelectedRatioSummary(solveFor, ratioDetails) {
      const prefix = solveFor === "ratio" ? "Calculated" : "Selected";
      selectedRatioSummary.textContent = `${prefix}: ${ratioDetails.text}`;
      resultRatio.textContent = ratioDetails.text;
    }

    function updateResult(width, height, ratioDetails) {
      resultResolution.textContent = `${formatInteger(width)} x ${formatInteger(height)} px`;
      resultComparison.textContent = getComparisonText(ratioDetails.ratio);
      visualXLabel.textContent = `X ${formatInteger(width)} px`;
      visualYLabel.textContent = `Y ${formatInteger(height)} px`;
      visualFrame.setAttribute(
        "aria-label",
        `16:9 reference with a ${ratioDetails.text} frame at ${formatInteger(width)} by ${formatInteger(height)} pixels.`
      );
    }

    function showEmptyResult(ratioDetails) {
      resultResolution.textContent = "-";
      resultComparison.textContent = getComparisonText(ratioDetails.ratio);
      visualXLabel.textContent = "X -";
      visualYLabel.textContent = "Y -";
      visualFrame.setAttribute(
        "aria-label",
        `16:9 reference with a ${ratioDetails.text} frame. Enter valid values to calculate the resolution.`
      );
    }

    function updateVisualizationFrame(ratioValue) {
      let targetWidth = 100;
      let targetHeight = 100;

      if (!isPositive(ratioValue)) {
        visualFrame.style.setProperty("--target-width", "100%");
        visualFrame.style.setProperty("--target-height", "100%");
        return;
      }

      const ratioDelta = ratioValue - referenceRatio;

      if (Math.abs(ratioDelta) < 0.001) {
        targetWidth = 100;
        targetHeight = 100;
      } else if (ratioDelta > 0) {
        targetHeight = (referenceRatio / ratioValue) * 100;
      } else {
        targetWidth = (ratioValue / referenceRatio) * 100;
      }

      visualFrame.style.setProperty("--target-width", `${clamp(targetWidth, 0, 100)}%`);
      visualFrame.style.setProperty("--target-height", `${clamp(targetHeight, 0, 100)}%`);
    }

    function markSelectedRatio() {
      ratioButtons.forEach((button) => {
        const isSelected = button.dataset.ratioId === selectedRatioId;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
        button.textContent = isSelected ? "Selected" : "Use";
        button.closest("tr").classList.toggle("is-selected", isSelected);
      });
    }

    function updateRatioFilter() {
      const filter = ratioFilter.value;

      ratioRows.forEach((row) => {
        const groups = row.dataset.ratioGroup.split(" ");
        row.hidden = Boolean(filter) && !groups.includes(filter);
      });
    }

    function syncRatioControls(solveFor) {
      const disabled = solveFor === "ratio";
      ratioCard.classList.toggle("is-disabled", disabled);

      [ratioFilter, customRatioInput, ...ratioButtons].forEach((control) => {
        control.disabled = disabled;
      });
    }

    function syncCustomRatio() {
      const rawValue = customRatioInput.value.trim();

      if (!rawValue) {
        restoreTableRatio();
        markSelectedRatio();
        return;
      }

      const ratio = parseAspectRatio(rawValue);
      const compactValue = rawValue.replace(/\s+/g, "");
      const usesSeparator = compactValue.includes(":") || compactValue.includes("/");
      selectedRatioId = "custom";
      selectedRatio = ratio;
      selectedDecimalLabel = isPositive(ratio) ? formatDecimalRatio(ratio) : "";
      selectedRatioLabel = isPositive(ratio) && !usesSeparator ? selectedDecimalLabel : compactValue;
      markSelectedRatio();
    }

    function restoreTableRatio() {
      selectedRatioId = lastTableRatio.id;
      selectedRatio = lastTableRatio.ratio;
      selectedRatioLabel = lastTableRatio.label;
      selectedDecimalLabel = lastTableRatio.decimalLabel;
    }

    function applyCalculatedRatio(ratioDetails) {
      selectedRatioId = "custom";
      selectedRatio = ratioDetails.ratio;
      selectedRatioLabel = ratioDetails.label;
      selectedDecimalLabel = ratioDetails.decimalLabel;
      customRatioInput.value = ratioDetails.label;
      markSelectedRatio();
    }

    function buildSelectedRatioDetails() {
      if (!isPositive(selectedRatio)) {
        return {
          ratio: null,
          label: "",
          decimalLabel: "",
          text: "Enter a valid aspect ratio",
        };
      }

      return buildRatioDetails(selectedRatio, selectedRatioLabel, selectedDecimalLabel);
    }

    function buildCalculatedRatioDetails(width, height, ratioOptions) {
      if (!isPositive(width) || !isPositive(height)) {
        return {
          ratio: null,
          label: "",
          decimalLabel: "",
          text: "Enter two valid dimensions",
        };
      }

      const ratio = width / height;
      const decimalLabel = formatDecimalRatio(ratio);
      const matchedLabel = findKnownRatioLabel(ratio, ratioOptions);
      const label = matchedLabel || buildReducedRatioLabel(width, height) || decimalLabel;
      return buildRatioDetails(ratio, label, decimalLabel);
    }

    function getSolveFor() {
      const selected = document.querySelector('input[name="solve-for"]:checked');
      return selected ? selected.value : "height";
    }

    function getComparisonText(ratioValue) {
      if (!isPositive(ratioValue)) {
        return "-";
      }

      if (Math.abs(ratioValue - referenceRatio) < 0.001) {
        return "Matches 16:9";
      }

      return ratioValue > referenceRatio ? "Wider than 16:9" : "Taller than 16:9";
    }
  });

  function parseDimension(rawValue) {
    const value = String(rawValue).trim().replace(/,/g, "");

    if (!value) {
      return null;
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }

    return number;
  }

  function parseRatio(rawValue) {
    const number = Number(rawValue);
    return Number.isFinite(number) ? number : null;
  }

  function parseAspectRatio(rawValue) {
    const value = String(rawValue).trim().replace(/\s+/g, "");

    if (!value) {
      return null;
    }

    if (value.includes(":") || value.includes("/")) {
      const separator = value.includes(":") ? ":" : "/";
      const parts = value.split(separator).map(parsePositiveNumber);

      if (parts.length !== 2 || parts.some((part) => part === null)) {
        return null;
      }

      return parts[0] / parts[1];
    }

    return parsePositiveNumber(value);
  }

  function parsePositiveNumber(rawValue) {
    const number = Number(rawValue);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function isPositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatPixelValue(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    return String(Math.round(value));
  }

  function formatDecimalRatio(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    return value.toFixed(2);
  }

  function buildKnownRatios(buttons) {
    const seen = new Set();
    const items = [];

    buttons.forEach((button) => {
      const ratio = parseRatio(button.dataset.ratio);
      const label = button.dataset.ratioLabel;
      const decimalLabel = button.dataset.decimalLabel;
      const key = `${label}|${decimalLabel}`;

      if (!isPositive(ratio) || seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push({ ratio, label, decimalLabel });
    });

    return items;
  }

  function findKnownRatioLabel(ratioValue, ratioOptions) {
    if (!isPositive(ratioValue)) {
      return "";
    }

    let closest = null;

    ratioOptions.forEach((option) => {
      const difference = Math.abs(option.ratio - ratioValue);

      if (!closest || difference < closest.difference) {
        closest = { label: option.label, difference };
      }
    });

    return closest && closest.difference < 0.01 ? closest.label : "";
  }

  function buildReducedRatioLabel(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      return "";
    }

    const divisor = greatestCommonDivisor(width, height);

    if (!divisor) {
      return "";
    }

    const reducedWidth = width / divisor;
    const reducedHeight = height / divisor;

    if (reducedWidth > 99 || reducedHeight > 99) {
      return "";
    }

    return `${reducedWidth}:${reducedHeight}`;
  }

  function buildRatioDetails(ratio, label, decimalLabel) {
    const text = label === decimalLabel ? label : `${label} (${decimalLabel})`;

    return {
      ratio,
      label,
      decimalLabel,
      text,
    };
  }

  function hasUsableRatio(ratioDetails) {
    return Boolean(ratioDetails) && isPositive(ratioDetails.ratio);
  }

  function greatestCommonDivisor(a, b) {
    let left = Math.abs(a);
    let right = Math.abs(b);

    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }

    return left;
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  }
})();

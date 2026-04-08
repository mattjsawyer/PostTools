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
    };

    const clearButton = document.getElementById("aspect-clear-button");
    const ratioFilter = document.getElementById("ratio-filter");
    const customRatioInput = document.getElementById("custom-ratio-value");
    const ratioButtons = Array.from(document.querySelectorAll(".ratio-table-button"));
    const ratioRows = Array.from(document.querySelectorAll("[data-ratio-group]"));
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
      const sourceField = solveFor === "height" ? "width" : "height";
      const solvedField = solveFor;
      const sourceValue = parseDimension(fields[sourceField].input.value);
      let width = solveFor === "height" ? sourceValue : null;
      let height = solveFor === "width" ? sourceValue : null;

      syncSolvedField(solvedField);

      if (solveFor === "height" && isPositive(width) && isPositive(selectedRatio)) {
        height = width / selectedRatio;
        updateSolvedInput("height", height);
      } else if (solveFor === "width" && isPositive(height) && isPositive(selectedRatio)) {
        width = height * selectedRatio;
        updateSolvedInput("width", width);
      } else {
        fields[solvedField].input.value = "";
      }

      updateSelectedRatioSummary();
      updateVisualizationFrame();

      if (!isPositive(width) || !isPositive(height)) {
        showEmptyResult();
        return;
      }

      updateResult(Math.round(width), Math.round(height));
    }

    function syncSolvedField(solvedField) {
      Object.entries(fields).forEach(([fieldName, field]) => {
        const isSolved = fieldName === solvedField;
        field.card.classList.toggle("is-solved", isSolved);
        field.card.classList.toggle("is-input", !isSolved);
        field.input.readOnly = isSolved;
        field.input.setAttribute("aria-readonly", String(isSolved));
      });
    }

    function updateSolvedInput(fieldName, value) {
      fields[fieldName].input.value = formatPixelValue(value);
    }

    function updateSelectedRatioSummary() {
      const ratioText = formatRatioText();
      selectedRatioSummary.textContent = `Selected: ${ratioText}`;
      resultRatio.textContent = ratioText;
    }

    function updateResult(width, height) {
      resultResolution.textContent = `${formatInteger(width)} x ${formatInteger(height)} px`;
      resultComparison.textContent = getComparisonText();
      visualXLabel.textContent = `X ${formatInteger(width)} px`;
      visualYLabel.textContent = `Y ${formatInteger(height)} px`;
      visualFrame.setAttribute(
        "aria-label",
        `16:9 reference with a ${selectedRatioLabel} selected frame at ${formatInteger(width)} by ${formatInteger(height)} pixels.`
      );
    }

    function showEmptyResult() {
      resultResolution.textContent = "-";
      resultComparison.textContent = getComparisonText();
      visualXLabel.textContent = "X -";
      visualYLabel.textContent = "Y -";
      visualFrame.setAttribute(
        "aria-label",
        `16:9 reference with a ${selectedRatioLabel} selected frame. Enter a valid pixel dimension for the calculated resolution.`
      );
    }

    function updateVisualizationFrame() {
      let targetWidth = 100;
      let targetHeight = 100;

      if (!isPositive(selectedRatio)) {
        visualFrame.style.setProperty("--target-width", "100%");
        visualFrame.style.setProperty("--target-height", "100%");
        return;
      }

      const ratioDelta = selectedRatio - referenceRatio;

      if (Math.abs(ratioDelta) < 0.001) {
        targetWidth = 100;
        targetHeight = 100;
      } else if (ratioDelta > 0) {
        targetHeight = (referenceRatio / selectedRatio) * 100;
      } else {
        targetWidth = (selectedRatio / referenceRatio) * 100;
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

    function getSolveFor() {
      const selected = document.querySelector('input[name="solve-for"]:checked');
      return selected ? selected.value : "height";
    }

    function getComparisonText() {
      if (!isPositive(selectedRatio)) {
        return "-";
      }

      if (Math.abs(selectedRatio - referenceRatio) < 0.001) {
        return "Matches 16:9";
      }

      return selectedRatio > referenceRatio ? "Wider than 16:9" : "Taller than 16:9";
    }

    function formatRatioText() {
      if (!isPositive(selectedRatio)) {
        return "Enter a valid aspect ratio";
      }

      if (selectedRatioLabel === selectedDecimalLabel) {
        return selectedRatioLabel;
      }

      return `${selectedRatioLabel} (${selectedDecimalLabel})`;
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

  function formatInteger(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  }
})();

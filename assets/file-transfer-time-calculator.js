(() => {
  const sizeUnits = {
    KB: 1000,
    MB: 1000 ** 2,
    GB: 1000 ** 3,
    TB: 1000 ** 4,
  };

  const speedUnits = {
    MBps: 1000 ** 2,
    GBps: 1000 ** 3,
    Mbps: 1000 ** 2 / 8,
    Gbps: 1000 ** 3 / 8,
  };

  const groupOrder = {
    "Thunderbolt / USB-C": 1,
    USB: 2,
    "NAS / Ethernet": 3,
    "Media / Drives": 4,
  };

  const presets = [
    { group: "Thunderbolt / USB-C", name: "Thunderbolt 1", practicalMBps: 800, spec: "10 Gb/s", note: "Mini DisplayPort-era Thunderbolt planning rate." },
    { group: "Thunderbolt / USB-C", name: "Thunderbolt 2", practicalMBps: 1400, spec: "20 Gb/s", note: "Practical rate for fast external storage over Thunderbolt 2." },
    { group: "Thunderbolt / USB-C", name: "Thunderbolt 3", practicalMBps: 2800, spec: "40 Gb/s", note: "Practical rate for fast storage on a full-bandwidth connection." },
    { group: "Thunderbolt / USB-C", name: "Thunderbolt 4", practicalMBps: 2800, spec: "40 Gb/s", note: "Same 40 Gb/s headline speed as Thunderbolt 3, with stricter platform requirements." },
    { group: "Thunderbolt / USB-C", name: "Thunderbolt 5", practicalMBps: 6000, spec: "80 Gb/s", note: "Planning rate for next-generation storage transfer paths." },
    { group: "USB", name: "USB 2.0", practicalMBps: 35, spec: "480 Mb/s", note: "Useful for legacy card readers and older shuttle drives." },
    { group: "USB", name: "USB 5Gbps / USB 3.x Gen 1", practicalMBps: 400, spec: "5 Gb/s", note: "Common USB-A and USB-C external drive connection." },
    { group: "USB", name: "USB 10Gbps / USB 3.1 Gen 2", practicalMBps: 900, spec: "10 Gb/s", note: "Common modern USB-C SSD and reader connection." },
    { group: "USB", name: "USB 20Gbps / USB 3.2 Gen 2x2", practicalMBps: 1700, spec: "20 Gb/s", note: "Requires compatible host, cable, and device support." },
    { group: "USB", name: "USB 40Gbps / USB4", practicalMBps: 2800, spec: "40 Gb/s", note: "Planning rate for high-speed USB4 storage paths." },
    { group: "USB", name: "USB 80Gbps", practicalMBps: 6000, spec: "80 Gb/s", note: "Planning rate for new high-speed USB transfer paths." },
    { group: "NAS / Ethernet", name: "1 GbE NAS", practicalMBps: 110, spec: "1 GbE", note: "Typical planning rate for a gigabit NAS copy." },
    { group: "NAS / Ethernet", name: "2.5 GbE NAS", practicalMBps: 280, spec: "2.5 GbE", note: "Common small-studio NAS upgrade speed." },
    { group: "NAS / Ethernet", name: "5 GbE NAS", practicalMBps: 560, spec: "5 GbE", note: "Intermediate multi-gig Ethernet planning rate." },
    { group: "NAS / Ethernet", name: "10 GbE NAS", practicalMBps: 1100, spec: "10 GbE", note: "Common direct-attached or switched studio NAS speed." },
    { group: "NAS / Ethernet", name: "25 GbE NAS/SAN", practicalMBps: 2750, spec: "25 GbE", note: "High-speed shared storage planning rate." },
    { group: "Media / Drives", name: "SD UHS-I", practicalMBps: 80, spec: "104 MB/s bus", note: "Planning rate for fast UHS-I SD cards and readers." },
    { group: "Media / Drives", name: "SD UHS-II", practicalMBps: 250, spec: "312 MB/s bus", note: "Planning rate for fast UHS-II SD offloads." },
    { group: "Media / Drives", name: "SD Express PCIe x1", practicalMBps: 800, spec: "up to 985 MB/s class", note: "Planning rate for SD Express cards and readers." },
    { group: "Media / Drives", name: "CFast 2.0", practicalMBps: 500, spec: "SATA 6 Gb/s", note: "Planning rate for CFast camera card offloads." },
    { group: "Media / Drives", name: "CFexpress Type A 2.0", practicalMBps: 800, spec: "PCIe Gen3 x1", note: "Planning rate for CFexpress Type A offloads." },
    { group: "Media / Drives", name: "CFexpress Type B 2.0", practicalMBps: 1600, spec: "PCIe Gen3 x2", note: "Planning rate for CFexpress Type B 2.0 cards." },
    { group: "Media / Drives", name: "CFexpress Type B 4.0", practicalMBps: 3200, spec: "PCIe Gen4 x2", note: "Planning rate for newer CFexpress Type B 4.0 cards." },
    { group: "Media / Drives", name: "SATA SSD", practicalMBps: 500, spec: "SATA 6 Gb/s", note: "Practical rate for a healthy SATA SSD." },
    { group: "Media / Drives", name: "7200 rpm HDD", practicalMBps: 180, spec: "drive-limited", note: "Planning rate for a single spinning hard drive." },
    { group: "Media / Drives", name: "NVMe PCIe 3.0 SSD", practicalMBps: 3000, spec: "PCIe 3.0 class", note: "Planning rate for fast PCIe 3.0 NVMe storage." },
    { group: "Media / Drives", name: "NVMe PCIe 4.0 SSD", practicalMBps: 5500, spec: "PCIe 4.0 class", note: "Planning rate for fast PCIe 4.0 NVMe storage." },
  ].map((preset, index) => ({
    ...preset,
    id: `transfer-preset-${index}`,
  })).sort(sortPresets);

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("transfer-form");

    if (!form) {
      return;
    }

    const sizeInput = document.getElementById("transfer-size-value");
    const sizeUnit = document.getElementById("transfer-size-unit");
    const speedInput = document.getElementById("transfer-speed-value");
    const speedUnit = document.getElementById("transfer-speed-unit");
    const clearButton = document.getElementById("transfer-clear-button");

    const resultHeadline = document.getElementById("transfer-result-headline");
    const resultTime = document.getElementById("transfer-result-time");
    const resultSize = document.getElementById("transfer-result-size");
    const resultSpeed = document.getElementById("transfer-result-speed");
    const resultHourly = document.getElementById("transfer-result-hourly");
    const presetSummary = document.getElementById("transfer-preset-summary");

    const presetGrid = document.getElementById("transfer-preset-grid");
    const presetCount = document.getElementById("transfer-preset-count");
    const presetSearch = document.getElementById("transfer-preset-search");
    const presetGroup = document.getElementById("transfer-preset-group");
    let selectedPresetId = "transfer-preset-11";

    form.addEventListener("submit", (event) => event.preventDefault());
    [sizeInput, sizeUnit].forEach((control) => {
      control.addEventListener("input", calculate);
      control.addEventListener("change", calculate);
    });
    [speedInput, speedUnit].forEach((control) => {
      control.addEventListener("input", clearSelectedPreset);
      control.addEventListener("change", clearSelectedPreset);
    });
    clearButton.addEventListener("click", clearAll);

    setupPresetFilters();
    renderPresets();
    calculate();

    presetGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preset-id]");

      if (!button) {
        return;
      }

      const preset = presets.find((entry) => entry.id === button.dataset.presetId);

      if (!preset) {
        return;
      }

      speedInput.value = formatInputNumber(preset.practicalMBps);
      speedUnit.value = "MBps";
      selectedPresetId = preset.id;
      markSelectedPreset();
      calculate();
    });

    [presetSearch, presetGroup].forEach((control) => {
      control.addEventListener("input", renderPresets);
      control.addEventListener("change", renderPresets);
    });

    function clearAll() {
      sizeInput.value = "";
      speedInput.value = "";
      selectedPresetId = null;
      markSelectedPreset();
      calculate();
    }

    function clearSelectedPreset() {
      selectedPresetId = null;
      markSelectedPreset();
      calculate();
    }

    function calculate() {
      const sizeBytes = parseUnitValue(sizeInput.value, sizeUnit.value, sizeUnits);
      const speedBytesPerSecond = parseUnitValue(speedInput.value, speedUnit.value, speedUnits);

      if (!isPositive(sizeBytes) || !isPositive(speedBytesPerSecond)) {
        showEmptyResult();
        return;
      }

      const seconds = sizeBytes / speedBytesPerSecond;
      resultHeadline.textContent = `Transfer time: ${formatDuration(seconds)}`;
      resultTime.textContent = formatDuration(seconds);
      resultSize.textContent = formatSize(sizeBytes);
      resultSpeed.textContent = formatDataRate(speedBytesPerSecond);
      resultHourly.textContent = `${formatSize(speedBytesPerSecond * 3600)} per hour`;
      updatePresetSummary();
    }

    function showEmptyResult() {
      resultHeadline.textContent = "Enter a valid file size and transfer speed";
      resultTime.textContent = "-";
      resultSize.textContent = "-";
      resultSpeed.textContent = "-";
      resultHourly.textContent = "-";
      updatePresetSummary();
    }

    function updatePresetSummary() {
      const preset = presets.find((entry) => entry.id === selectedPresetId);
      presetSummary.textContent = preset
        ? `Using practical preset: ${preset.name} (${formatDataRate(preset.practicalMBps * 1000 ** 2)}).`
        : "";
    }

    function setupPresetFilters() {
      fillSelect(presetGroup, "All interface groups", uniqueValues(presets, "group").sort(sortGroups));
    }

    function renderPresets() {
      const query = presetSearch.value.trim().toLowerCase();
      const group = presetGroup.value;
      const matches = presets.filter((preset) => {
        const haystack = [
          preset.group,
          preset.name,
          preset.spec,
          preset.note,
        ].join(" ").toLowerCase();

        return (!query || haystack.includes(query))
          && (!group || preset.group === group);
      });

      presetGrid.textContent = "";
      presetCount.textContent = `${matches.length} preset${matches.length === 1 ? "" : "s"} found.`;

      if (matches.length === 0) {
        const empty = document.createElement("p");
        empty.className = "preset-empty";
        empty.textContent = "No presets matched those filters.";
        presetGrid.append(empty);
        return;
      }

      matches.forEach((preset) => {
        presetGrid.append(createPresetCard(preset));
      });
    }

    function createPresetCard(preset) {
      const card = document.createElement("article");
      card.className = "preset-card";

      const header = document.createElement("div");
      header.className = "preset-card-header";

      const family = document.createElement("p");
      family.className = "preset-family";
      family.textContent = preset.group;

      const title = document.createElement("h3");
      title.textContent = preset.name;

      const meta = document.createElement("p");
      meta.textContent = preset.note;

      header.append(family, title, meta);

      const metrics = document.createElement("dl");
      metrics.className = "preset-metrics";
      metrics.append(
        createMetric("Practical", formatDataRate(preset.practicalMBps * 1000 ** 2)),
        createMetric("Reference", preset.spec)
      );

      const button = document.createElement("button");
      button.className = "button preset-button";
      button.type = "button";
      button.dataset.presetId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === selectedPresetId));
      button.classList.toggle("is-selected", preset.id === selectedPresetId);
      button.textContent = preset.id === selectedPresetId ? "Speed applied" : "Use speed";

      card.append(header, metrics, button);
      return card;
    }

    function createMetric(label, value) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");

      term.textContent = label;
      detail.textContent = value;
      wrapper.append(term, detail);
      return wrapper;
    }

    function markSelectedPreset() {
      const buttons = presetGrid.querySelectorAll("[data-preset-id]");

      buttons.forEach((button) => {
        const isSelected = button.dataset.presetId === selectedPresetId;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
        button.textContent = isSelected ? "Speed applied" : "Use speed";
      });
    }
  });

  function parseUnitValue(rawValue, unit, units) {
    const number = parseDecimal(rawValue);
    return number === null ? null : number * units[unit];
  }

  function parseDecimal(rawValue) {
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

  function isPositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function fillSelect(select, label, options) {
    select.textContent = "";

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = label;
    select.append(allOption);

    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option;
      item.textContent = option;
      select.append(item);
    });
  }

  function uniqueValues(items, key) {
    return [...new Set(items.map((item) => item[key]))].filter(Boolean).sort();
  }

  function sortGroups(a, b) {
    return (groupOrder[a] || 99) - (groupOrder[b] || 99);
  }

  function sortPresets(a, b) {
    return sortGroups(a.group, b.group)
      || a.practicalMBps - b.practicalMBps
      || a.name.localeCompare(b.name);
  }

  function roundNumber(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatInputNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    return String(roundNumber(value, 2));
  }

  function formatNumber(value) {
    const abs = Math.abs(value);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 10 ? 2 : 3;

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
    }).format(value);
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) {
      return "-";
    }

    if (bytes >= 1000 ** 4) {
      return `${formatNumber(bytes / 1000 ** 4)} TB`;
    }

    if (bytes >= 1000 ** 3) {
      return `${formatNumber(bytes / 1000 ** 3)} GB`;
    }

    if (bytes >= 1000 ** 2) {
      return `${formatNumber(bytes / 1000 ** 2)} MB`;
    }

    return `${formatNumber(bytes / 1000)} KB`;
  }

  function formatDataRate(bytesPerSecond) {
    if (!Number.isFinite(bytesPerSecond)) {
      return "-";
    }

    if (bytesPerSecond >= 1000 ** 3) {
      return `${formatNumber(bytesPerSecond / 1000 ** 3)} GB/s`;
    }

    if (bytesPerSecond >= 1000 ** 2) {
      return `${formatNumber(bytesPerSecond / 1000 ** 2)} MB/s`;
    }

    return `${formatNumber(bytesPerSecond / 1000)} KB/s`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) {
      return "-";
    }

    if (seconds < 60) {
      return `${formatNumber(seconds)} sec`;
    }

    const totalSeconds = Math.round(seconds);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (days > 0) {
      return `${days} ${days === 1 ? "day" : "days"} ${hours} hr ${minutes} min ${remainingSeconds} sec`;
    }

    if (hours > 0) {
      return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
    }

    return `${minutes} min ${remainingSeconds} sec`;
  }
})();

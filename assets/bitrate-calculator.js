(() => {
  const durationUnits = {
    seconds: 1,
    minutes: 60,
    hours: 3600,
  };

  const sizeUnits = {
    KB: 1000,
    MB: 1000 ** 2,
    GB: 1000 ** 3,
    TB: 1000 ** 4,
  };

  const bitrateUnits = {
    Kbps: 1000,
    Mbps: 1000 ** 2,
    Gbps: 1000 ** 3,
  };

  const resolutionOrder = {
    HD: 1,
    "2K": 2,
    UHD: 3,
    "4K": 4,
    "6K": 5,
    "8K": 6,
  };

  const presets = buildPresets();

  document.addEventListener("DOMContentLoaded", () => {
    const fields = {
      duration: {
        card: document.querySelector('[data-field="duration"]'),
        input: document.getElementById("duration-value"),
        unit: document.getElementById("duration-unit"),
      },
      size: {
        card: document.querySelector('[data-field="size"]'),
        input: document.getElementById("size-value"),
        unit: document.getElementById("size-unit"),
      },
      bitrate: {
        card: document.querySelector('[data-field="bitrate"]'),
        input: document.getElementById("bitrate-value"),
        unit: document.getElementById("bitrate-unit"),
      },
    };

    const form = document.getElementById("bitrate-form");
    const clearButton = document.getElementById("clear-button");
    const audioEnabled = document.getElementById("audio-enabled");
    const audioInput = document.getElementById("audio-value");
    const audioUnit = document.getElementById("audio-unit");
    const resultHeadline = document.getElementById("result-headline");
    const resultDuration = document.getElementById("result-duration");
    const resultSize = document.getElementById("result-size");
    const resultBitrate = document.getElementById("result-bitrate");
    const resultHourly = document.getElementById("result-hourly");
    const audioSummary = document.getElementById("audio-summary");

    const presetGrid = document.getElementById("preset-grid");
    const presetCount = document.getElementById("preset-count");
    const presetSearch = document.getElementById("preset-search");
    const presetFamily = document.getElementById("preset-family");
    const presetResolution = document.getElementById("preset-resolution");
    const presetFps = document.getElementById("preset-fps");
    let selectedPresetId = null;

    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", () => {
      syncAudioControls();
      calculate();
    });
    form.addEventListener("change", () => {
      syncAudioControls();
      calculate();
    });
    clearButton.addEventListener("click", clearAll);

    setupPresetFilters();
    syncAudioControls();
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

      fields.bitrate.input.value = formatInputNumber(preset.bitrateMbps);
      fields.bitrate.unit.value = "Mbps";
      selectedPresetId = preset.id;

      if (getSolveFor() === "bitrate") {
        setSolveFor("size");
      }

      markSelectedPreset();
      calculate();
    });

    [presetSearch, presetFamily, presetResolution, presetFps].forEach((control) => {
      control.addEventListener("input", renderPresets);
      control.addEventListener("change", renderPresets);
    });

    function clearAll() {
      Object.values(fields).forEach((field) => {
        field.input.value = "";
      });

      audioInput.value = "";
      audioEnabled.checked = false;
      selectedPresetId = null;
      syncAudioControls();
      markSelectedPreset();
      calculate();
    }

    function calculate() {
      const solveFor = getSolveFor();
      syncSolvedField(solveFor);

      let durationSeconds = solveFor === "duration" ? null : parseDuration(fields.duration.input.value, fields.duration.unit.value);
      let sizeBytes = solveFor === "size" ? null : parseUnitValue(fields.size.input.value, fields.size.unit.value, sizeUnits);
      let bitrateBps = solveFor === "bitrate" ? null : parseUnitValue(fields.bitrate.input.value, fields.bitrate.unit.value, bitrateUnits);

      if (solveFor === "bitrate" && isPositive(durationSeconds) && isPositive(sizeBytes)) {
        bitrateBps = (sizeBytes * 8) / durationSeconds;
        updateSolvedInput("bitrate", bitrateBps);
      } else if (solveFor === "size" && isPositive(durationSeconds) && isPositive(bitrateBps)) {
        sizeBytes = (bitrateBps * durationSeconds) / 8;
        updateSolvedInput("size", sizeBytes);
      } else if (solveFor === "duration" && isPositive(sizeBytes) && isPositive(bitrateBps)) {
        durationSeconds = (sizeBytes * 8) / bitrateBps;
        updateSolvedInput("duration", durationSeconds);
      }

      if (!isPositive(durationSeconds) || !isPositive(sizeBytes) || !isPositive(bitrateBps)) {
        showEmptyResult();
        return;
      }

      updateResult(solveFor, durationSeconds, sizeBytes, bitrateBps);
    }

    function syncSolvedField(solveFor) {
      Object.entries(fields).forEach(([fieldName, field]) => {
        const isSolved = fieldName === solveFor;
        field.card.classList.toggle("is-solved", isSolved);
        field.input.readOnly = isSolved;
        field.input.setAttribute("aria-readonly", String(isSolved));
      });
    }

    function syncAudioControls() {
      const enabled = audioEnabled.checked;
      audioInput.disabled = !enabled;
      audioUnit.disabled = !enabled;
    }

    function updateSolvedInput(fieldName, value) {
      if (fieldName === "duration") {
        fields.duration.input.value = formatInputNumber(value / durationUnits[fields.duration.unit.value]);
      }

      if (fieldName === "size") {
        fields.size.input.value = formatInputNumber(value / sizeUnits[fields.size.unit.value]);
      }

      if (fieldName === "bitrate") {
        fields.bitrate.input.value = formatInputNumber(value / bitrateUnits[fields.bitrate.unit.value]);
      }
    }

    function updateResult(solveFor, durationSeconds, sizeBytes, bitrateBps) {
      const resultLabels = {
        duration: `Duration: ${formatDuration(durationSeconds)}`,
        size: `File size: ${formatSize(sizeBytes)}`,
        bitrate: `Bitrate: ${formatBitrate(bitrateBps)}`,
      };

      resultHeadline.textContent = resultLabels[solveFor];
      resultDuration.textContent = formatDuration(durationSeconds);
      resultSize.textContent = formatSize(sizeBytes);
      resultBitrate.textContent = formatBitrate(bitrateBps);
      resultHourly.textContent = `${formatSize((bitrateBps * 3600) / 8)} per hour`;

      if (!audioEnabled.checked) {
        audioSummary.textContent = "";
        return;
      }

      const audioBps = parseUnitValue(audioInput.value, audioUnit.value, bitrateUnits);

      if (!isPositive(audioBps)) {
        audioSummary.textContent = "";
        return;
      }

      const videoBudget = bitrateBps - audioBps;

      if (videoBudget > 0) {
        audioSummary.textContent = `Video budget after audio: ${formatBitrate(videoBudget)}.`;
      } else {
        audioSummary.textContent = "Audio allowance is greater than or equal to the total bitrate.";
      }
    }

    function showEmptyResult() {
      resultHeadline.textContent = "Enter two valid known values";
      resultDuration.textContent = "-";
      resultSize.textContent = "-";
      resultBitrate.textContent = "-";
      resultHourly.textContent = "-";
      audioSummary.textContent = "";
    }

    function markSelectedPreset() {
      const buttons = presetGrid.querySelectorAll("[data-preset-id]");

      buttons.forEach((button) => {
        const isSelected = button.dataset.presetId === selectedPresetId;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
        button.textContent = isSelected ? "Bitrate applied" : "Use bitrate";
      });
    }

    function getSolveFor() {
      const selected = document.querySelector('input[name="solve-for"]:checked');
      return selected ? selected.value : "bitrate";
    }

    function setSolveFor(value) {
      const input = document.querySelector(`input[name="solve-for"][value="${value}"]`);

      if (input) {
        input.checked = true;
      }
    }

    function setupPresetFilters() {
      fillSelect(presetFamily, "All codec families", uniqueValues(presets, "family"));
      fillSelect(presetResolution, "All resolutions", uniqueValues(presets, "resolutionGroup").sort(sortResolutionGroups));
      fillSelect(presetFps, "All frame rates", uniqueValues(presets, "fps").sort((a, b) => Number(a) - Number(b)));
    }

    function renderPresets() {
      const query = presetSearch.value.trim().toLowerCase();
      const family = presetFamily.value;
      const resolution = presetResolution.value;
      const fps = presetFps.value;
      const maxVisible = 48;
      const isInitialView = !query && !family && !resolution && !fps;

      const matches = presets.filter((preset) => {
        const haystack = [
          preset.family,
          preset.codec,
          preset.camera || "",
          preset.resolution,
          preset.dimensions,
          preset.fps,
          preset.note,
        ].join(" ").toLowerCase();

        return (!query || haystack.includes(query))
          && (!family || preset.family === family)
          && (!resolution || preset.resolutionGroup === resolution)
          && (!fps || preset.fps === fps);
      });

      const visiblePresets = isInitialView
        ? matches.filter((preset) => preset.featured).slice(0, maxVisible)
        : matches.slice(0, maxVisible);

      presetGrid.textContent = "";
      presetCount.textContent = isInitialView
        ? `Showing ${visiblePresets.length} popular presets. Use filters for all ${matches.length} references.`
        : matches.length > maxVisible
        ? `Showing ${maxVisible} of ${matches.length} presets. Refine the filters for a shorter list.`
        : `${matches.length} preset${matches.length === 1 ? "" : "s"} found.`;

      if (visiblePresets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "preset-empty";
        empty.textContent = "No presets matched those filters.";
        presetGrid.append(empty);
        return;
      }

      visiblePresets.forEach((preset) => {
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
      family.textContent = preset.family;

      const title = document.createElement("h3");
      title.textContent = preset.camera ? `${preset.camera} ${preset.codec}` : preset.codec;

      const meta = document.createElement("p");
      meta.textContent = `${preset.resolution} (${preset.dimensions}) at ${preset.fps} fps`;

      header.append(family, title, meta);

      const metrics = document.createElement("dl");
      metrics.className = "preset-metrics";
      metrics.append(
        createMetric("Rate", formatBitrate(preset.bitrateMbps * 1000 ** 2)),
        createMetric("Storage", `${formatSize((preset.bitrateMbps * 1000 ** 2 * 3600) / 8)}/hr`)
      );

      const note = document.createElement("p");
      note.className = "preset-note";
      note.textContent = preset.note;

      const button = document.createElement("button");
      button.className = "button preset-button";
      button.type = "button";
      button.dataset.presetId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === selectedPresetId));
      button.classList.toggle("is-selected", preset.id === selectedPresetId);
      button.textContent = preset.id === selectedPresetId ? "Bitrate applied" : "Use bitrate";

      card.append(header, metrics, note, button);
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
  });

  function buildPresets() {
    const output = [];

    addProResPresets(output);
    addDnxhrPresets(output);
    addCanonPresets(output);
    addBrawPresets(output);
    addRedPresets(output);

    return output
      .map((preset, index) => ({
        ...preset,
        id: `preset-${index}`,
        featured: isFeaturedPreset(preset),
        bitrateMbps: roundNumber(preset.bitrateMbps, 3),
      }))
      .sort(sortPresets);
  }

  function addPreset(output, preset) {
    output.push(preset);
  }

  function addProResPresets(output) {
    const codecs = [
      "Apple ProRes 422 Proxy",
      "Apple ProRes 422 LT",
      "Apple ProRes 422",
      "Apple ProRes 422 HQ",
      "Apple ProRes 4444",
      "Apple ProRes 4444 XQ",
    ];

    const rows = [
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "24", rates: [36, 82, 117, 176, 264, 396] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "25", rates: [38, 85, 122, 184, 275, 413] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "30", rates: [45, 102, 147, 220, 330, 495] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "50", rates: [76, 170, 245, 367, 551, 826] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "60", rates: [91, 204, 293, 440, 660, 990] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "24", rates: [145, 328, 471, 707, 1061, 1591] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "25", rates: [151, 342, 492, 737, 1106, 1659] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "30", rates: [182, 410, 589, 884, 1326, 1989] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "50", rates: [303, 684, 983, 1475, 2212, 3318] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "60", rates: [363, 821, 1178, 1768, 2652, 3977] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "24", rates: [155, 350, 503, 754, 1131, 1697] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "25", rates: [162, 365, 524, 786, 1180, 1769] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "30", rates: [194, 437, 629, 943, 1414, 2121] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "50", rates: [323, 730, 1049, 1573, 2359, 3539] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "60", rates: [388, 875, 1257, 1886, 2828, 4242] },
      { resolution: "6K", resolutionGroup: "6K", dimensions: "6144 x 3240", fps: "24", rates: [350, 788, 1131, 1697, 2545, 3818] },
      { resolution: "6K", resolutionGroup: "6K", dimensions: "6144 x 3240", fps: "25", rates: [365, 821, 1180, 1769, 2654, 3981] },
      { resolution: "6K", resolutionGroup: "6K", dimensions: "6144 x 3240", fps: "30", rates: [437, 985, 1414, 2121, 3182, 4772] },
      { resolution: "6K", resolutionGroup: "6K", dimensions: "6144 x 3240", fps: "50", rates: [730, 1643, 2359, 3539, 5308, 7962] },
      { resolution: "6K", resolutionGroup: "6K", dimensions: "6144 x 3240", fps: "60", rates: [875, 1969, 2828, 4242, 6364, 9545] },
      { resolution: "8K", resolutionGroup: "8K", dimensions: "8192 x 4320", fps: "24", rates: [622, 1400, 2011, 3017, 4525, 6788] },
      { resolution: "8K", resolutionGroup: "8K", dimensions: "8192 x 4320", fps: "25", rates: [649, 1460, 2097, 3146, 4719, 7078] },
      { resolution: "8K", resolutionGroup: "8K", dimensions: "8192 x 4320", fps: "30", rates: [778, 1750, 2514, 3771, 5657, 8485] },
      { resolution: "8K", resolutionGroup: "8K", dimensions: "8192 x 4320", fps: "50", rates: [1298, 2920, 4194, 6291, 9437, 14156] },
      { resolution: "8K", resolutionGroup: "8K", dimensions: "8192 x 4320", fps: "60", rates: [1556, 3500, 5028, 7542, 11313, 16970] },
    ];

    rows.forEach((row) => {
      row.rates.forEach((bitrateMbps, index) => {
        addPreset(output, {
          family: "Apple ProRes",
          codec: codecs[index],
          resolution: row.resolution,
          resolutionGroup: row.resolutionGroup,
          dimensions: row.dimensions,
          fps: row.fps,
          bitrateMbps,
          note: "Apple target data rate.",
        });
      });
    });
  }

  function addDnxhrPresets(output) {
    const codecs = [
      "Avid DNxHR LB",
      "Avid DNxHR SQ",
      "Avid DNxHR HQ",
      "Avid DNxHR HQX",
      "Avid DNxHR 444",
    ];

    const rows = [
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "23.976", rates: [4.31, 13.77, 20.79, 20.79, 41.68] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "25", rates: [4.49, 14.36, 21.68, 21.68, 43.46] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "29.97", rates: [5.39, 17.21, 25.99, 25.99, 52.10] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "50", rates: [8.98, 28.71, 43.36, 43.36, 86.91] },
      { resolution: "HD 1080", resolutionGroup: "HD", dimensions: "1920 x 1080", fps: "59.94", rates: [10.77, 34.42, 51.98, 51.98, 104.19] },
      { resolution: "2K", resolutionGroup: "2K", dimensions: "2048 x 1080", fps: "23.976", rates: [4.59, 14.70, 22.20, 22.20, 44.39] },
      { resolution: "2K", resolutionGroup: "2K", dimensions: "2048 x 1080", fps: "25", rates: [4.79, 15.33, 23.14, 23.14, 46.29] },
      { resolution: "2K", resolutionGroup: "2K", dimensions: "2048 x 1080", fps: "29.97", rates: [5.74, 18.38, 27.75, 27.75, 55.49] },
      { resolution: "2K", resolutionGroup: "2K", dimensions: "2048 x 1080", fps: "50", rates: [9.57, 30.66, 46.29, 46.29, 92.58] },
      { resolution: "2K", resolutionGroup: "2K", dimensions: "2048 x 1080", fps: "59.94", rates: [11.47, 36.76, 55.49, 55.49, 110.98] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "23.976", rates: [17.14, 55.07, 83.26, 83.26, 166.61] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "25", rates: [17.87, 57.42, 86.82, 86.82, 173.73] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "29.97", rates: [21.42, 68.84, 104.08, 104.08, 208.27] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "50", rates: [35.74, 114.84, 173.63, 173.63, 347.46] },
      { resolution: "UHD", resolutionGroup: "UHD", dimensions: "3840 x 2160", fps: "59.94", rates: [42.85, 137.67, 208.15, 208.15, 416.54] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "23.976", rates: [18.26, 58.72, 88.88, 88.88, 177.67] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "25", rates: [19.04, 61.23, 92.68, 92.68, 185.25] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "29.97", rates: [22.83, 73.40, 111.10, 111.10, 222.08] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "50", rates: [38.09, 122.46, 185.35, 185.35, 370.51] },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", fps: "59.94", rates: [45.66, 146.81, 222.20, 222.20, 444.16] },
    ];

    rows.forEach((row) => {
      row.rates.forEach((rateMbPerSecond, index) => {
        addPreset(output, {
          family: "Avid DNxHR",
          codec: codecs[index],
          resolution: row.resolution,
          resolutionGroup: row.resolutionGroup,
          dimensions: row.dimensions,
          fps: row.fps,
          bitrateMbps: rateMbPerSecond * 8,
          note: "Avid published storage rate converted from MB/s to Mb/s.",
        });
      });
    });
  }

  function addCanonPresets(output) {
    const rows = [
      { camera: "EOS C400 Full Frame", codec: "CRM RAW HQ", resolution: "6K Full Frame", resolutionGroup: "6K", dimensions: "6000 x 3164", rates: { "23.98": 1730, "24": 1730, "25": 1800, "29.97": 2160 } },
      { camera: "EOS C400 Full Frame", codec: "CRM RAW ST", resolution: "6K Full Frame", resolutionGroup: "6K", dimensions: "6000 x 3164", rates: { "23.98": 850, "24": 850, "25": 886, "29.97": 1070, "50": 1780, "59.94": 2130 } },
      { camera: "EOS C400 Full Frame", codec: "CRM RAW LT", resolution: "6K Full Frame", resolutionGroup: "6K", dimensions: "6000 x 3164", rates: { "23.98": 552, "24": 553, "25": 576, "29.97": 690, "50": 1160, "59.94": 1380 } },
      { camera: "EOS C400 Super 35", codec: "CRM RAW HQ", resolution: "4.3K Super 35", resolutionGroup: "4K", dimensions: "4368 x 2304", rates: { "23.98": 915, "24": 916, "25": 954, "29.97": 1150, "50": 1910, "59.94": 2290 } },
      { camera: "EOS C400 Super 35", codec: "CRM RAW ST", resolution: "4.3K Super 35", resolutionGroup: "4K", dimensions: "4368 x 2304", rates: { "23.98": 451, "24": 451, "25": 470, "29.97": 563, "50": 939, "59.94": 1130 } },
      { camera: "EOS C400 Super 35", codec: "CRM RAW LT", resolution: "4.3K Super 35", resolutionGroup: "4K", dimensions: "4368 x 2304", rates: { "23.98": 293, "24": 293, "25": 306, "29.97": 366, "50": 611, "59.94": 732 } },
    ];

    rows.forEach((row) => {
      Object.entries(row.rates).forEach(([fps, bitrateMbps]) => {
        addPreset(output, {
          family: "Canon Cinema RAW Light",
          camera: row.camera,
          codec: row.codec,
          resolution: row.resolution,
          resolutionGroup: row.resolutionGroup,
          dimensions: row.dimensions,
          fps,
          bitrateMbps,
          note: "Canon CRM variable bit rate.",
        });
      });
    });
  }

  function addBrawPresets(output) {
    const rows = [
      { resolution: "6K Open Gate", resolutionGroup: "6K", dimensions: "6048 x 4032", maxFps: 36, rates: { "BRAW 3:1": 370, "BRAW 5:1": 223, "BRAW 8:1": 140, "BRAW 12:1": 94 } },
      { resolution: "6K DCI", resolutionGroup: "6K", dimensions: "6048 x 3200", maxFps: 48, rates: { "BRAW 3:1": 295, "BRAW 5:1": 177, "BRAW 8:1": 111, "BRAW 12:1": 75 } },
      { resolution: "6K 2.4:1", resolutionGroup: "6K", dimensions: "6048 x 2520", maxFps: 60, rates: { "BRAW 3:1": 233, "BRAW 5:1": 140, "BRAW 8:1": 88, "BRAW 12:1": 59 } },
      { resolution: "4K DCI", resolutionGroup: "4K", dimensions: "4096 x 2160", maxFps: 60, rates: { "BRAW 3:1": 136, "BRAW 5:1": 82, "BRAW 8:1": 52, "BRAW 12:1": 35 } },
      { resolution: "HD", resolutionGroup: "HD", dimensions: "1920 x 1080", maxFps: 120, rates: { "BRAW 3:1": 33, "BRAW 5:1": 20, "BRAW 8:1": 13, "BRAW 12:1": 9 } },
    ];

    const frameRates = [24, 25, 30, 50, 60];

    rows.forEach((row) => {
      frameRates
        .filter((fps) => fps <= row.maxFps)
        .forEach((fps) => {
          Object.entries(row.rates).forEach(([codec, rateMbPerSecondAt30]) => {
            addPreset(output, {
              family: "Blackmagic RAW",
              codec,
              resolution: row.resolution,
              resolutionGroup: row.resolutionGroup,
              dimensions: row.dimensions,
              fps: String(fps),
              bitrateMbps: rateMbPerSecondAt30 * 8 * (fps / 30),
              note: fps === 30
                ? "Blackmagic published 30 fps storage rate converted from MB/s to Mb/s."
                : "Scaled from Blackmagic 30 fps constant-bitrate storage rate.",
            });
          });
        });
    });
  }

  function addRedPresets(output) {
    [
      { camera: "V-RAPTOR X 8K VV", codec: "REDCODE RAW LQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 56 },
      { camera: "V-RAPTOR X 8K VV", codec: "REDCODE RAW MQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 35 },
      { camera: "V-RAPTOR X 8K VV", codec: "REDCODE RAW HQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 24 },
      { camera: "KOMODO-X 6K", codec: "REDCODE RAW LQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 102 },
      { camera: "KOMODO-X 6K", codec: "REDCODE RAW MQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 64 },
      { camera: "KOMODO-X 6K", codec: "REDCODE RAW HQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 44 },
    ].forEach((row) => {
      addPreset(output, {
        family: "REDCODE RAW",
        camera: row.camera,
        codec: row.codec,
        resolution: row.resolution,
        resolutionGroup: row.resolutionGroup,
        dimensions: row.dimensions,
        fps: "24",
        bitrateMbps: (660 * 8000) / (row.minutesOn660Gb * 60),
        note: "Estimated from RED published 660 GB recording time at 24 fps.",
      });
    });
  }

  function parseDuration(rawValue, unit) {
    const value = String(rawValue).trim();

    if (!value) {
      return null;
    }

    if (value.includes(":")) {
      const parts = value.split(":").map((part) => parseDecimal(part));

      if (parts.some((part) => part === null) || parts.length < 2 || parts.length > 3) {
        return null;
      }

      if (parts.length === 2) {
        return (parts[0] * 60) + parts[1];
      }

      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }

    const number = parseDecimal(value);
    return number === null ? null : number * durationUnits[unit];
  }

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

    if (!Number.isFinite(number) || number < 0) {
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

  function sortResolutionGroups(a, b) {
    return (resolutionOrder[a] || 99) - (resolutionOrder[b] || 99);
  }

  function isFeaturedPreset(preset) {
    if (preset.family === "Apple ProRes") {
      const isCodec = ["Apple ProRes 422", "Apple ProRes 422 HQ"].includes(preset.codec);
      const isUhd = preset.resolution === "UHD" && ["24", "25", "30", "60"].includes(preset.fps);
      const isDci4k = preset.resolution === "4K DCI" && ["24", "25", "30"].includes(preset.fps);
      return isCodec && (isUhd || isDci4k);
    }

    if (preset.family === "Avid DNxHR") {
      return ["Avid DNxHR HQ", "Avid DNxHR HQX"].includes(preset.codec)
        && preset.resolution === "UHD"
        && ["23.976", "25", "29.97", "50"].includes(preset.fps);
    }

    if (preset.family === "Blackmagic RAW") {
      return ["BRAW 5:1", "BRAW 8:1"].includes(preset.codec)
        && ["6K Open Gate", "6K DCI", "4K DCI"].includes(preset.resolution)
        && ["25", "30"].includes(preset.fps);
    }

    if (preset.family === "Canon Cinema RAW Light") {
      const isFullFrame = preset.camera === "EOS C400 Full Frame";
      const isCommonFps = ["25", "29.97"].includes(preset.fps);
      const isHighFrameRate = ["CRM RAW ST", "CRM RAW LT"].includes(preset.codec) && preset.fps === "50";
      return isFullFrame && (isCommonFps || isHighFrameRate);
    }

    return preset.family === "REDCODE RAW";
  }

  function sortPresets(a, b) {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return a.family.localeCompare(b.family)
      || sortResolutionGroups(a.resolutionGroup, b.resolutionGroup)
      || Number(a.fps) - Number(b.fps)
      || a.codec.localeCompare(b.codec)
      || a.resolution.localeCompare(b.resolution);
  }

  function roundNumber(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatInputNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    const abs = Math.abs(value);
    const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3;
    return String(roundNumber(value, digits));
  }

  function formatNumber(value) {
    const abs = Math.abs(value);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 10 ? 2 : 3;

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
    }).format(value);
  }

  function formatBitrate(bitsPerSecond) {
    if (!Number.isFinite(bitsPerSecond)) {
      return "-";
    }

    if (bitsPerSecond >= 1000 ** 3) {
      return `${formatNumber(bitsPerSecond / 1000 ** 3)} Gb/s`;
    }

    if (bitsPerSecond >= 1000 ** 2) {
      return `${formatNumber(bitsPerSecond / 1000 ** 2)} Mb/s`;
    }

    return `${formatNumber(bitsPerSecond / 1000)} kb/s`;
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

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) {
      return "-";
    }

    if (seconds < 60) {
      return `${formatNumber(seconds)} sec`;
    }

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
    }

    return `${minutes} min ${remainingSeconds} sec`;
  }
})();

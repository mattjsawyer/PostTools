(() => {
  const VERIFIED_ON = "2026-04-09";

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

  const sourceMap = buildSourceMap();
  const presets = buildPresets();

  document.addEventListener("DOMContentLoaded", () => {
    const fields = {
      size: {
        card: document.querySelector('[data-field="size"]'),
        input: document.getElementById("size-value"),
        unit: document.getElementById("size-unit"),
      },
      duration: {
        card: document.querySelector('[data-field="duration"]'),
        input: document.getElementById("duration-value"),
        unit: document.getElementById("duration-unit"),
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
    const presetBrand = document.getElementById("preset-brand");
    const presetFamily = document.getElementById("preset-family");
    const presetResolution = document.getElementById("preset-resolution");
    const presetFps = document.getElementById("preset-fps");
    const sourceList = document.getElementById("source-list");
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
    renderSourceList();
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

    [presetSearch, presetBrand, presetFamily, presetResolution, presetFps].forEach((control) => {
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

      let sizeBytes = solveFor === "size" ? null : parseUnitValue(fields.size.input.value, fields.size.unit.value, sizeUnits);
      let durationSeconds = solveFor === "duration" ? null : parseDuration(fields.duration.input.value, fields.duration.unit.value);
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
      fillSelect(presetBrand, "All brands", uniqueValues(presets, "brand").sort());
      fillSelect(presetFamily, "All codec families", uniqueValues(presets, "family").sort());
      fillSelect(presetResolution, "All resolutions", uniqueValues(presets, "resolutionGroup").sort(sortResolutionGroups));
      fillSelect(presetFps, "All frame rates", uniqueValues(presets, "fps").sort(sortFrameRates));
    }

    function renderSourceList() {
      sourceList.textContent = "";

      const usedSourceKeys = Object.keys(sourceMap).filter((key) => presets.some((preset) => preset.sourceKey === key));

      usedSourceKeys.forEach((key) => {
        const source = sourceMap[key];

        if (!source) {
          return;
        }

        const item = document.createElement("li");
        const link = document.createElement("a");
        const note = document.createElement("span");

        link.href = source.url;
        link.textContent = source.label;
        link.target = "_blank";
        link.rel = "noreferrer";

        note.className = "source-note";
        note.textContent = `${source.note} Verified ${formatVerifiedDate(VERIFIED_ON)}.`;

        item.append(link, note);
        sourceList.append(item);
      });
    }

    function renderPresets() {
      const query = presetSearch.value.trim().toLowerCase();
      const brand = presetBrand.value;
      const family = presetFamily.value;
      const resolution = presetResolution.value;
      const fps = presetFps.value;
      const maxVisible = 48;
      const isInitialView = !query && !brand && !family && !resolution && !fps;

      const matches = presets.filter((preset) => {
        const haystack = [
          preset.brand,
          preset.model,
          preset.family,
          preset.codec,
          preset.resolution,
          preset.dimensions,
          preset.fps,
          preset.note,
        ].join(" ").toLowerCase();

        return (!query || haystack.includes(query))
          && (!brand || preset.brand === brand)
          && (!family || preset.family === family)
          && (!resolution || preset.resolutionGroup === resolution)
          && (!fps || preset.fps === fps);
      });

      const visiblePresets = isInitialView
        ? matches.filter((preset) => preset.featured).slice(0, maxVisible)
        : matches.slice(0, maxVisible);

      presetGrid.textContent = "";
      presetCount.textContent = isInitialView
        ? `Showing ${visiblePresets.length} popular presets. Use filters for all ${presets.length} references.`
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
      card.classList.toggle("is-max-cap", preset.presetType === "max-cap");

      const header = document.createElement("div");
      header.className = "preset-card-header";

      const topLine = document.createElement("div");
      topLine.className = "preset-topline";

      const brandLabel = document.createElement("p");
      brandLabel.className = "preset-brand";
      brandLabel.textContent = preset.brand;

      topLine.append(brandLabel);

      if (preset.presetType === "max-cap") {
        const tag = document.createElement("span");
        tag.className = "preset-tag is-max-cap";
        tag.textContent = "Max camera bitrate";
        topLine.append(tag);
      }

      const family = document.createElement("p");
      family.className = "preset-family";
      family.textContent = preset.family;

      const title = document.createElement("h3");
      title.textContent = preset.model || preset.codec;

      const codec = document.createElement("p");
      codec.className = "preset-codec";
      codec.textContent = preset.model ? preset.codec : "";

      const meta = document.createElement("p");
      meta.textContent = buildPresetMeta(preset);

      header.append(topLine, family, title);

      if (preset.model) {
        header.append(codec);
      }

      header.append(meta);

      const metrics = document.createElement("dl");
      metrics.className = "preset-metrics";
      metrics.append(
        createMetric(preset.presetType === "max-cap" ? "Max rate" : "Rate", formatBitrate(preset.bitrateMbps * 1000 ** 2)),
        createMetric(preset.presetType === "max-cap" ? "Max storage" : "Storage", `${formatSize((preset.bitrateMbps * 1000 ** 2 * 3600) / 8)}/hr`)
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

    function buildPresetMeta(preset) {
      const parts = [preset.resolution];

      if (preset.dimensions) {
        parts.push(preset.dimensions);
      }

      parts.push(preset.fps === "Varies" ? "Varies" : `${preset.fps} fps`);
      return parts.join(" | ");
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

  function buildSourceMap() {
    return {
      "apple-prores": {
        label: "Apple ProRes White Paper",
        url: "https://www.apple.com/final-cut-pro/docs/Apple_ProRes_White_Paper.pdf",
        note: "Official Apple target data-rate reference for the ProRes family.",
      },
      "avid-dnxhr": {
        label: "Avid DNxHR Codec Bandwidth Specifications",
        url: "https://avidtech.my.salesforce-sites.com/pkb/articles/en_US/Knowledge/DNxHR-Codec-Bandwidth-Specifications",
        note: "Official Avid storage-rate reference converted from MB/s to Mb/s.",
      },
      "canon-c400": {
        label: "Canon EOS C400 Recording Formats",
        url: "https://www.canon.com.cn/product/eosc400/record1.html",
        note: "Official Canon C400 Cinema RAW Light bitrate table.",
      },
      "canon-r1": {
        label: "Canon EOS R1 Manual: Bitrate Table",
        url: "https://cam.start.canon/en/C018/manual/html/UG-10_Reference_0090.html",
        note: "Official Canon EOS R1 movie bitrate table used for grouped RAW and 4K Fine modes.",
      },
      "canon-r5ii": {
        label: "Canon EOS R5 Mark II Manual: Specifications",
        url: "https://cam.start.canon/en/C017/manual/html/UG-10_Reference_0110.html",
        note: "Official Canon EOS R5 Mark II 8K bitrate table.",
      },
      "canon-r6ii": {
        label: "Canon EOS R6 Mark II Manual: Specifications",
        url: "https://cam.start.canon/en/C012/manual/html/UG-10_Reference_0100.html",
        note: "Official Canon EOS R6 Mark II movie bitrate table.",
      },
      "canon-r7": {
        label: "Canon EOS R7 Manual: Specifications",
        url: "https://cam.start.canon/en/C005/manual/html/UG-10_Reference_0100.html",
        note: "Official Canon EOS R7 movie bitrate table.",
      },
      "canon-c80": {
        label: "Canon EOS C80 Specifications",
        url: "https://www.usa.canon.com/shop/p/eos-c80",
        note: "Official Canon EOS C80 internal recording format specifications.",
      },
      "sony-fx3": {
        label: "Sony FX3 / FX3A Specifications",
        url: "https://www.sony.com/electronics/support/camcorders-and-video-cameras-interchangeable-lens-camcorders/ilme-fx3a/specifications",
        note: "Official Sony support bitrate table for FX3 series recording formats.",
      },
      "sony-fx30": {
        label: "Sony FX30 Specifications",
        url: "https://www.sony.com/electronics/support/camcorders-and-video-cameras-interchangeable-lens-camcorders/ilme-fx30b/specifications",
        note: "Official Sony support bitrate table for FX30 recording formats.",
      },
      "sony-fx6": {
        label: "Sony FX6 Specifications",
        url: "https://www.sony.com/electronics/support/camcorders-interchangeable-lens-camcorders/ilme-fx6v/specifications",
        note: "Official Sony support bitrate table for FX6 internal codecs.",
      },
      "sony-a7siii": {
        label: "Sony a7S III Specifications",
        url: "https://www.sony.com/electronics/support/alpha-mirrorless-interchangeable-lens-cameras-ilce-7-series/ilce-7sm3/specifications",
        note: "Official Sony support bitrate table for a7S III recording formats.",
      },
      "sony-a7iv": {
        label: "Sony a7 IV Specifications",
        url: "https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m4/specifications",
        note: "Official Sony support bitrate table for a7 IV recording formats.",
      },
      "sony-zve1": {
        label: "Sony ZV-E1 Specifications",
        url: "https://www.sony.com/electronics/support/e-mount-body-zv-e-series/zv-e1/specifications",
        note: "Official Sony support bitrate table for ZV-E1 recording formats.",
      },
      "sony-a1ii": {
        label: "Sony a1 II Specifications",
        url: "https://www.sony.com/electronics/support/e-mount-body-ilce-1-series/ilce-1m2/specifications",
        note: "Official Sony support bitrate table for a1 II 8K and 4K recording formats.",
      },
      "panasonic-gh5ii": {
        label: "Panasonic GH5 II Official Product Page",
        url: "https://www.panasonic.com/global/consumer/lumix/academy/product/gh5ii.html",
        note: "Official Panasonic GH5 II recording-format reference.",
      },
      "panasonic-gh6": {
        label: "Panasonic GH6 Specifications",
        url: "https://www.panasonic.com/ua/consumer/digital-cameras-and-camcorders/digital-cameras/lumix-g-system-cameras/dc-gh6.specs.html",
        note: "Official Panasonic GH6 internal recording specification table.",
      },
      "panasonic-gh7": {
        label: "Panasonic GH7 Official Product Page",
        url: "https://shop.panasonic.com/products/gh7-mirrorless-camera",
        note: "Official Panasonic GH7 recording-format reference including ProRes and ProRes RAW modes.",
      },
      "dji-mini4pro": {
        label: "DJI Mini 4 Pro Specs",
        url: "https://www.dji.com/mini-4-pro/specs",
        note: "Official DJI maximum internal video bitrate specification.",
      },
      "dji-air3s": {
        label: "DJI Air 3S Specs",
        url: "https://www.dji.com/air-3s/specs",
        note: "Official DJI maximum internal video bitrate specification.",
      },
      "dji-mavic3pro": {
        label: "DJI Mavic 3 Pro Specs",
        url: "https://www.dji.com/mavic-3-pro/specs",
        note: "Official DJI maximum codec bitrate specifications by camera and codec path.",
      },
      "gopro-hero13": {
        label: "GoPro Camera Compare",
        url: "https://gopro.com/en/us/compare",
        note: "Official GoPro comparison table used for HERO13 maximum video bitrate.",
      },
      "gopro-hero12": {
        label: "GoPro HERO12 Black",
        url: "https://gopro.com/en/us/shop/cameras/hero12-black/CHDHX-121-master.html",
        note: "Official GoPro maximum internal video bitrate specification.",
      },
      "gopro-hero11": {
        label: "GoPro HERO11 Black",
        url: "https://gopro.com/en/us/shop/cameras/hero11-black/CHDHX-111-master.html",
        note: "Official GoPro maximum internal video bitrate specification.",
      },
      "arri-data-rate": {
        label: "ARRI Formats and Data Rate Calculator",
        url: "https://www.arri.com/en/learn-help/learn-help-camera-system/tools/formats-and-data-rate-calculator",
        note: "Official ARRI data-rate calculator values captured at 24 fps for the listed formats.",
      },
      "blackmagic-braw": {
        label: "Blackmagic Cinema Camera 6K Tech Specs",
        url: "https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs",
        note: "Official Blackmagic constant-bitrate storage-rate reference.",
      },
      "red-redcode": {
        label: "RED Power of REDCODE",
        url: "https://www.red.com/power-of-red-redcode",
        note: "Official RED recording-time reference used to derive 24 fps planning rates.",
      },
    };
  }

  function buildPresets() {
    const output = [];

    addProResPresets(output);
    addDnxhrPresets(output);
    addCanonPresets(output);
    addSonyPresets(output);
    addPanasonicPresets(output);
    addDjiPresets(output);
    addGoProPresets(output);
    addArriPresets(output);
    addBrawPresets(output);
    addRedPresets(output);

    return output
      .map((preset, index) => ({
        ...preset,
        id: `preset-${index}`,
        featured: preset.featured ?? isFeaturedPreset(preset),
        bitrateMbps: roundNumber(preset.bitrateMbps, 3),
      }))
      .sort(sortPresets);
  }

  function addPreset(output, preset) {
    output.push({
      brand: "",
      model: "",
      family: "",
      codec: "",
      resolution: "",
      resolutionGroup: "",
      dimensions: "",
      fps: "",
      bitrateMbps: 0,
      note: "",
      presetType: "exact",
      sourceKey: "",
      verifiedOn: VERIFIED_ON,
      ...preset,
    });
  }

  function addRateRows(output, base, rates) {
    const { featuredFps, ...shared } = base;

    Object.entries(rates).forEach(([fps, bitrateMbps]) => {
      addPreset(output, {
        ...shared,
        fps,
        bitrateMbps,
        featured: Array.isArray(featuredFps) ? featuredFps.includes(String(fps)) : shared.featured,
      });
    });
  }

  function addMaxCapPreset(output, preset) {
    addPreset(output, {
      presetType: "max-cap",
      resolution: "Multiple modes",
      resolutionGroup: "",
      dimensions: "Mode-dependent",
      fps: "Varies",
      note: "Official maximum camera bitrate; exact mode varies by codec, resolution, and frame rate.",
      ...preset,
    });
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
          brand: "Apple",
          family: "Apple ProRes",
          codec: codecs[index],
          resolution: row.resolution,
          resolutionGroup: row.resolutionGroup,
          dimensions: row.dimensions,
          fps: row.fps,
          bitrateMbps,
          note: "Apple target data rate.",
          sourceKey: "apple-prores",
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
          brand: "Avid",
          family: "Avid DNxHR",
          codec: codecs[index],
          resolution: row.resolution,
          resolutionGroup: row.resolutionGroup,
          dimensions: row.dimensions,
          fps: row.fps,
          bitrateMbps: rateMbPerSecond * 8,
          note: "Avid published storage rate converted from MB/s to Mb/s.",
          sourceKey: "avid-dnxhr",
        });
      });
    });
  }

  function addCanonPresets(output) {
    addCanonC400Presets(output);
    addCanonR1Presets(output);
    addCanonR5MarkIIPresets(output);
    addCanonR6MarkIIPresets(output);
    addCanonR7Presets(output);
    addCanonC80Presets(output);
  }

  function addCanonC400Presets(output) {
    const rows = [
      {
        codec: "CRM RAW HQ",
        resolution: "6K Full Frame",
        resolutionGroup: "6K",
        dimensions: "6000 x 3164",
        note: "Full Frame sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 1730, "24": 1730, "25": 1800, "29.97": 2160 },
      },
      {
        codec: "CRM RAW ST",
        resolution: "6K Full Frame",
        resolutionGroup: "6K",
        dimensions: "6000 x 3164",
        note: "Full Frame sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 850, "24": 850, "25": 886, "29.97": 1070, "50": 1780, "59.94": 2130 },
      },
      {
        codec: "CRM RAW LT",
        resolution: "6K Full Frame",
        resolutionGroup: "6K",
        dimensions: "6000 x 3164",
        note: "Full Frame sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 552, "24": 553, "25": 576, "29.97": 690, "50": 1160, "59.94": 1380 },
      },
      {
        codec: "CRM RAW HQ",
        resolution: "4.3K Super 35",
        resolutionGroup: "4K",
        dimensions: "4368 x 2304",
        note: "Super 35 sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 915, "24": 916, "25": 954, "29.97": 1150, "50": 1910, "59.94": 2290 },
      },
      {
        codec: "CRM RAW ST",
        resolution: "4.3K Super 35",
        resolutionGroup: "4K",
        dimensions: "4368 x 2304",
        note: "Super 35 sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 451, "24": 451, "25": 470, "29.97": 563, "50": 939, "59.94": 1130 },
      },
      {
        codec: "CRM RAW LT",
        resolution: "4.3K Super 35",
        resolutionGroup: "4K",
        dimensions: "4368 x 2304",
        note: "Super 35 sensor mode. Canon CRM variable bit rate.",
        rates: { "23.98": 293, "24": 293, "25": 306, "29.97": 366, "50": 611, "59.94": 732 },
      },
    ];

    rows.forEach((row) => {
      addRateRows(output, {
        brand: "Canon",
        model: "EOS C400",
        family: "Canon Cinema RAW Light",
        codec: row.codec,
        resolution: row.resolution,
        resolutionGroup: row.resolutionGroup,
        dimensions: row.dimensions,
        note: row.note,
        sourceKey: "canon-c400",
      }, row.rates);
    });
  }

  function addCanonR1Presets(output) {
    const base = {
      brand: "Canon",
      model: "EOS R1",
      resolution: "4K Fine / RAW",
      resolutionGroup: "4K",
      dimensions: "DCI/UHD grouped",
      note: "Canon groups RAW, 4K-DCI Fine, and 4K-UHD Fine in one official bitrate table.",
      sourceKey: "canon-r1",
    };

    addRateRows(output, {
      ...base,
      family: "Canon RAW",
      codec: "RAW Standard",
      featuredFps: ["24", "29.97"],
    }, {
      "23.98": 1600,
      "24": 1600,
      "25": 1670,
      "29.97": 2000,
      "50": 2600,
      "59.94": 2600,
    });

    addRateRows(output, {
      ...base,
      family: "Canon RAW",
      codec: "RAW Light",
      featuredFps: ["24", "29.97"],
    }, {
      "23.98": 720,
      "24": 720,
      "25": 750,
      "29.97": 900,
      "50": 1500,
      "59.94": 1800,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC422 10-bit Standard LGOP",
    }, {
      "23.98": 135,
      "24": 135,
      "25": 135,
      "29.97": 135,
      "50": 225,
      "59.94": 225,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-AVC S",
      codec: "XF-AVC S YCC422 10-bit High Quality Intra",
      featuredFps: ["29.97"],
    }, {
      "23.98": 480,
      "24": 480,
      "25": 500,
      "29.97": 600,
      "50": 1000,
      "59.94": 1200,
    });
  }

  function addCanonR5MarkIIPresets(output) {
    const base = {
      brand: "Canon",
      model: "EOS R5 Mark II",
      resolution: "8K",
      resolutionGroup: "8K",
      dimensions: "8192 x 4320",
      note: "Official Canon 8K internal movie bitrate table.",
      sourceKey: "canon-r5ii",
    };

    addRateRows(output, {
      ...base,
      family: "Canon RAW",
      codec: "RAW Standard",
    }, {
      "23.98": 2600,
      "24": 2600,
      "25": 2600,
      "29.97": 2600,
    });

    addRateRows(output, {
      ...base,
      family: "Canon RAW",
      codec: "RAW Light",
      featuredFps: ["25", "29.97"],
    }, {
      "23.98": 1340,
      "24": 1340,
      "25": 1400,
      "29.97": 1670,
      "50": 2600,
      "59.94": 2600,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC422 10-bit High Quality Intra",
    }, {
      "23.98": 1920,
      "24": 1920,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC422 10-bit Standard Intra",
      featuredFps: ["29.97"],
    }, {
      "23.98": 1440,
      "24": 1440,
      "25": 1500,
      "29.97": 1800,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC422 10-bit Light Intra",
    }, {
      "23.98": 960,
      "24": 960,
      "25": 1000,
      "29.97": 1200,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC422 10-bit Standard LGOP",
    }, {
      "23.98": 540,
      "24": 540,
      "25": 540,
      "29.97": 540,
    });

    addRateRows(output, {
      ...base,
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S YCC420 10-bit Standard LGOP",
    }, {
      "23.98": 400,
      "24": 400,
      "25": 400,
      "29.97": 400,
    });
  }

  function addCanonR6MarkIIPresets(output) {
    addRateRows(output, {
      brand: "Canon",
      model: "EOS R6 Mark II",
      family: "Canon Mirrorless",
      codec: "4K UHD IPB Standard",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS R6 Mark II movie bitrate table.",
      sourceKey: "canon-r6ii",
      featuredFps: ["25", "59.94"],
    }, {
      "23.98": 120,
      "25": 120,
      "29.97": 120,
      "50": 230,
      "59.94": 230,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS R6 Mark II",
      family: "Canon Mirrorless",
      codec: "4K UHD IPB Light",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS R6 Mark II movie bitrate table.",
      sourceKey: "canon-r6ii",
    }, {
      "23.98": 60,
      "25": 60,
      "29.97": 60,
      "50": 120,
      "59.94": 120,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS R6 Mark II",
      family: "Canon Mirrorless",
      codec: "4K UHD Time-lapse ALL-I",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS R6 Mark II time-lapse bitrate row.",
      sourceKey: "canon-r6ii",
    }, {
      "25": 470,
      "29.97": 470,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS R6 Mark II",
      family: "Canon Mirrorless",
      codec: "Full HD HFR IPB Standard",
      resolution: "HD 1080",
      resolutionGroup: "HD",
      dimensions: "1920 x 1080",
      note: "Official Canon EOS R6 Mark II high-frame-rate bitrate row.",
      sourceKey: "canon-r6ii",
    }, {
      "100": 120,
      "119.88": 120,
      "150": 180,
      "179.82": 180,
    });
  }

  function addCanonR7Presets(output) {
    addRateRows(output, {
      brand: "Canon",
      model: "EOS R7",
      family: "Canon Mirrorless",
      codec: "4K UHD Fine IPB Standard",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS R7 movie bitrate table.",
      sourceKey: "canon-r7",
      featuredFps: ["25"],
    }, {
      "23.98": 170,
      "25": 170,
      "29.97": 170,
      "50": 340,
      "59.94": 340,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS R7",
      family: "Canon Mirrorless",
      codec: "4K UHD Fine IPB Light",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS R7 movie bitrate table.",
      sourceKey: "canon-r7",
    }, {
      "23.98": 85,
      "25": 85,
      "29.97": 85,
      "50": 170,
      "59.94": 170,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS R7",
      family: "Canon Mirrorless",
      codec: "Full HD HFR IPB Standard",
      resolution: "HD 1080",
      resolutionGroup: "HD",
      dimensions: "1920 x 1080",
      note: "Official Canon EOS R7 high-frame-rate bitrate row.",
      sourceKey: "canon-r7",
    }, {
      "100": 120,
      "119.88": 120,
    });
  }

  function addCanonC80Presets(output) {
    addRateRows(output, {
      brand: "Canon",
      model: "EOS C80",
      family: "Canon XF-HEVC S",
      codec: "XF-HEVC S 4:2:2 10-bit",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Canon EOS C80 internal HEVC bitrate row.",
      sourceKey: "canon-c80",
      featuredFps: ["25"],
    }, {
      "23.98": 135,
      "24": 135,
      "25": 135,
      "29.97": 135,
      "50": 225,
      "59.94": 225,
    });

    addRateRows(output, {
      brand: "Canon",
      model: "EOS C80",
      family: "Canon XF-AVC S",
      codec: "XF-AVC S Intra 4:2:2 10-bit",
      resolution: "4K DCI / UHD",
      resolutionGroup: "4K",
      dimensions: "4096 x 2160 / 3840 x 2160",
      note: "Official Canon EOS C80 internal AVC Intra bitrate row.",
      sourceKey: "canon-c80",
    }, {
      "50": 500,
      "59.94": 600,
    });
  }

  function addSonyPresets(output) {
    addSonyFx3Presets(output);
    addSonyFx30Presets(output);
    addSonyFx6Presets(output);
    addSonyHybridPresets(output, "a7S III", "sony-a7siii");
    addSonyHybridPresets(output, "a7 IV", "sony-a7iv");
    addSonyHybridPresets(output, "ZV-E1", "sony-zve1");
    addSonyA1IIPresets(output);
  }

  function addSonyFx3Presets(output) {
    addSonyHybridCodecRows(output, {
      model: "FX3",
      sourceKey: "sony-fx3",
      siRates: {
        "23.98": 240,
        "25": 250,
        "29.97": 300,
        "50": 500,
        "59.94": 600,
      },
      sRates: {
        "23.98": 100,
        "25": 140,
        "29.97": 140,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
      hsRates: {
        "23.98": 100,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
      featuredSIFps: ["23.98"],
      featuredHSFps: ["119.88"],
    });
  }

  function addSonyFx30Presets(output) {
    addSonyHybridCodecRows(output, {
      model: "FX30",
      sourceKey: "sony-fx30",
      siRates: {
        "23.98": 240,
        "25": 250,
        "29.97": 300,
        "50": 500,
        "59.94": 600,
      },
      sRates: {
        "23.98": 100,
        "25": 140,
        "29.97": 140,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
      hsRates: {
        "23.98": 100,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
    });
  }

  function addSonyHybridPresets(output, model, sourceKey) {
    const sharedRates = {
      siRates: {
        "23.98": 240,
        "25": 250,
        "29.97": 300,
        "50": 500,
        "59.94": 600,
      },
      sRates: {
        "23.98": 100,
        "25": 140,
        "29.97": 140,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
      hsRates: {
        "23.98": 100,
        "50": 200,
        "59.94": 200,
        "100": 280,
        "119.88": 280,
      },
    };

    if (model === "a7 IV") {
      addSonyHybridCodecRows(output, {
        model,
        sourceKey,
        siRates: {
          "24": 240,
          "25": 250,
          "30": 300,
          "50": 500,
          "60": 600,
        },
        sRates: {
          "24": 100,
          "25": 140,
          "30": 140,
          "50": 200,
          "60": 200,
        },
        hsRates: {
          "24": 100,
          "50": 200,
          "60": 200,
        },
      });
      return;
    }

    if (model === "ZV-E1") {
      addSonyHybridCodecRows(output, {
        model,
        sourceKey,
        siRates: {
          "23.98": 240,
          "25": 250,
          "29.97": 300,
          "50": 500,
          "59.94": 600,
        },
        sRates: {
          "23.98": 100,
          "25": 140,
          "29.97": 140,
          "50": 200,
          "59.94": 200,
        },
        hsRates: {
          "23.98": 100,
          "50": 200,
          "59.94": 200,
        },
      });
      return;
    }

    addSonyHybridCodecRows(output, { model, sourceKey, ...sharedRates });
  }

  function addSonyHybridCodecRows(output, options) {
    const base = {
      brand: "Sony",
      model: options.model,
      resolution: "4K",
      resolutionGroup: "4K",
      dimensions: "3840 x 2160",
      note: "Official Sony support specification bitrate row.",
      sourceKey: options.sourceKey,
    };

    addRateRows(output, {
      ...base,
      family: "Sony XAVC S-I",
      codec: "XAVC S-I 4K",
      featuredFps: options.featuredSIFps || [],
    }, options.siRates);

    addRateRows(output, {
      ...base,
      family: "Sony XAVC S",
      codec: "XAVC S 4K",
    }, options.sRates);

    if (options.hsRates) {
      addRateRows(output, {
        ...base,
        family: "Sony XAVC HS",
        codec: "XAVC HS 4K",
        featuredFps: options.featuredHSFps || [],
      }, options.hsRates);
    }
  }

  function addSonyFx6Presets(output) {
    addRateRows(output, {
      brand: "Sony",
      model: "FX6",
      family: "Sony XAVC-I",
      codec: "XAVC-I QFHD",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-fx6",
    }, {
      "23.98": 240,
      "25": 250,
      "29.97": 300,
      "50": 500,
      "59.94": 600,
    });

    addRateRows(output, {
      brand: "Sony",
      model: "FX6",
      family: "Sony XAVC-L",
      codec: "XAVC-L QFHD",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-fx6",
    }, {
      "23.98": 100,
      "25": 100,
      "29.97": 100,
      "50": 150,
      "59.94": 150,
    });
  }

  function addSonyA1IIPresets(output) {
    addRateRows(output, {
      brand: "Sony",
      model: "a1 II",
      family: "Sony XAVC HS",
      codec: "XAVC HS 8K 4:2:0 10-bit",
      resolution: "8K",
      resolutionGroup: "8K",
      dimensions: "7680 x 4320",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-a1ii",
    }, {
      "23.98": 400,
      "24": 400,
      "25": 400,
      "29.97": 400,
    });

    addRateRows(output, {
      brand: "Sony",
      model: "a1 II",
      family: "Sony XAVC HS",
      codec: "XAVC HS 8K 4:2:2 10-bit",
      resolution: "8K",
      resolutionGroup: "8K",
      dimensions: "7680 x 4320",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-a1ii",
      featuredFps: ["23.98"],
    }, {
      "23.98": 520,
      "24": 520,
      "25": 520,
      "29.97": 520,
    });

    addRateRows(output, {
      brand: "Sony",
      model: "a1 II",
      family: "Sony XAVC S-I",
      codec: "XAVC S-I 4K",
      resolution: "4K",
      resolutionGroup: "4K",
      dimensions: "3840 x 2160",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-a1ii",
      featuredFps: ["59.94"],
    }, {
      "23.98": 240,
      "25": 250,
      "29.97": 300,
      "50": 500,
      "59.94": 600,
    });

    addRateRows(output, {
      brand: "Sony",
      model: "a1 II",
      family: "Sony XAVC S",
      codec: "XAVC S 4K",
      resolution: "4K",
      resolutionGroup: "4K",
      dimensions: "3840 x 2160",
      note: "Official Sony support specification bitrate row.",
      sourceKey: "sony-a1ii",
    }, {
      "23.98": 100,
      "25": 140,
      "29.97": 140,
      "50": 200,
      "59.94": 200,
      "100": 280,
      "119.88": 280,
    });
  }

  function addPanasonicPresets(output) {
    addPanasonicGh5IIPresets(output);
    addPanasonicGh6Presets(output);
    addPanasonicGh7Presets(output);
  }

  function addPanasonicGh5IIPresets(output) {
    addRateRows(output, {
      brand: "Panasonic",
      model: "GH5 II",
      family: "Panasonic All-Intra",
      codec: "4:2:2 10-bit ALL-Intra",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh5ii",
    }, {
      "24": 400,
      "25": 400,
      "29.97": 400,
    });

    addRateRows(output, {
      brand: "Panasonic",
      model: "GH5 II",
      family: "Panasonic LongGOP",
      codec: "4:2:2 10-bit LongGOP",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh5ii",
    }, {
      "24": 150,
      "25": 150,
      "29.97": 150,
    });

    addRateRows(output, {
      brand: "Panasonic",
      model: "GH5 II",
      family: "Panasonic LongGOP",
      codec: "4:2:0 10-bit LongGOP",
      resolution: "UHD",
      resolutionGroup: "UHD",
      dimensions: "3840 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh5ii",
    }, {
      "50": 200,
      "59.94": 200,
    });
  }

  function addPanasonicGh6Presets(output) {
    addRateRows(output, {
      brand: "Panasonic",
      model: "GH6",
      family: "Panasonic All-Intra",
      codec: "4:2:2 10-bit ALL-Intra",
      resolution: "C4K",
      resolutionGroup: "4K",
      dimensions: "4096 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh6",
    }, {
      "23.98": 400,
      "25": 400,
      "29.97": 400,
      "50": 800,
      "59.94": 800,
    });

    addRateRows(output, {
      brand: "Panasonic",
      model: "GH6",
      family: "Panasonic LongGOP",
      codec: "4:2:2 10-bit LongGOP",
      resolution: "C4K",
      resolutionGroup: "4K",
      dimensions: "4096 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh6",
    }, {
      "23.98": 150,
      "25": 150,
      "29.97": 150,
      "50": 200,
      "59.94": 200,
    });
  }

  function addPanasonicGh7Presets(output) {
    const base = {
      brand: "Panasonic",
      model: "GH7",
      resolution: "C4K",
      resolutionGroup: "4K",
      dimensions: "4096 x 2160",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh7",
    };

    addRateRows(output, {
      ...base,
      family: "Panasonic ProRes RAW",
      codec: "Apple ProRes RAW HQ",
      featuredFps: ["29.97"],
    }, {
      "23.98": 2100,
      "25": 2100,
      "29.97": 2100,
      "50": 4200,
      "59.94": 4200,
    });

    addRateRows(output, {
      ...base,
      family: "Panasonic ProRes RAW",
      codec: "Apple ProRes RAW",
    }, {
      "23.98": 1400,
      "25": 1400,
      "29.97": 1400,
      "50": 2800,
      "59.94": 2800,
    });

    addRateRows(output, {
      ...base,
      family: "Panasonic ProRes",
      codec: "Apple ProRes 422 HQ",
    }, {
      "23.98": 972,
      "25": 972,
      "29.97": 972,
      "50": 1900,
      "59.94": 1900,
    });

    addRateRows(output, {
      ...base,
      family: "Panasonic ProRes",
      codec: "Apple ProRes 422",
    }, {
      "23.98": 648,
      "25": 648,
      "29.97": 648,
      "50": 1300,
      "59.94": 1300,
    });

    addRateRows(output, {
      ...base,
      family: "Panasonic All-Intra",
      codec: "4:2:2 10-bit ALL-Intra",
    }, {
      "23.98": 400,
      "25": 400,
      "29.97": 400,
      "50": 800,
      "59.94": 800,
    });

    addRateRows(output, {
      ...base,
      family: "Panasonic LongGOP",
      codec: "4:2:2 10-bit LongGOP",
      featuredFps: ["29.97"],
    }, {
      "23.98": 150,
      "25": 150,
      "29.97": 150,
      "50": 200,
      "59.94": 200,
    });

    addRateRows(output, {
      brand: "Panasonic",
      model: "GH7",
      family: "Panasonic LongGOP",
      codec: "5.7K 4:2:0 10-bit LongGOP",
      resolution: "5.7K",
      resolutionGroup: "6K",
      dimensions: "5728 x 3024",
      note: "Official Panasonic recording-format bitrate row.",
      sourceKey: "panasonic-gh7",
    }, {
      "23.98": 200,
      "25": 200,
      "29.97": 200,
    });
  }

  function addDjiPresets(output) {
    addMaxCapPreset(output, {
      brand: "DJI",
      model: "Mini 4 Pro",
      family: "DJI Camera Max",
      codec: "H.264 / H.265",
      bitrateMbps: 150,
      sourceKey: "dji-mini4pro",
      featured: true,
    });

    addMaxCapPreset(output, {
      brand: "DJI",
      model: "Air 3S",
      family: "DJI Camera Max",
      codec: "H.264 / H.265",
      bitrateMbps: 130,
      sourceKey: "dji-air3s",
    });

    [
      { model: "Mavic 3 Pro Cine (Hasselblad)", codec: "H.264 / H.265", bitrateMbps: 200 },
      { model: "Mavic 3 Pro Cine (Hasselblad)", codec: "ProRes 422 HQ", bitrateMbps: 3772 },
      { model: "Mavic 3 Pro Cine (Hasselblad)", codec: "ProRes 422", bitrateMbps: 2514 },
      { model: "Mavic 3 Pro Cine (Hasselblad)", codec: "ProRes 422 LT", bitrateMbps: 1750 },
      { model: "Mavic 3 Pro Cine (Medium Tele)", codec: "H.264 / H.265", bitrateMbps: 160 },
      { model: "Mavic 3 Pro Cine (Medium Tele)", codec: "ProRes 422 HQ", bitrateMbps: 1768 },
      { model: "Mavic 3 Pro Cine (Medium Tele)", codec: "ProRes 422", bitrateMbps: 1178 },
      { model: "Mavic 3 Pro Cine (Medium Tele)", codec: "ProRes 422 LT", bitrateMbps: 821 },
      { model: "Mavic 3 Pro Cine (Tele)", codec: "H.264 / H.265", bitrateMbps: 160 },
      { model: "Mavic 3 Pro Cine (Tele)", codec: "ProRes 422 HQ", bitrateMbps: 1768 },
      { model: "Mavic 3 Pro Cine (Tele)", codec: "ProRes 422", bitrateMbps: 1178 },
      { model: "Mavic 3 Pro Cine (Tele)", codec: "ProRes 422 LT", bitrateMbps: 821 },
    ].forEach((row) => {
      addMaxCapPreset(output, {
        brand: "DJI",
        model: row.model,
        family: "DJI Camera Max",
        codec: row.codec,
        bitrateMbps: row.bitrateMbps,
        sourceKey: "dji-mavic3pro",
        featured: row.featured,
        note: "Official maximum codec bitrate for this Mavic 3 Pro Cine camera path; exact mode varies by recording option.",
      });
    });
  }

  function addGoProPresets(output) {
    [
      { model: "HERO13 Black", sourceKey: "gopro-hero13", featured: true },
      { model: "HERO12 Black", sourceKey: "gopro-hero12" },
      { model: "HERO11 Black", sourceKey: "gopro-hero11" },
    ].forEach((row) => {
      addMaxCapPreset(output, {
        brand: "GoPro",
        model: row.model,
        family: "GoPro Camera Max",
        codec: "Internal recording",
        bitrateMbps: 120,
        sourceKey: row.sourceKey,
        featured: row.featured,
        note: "Official maximum camera bitrate; exact mode varies by resolution, frame rate, lens mode, and codec.",
      });
    });
  }

  function addArriPresets(output) {
    [
      {
        model: "ALEXA Mini LF",
        family: "ARRI ProRes",
        codec: "ProRes 422 HQ",
        resolution: "4.5K Open Gate",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 1177,
        featured: true,
      },
      {
        model: "ALEXA Mini LF",
        family: "ARRI ProRes",
        codec: "ProRes 4444",
        resolution: "4.5K Open Gate",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 1765,
      },
      {
        model: "ALEXA Mini LF",
        family: "ARRI ProRes",
        codec: "ProRes 4444 XQ",
        resolution: "4.5K Open Gate",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 2616,
      },
      {
        model: "ALEXA Mini LF",
        family: "ARRIRAW",
        codec: "ARRIRAW",
        resolution: "4.5K Open Gate",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 3875,
      },
      {
        model: "ALEXA 35",
        family: "ARRI ProRes",
        codec: "ProRes 422 HQ",
        resolution: "4.6K Open Gate 3:2",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 1225,
      },
      {
        model: "ALEXA 35",
        family: "ARRI ProRes",
        codec: "ProRes 4444",
        resolution: "4.6K Open Gate 3:2",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 1830,
      },
      {
        model: "ALEXA 35",
        family: "ARRI ProRes",
        codec: "ProRes 4444 XQ",
        resolution: "4.6K Open Gate 3:2",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 2738,
      },
      {
        model: "ALEXA 35",
        family: "ARRIRAW",
        codec: "ARRIRAW",
        resolution: "4.6K Open Gate 3:2",
        resolutionGroup: "4K",
        dimensions: "Open Gate",
        fps: "24",
        bitrateMbps: 4458,
        featured: true,
      },
    ].forEach((row) => {
      addPreset(output, {
        brand: "ARRI",
        model: row.model,
        family: row.family,
        codec: row.codec,
        resolution: row.resolution,
        resolutionGroup: row.resolutionGroup,
        dimensions: row.dimensions,
        fps: row.fps,
        bitrateMbps: row.bitrateMbps,
        note: "Official ARRI calculator value at 24 fps.",
        sourceKey: "arri-data-rate",
        featured: row.featured,
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
              brand: "Blackmagic",
              model: "Blackmagic Cinema Camera 6K",
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
              sourceKey: "blackmagic-braw",
            });
          });
        });
    });
  }

  function addRedPresets(output) {
    [
      { model: "V-RAPTOR X 8K VV", codec: "REDCODE RAW LQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 56 },
      { model: "V-RAPTOR X 8K VV", codec: "REDCODE RAW MQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 35 },
      { model: "V-RAPTOR X 8K VV", codec: "REDCODE RAW HQ", resolution: "8K VV", resolutionGroup: "8K", dimensions: "8192 x 4320", minutesOn660Gb: 24 },
      { model: "KOMODO-X 6K", codec: "REDCODE RAW LQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 102 },
      { model: "KOMODO-X 6K", codec: "REDCODE RAW MQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 64 },
      { model: "KOMODO-X 6K", codec: "REDCODE RAW HQ", resolution: "6K 17:9", resolutionGroup: "6K", dimensions: "6144 x 3240", minutesOn660Gb: 44 },
    ].forEach((row) => {
      addPreset(output, {
        brand: "RED",
        model: row.model,
        family: "REDCODE RAW",
        codec: row.codec,
        resolution: row.resolution,
        resolutionGroup: row.resolutionGroup,
        dimensions: row.dimensions,
        fps: "24",
        bitrateMbps: (660 * 8000) / (row.minutesOn660Gb * 60),
        note: "Estimated from RED published 660 GB recording time at 24 fps.",
        sourceKey: "red-redcode",
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
    return [...new Set(items.map((item) => item[key]))].filter(Boolean);
  }

  function sortResolutionGroups(a, b) {
    return (resolutionOrder[a] || 99) - (resolutionOrder[b] || 99) || a.localeCompare(b);
  }

  function sortFrameRates(a, b) {
    const aNumber = Number(a);
    const bNumber = Number(b);
    const aValid = Number.isFinite(aNumber);
    const bValid = Number.isFinite(bNumber);

    if (aValid && bValid) {
      return aNumber - bNumber;
    }

    if (aValid) {
      return -1;
    }

    if (bValid) {
      return 1;
    }

    return a.localeCompare(b);
  }

  function isFeaturedPreset(preset) {
    if (preset.family === "Apple ProRes") {
      return ["Apple ProRes 422", "Apple ProRes 422 HQ"].includes(preset.codec)
        && ["UHD", "4K DCI"].includes(preset.resolution)
        && ["24", "25", "30"].includes(preset.fps);
    }

    if (preset.family === "Avid DNxHR") {
      return ["Avid DNxHR HQ", "Avid DNxHR HQX"].includes(preset.codec)
        && preset.resolution === "UHD"
        && ["23.976", "25", "29.97"].includes(preset.fps);
    }

    if (preset.family === "Blackmagic RAW") {
      return preset.codec === "BRAW 5:1"
        && ["6K Open Gate", "4K DCI"].includes(preset.resolution)
        && ["25", "30"].includes(preset.fps);
    }

    if (preset.family === "Canon Cinema RAW Light") {
      return preset.model === "EOS C400"
        && preset.resolution === "6K Full Frame"
        && preset.codec === "CRM RAW ST"
        && ["25", "29.97"].includes(preset.fps);
    }

    if (preset.family === "REDCODE RAW") {
      return preset.codec === "REDCODE RAW MQ";
    }

    return false;
  }

  function sortPresets(a, b) {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return a.brand.localeCompare(b.brand)
      || a.family.localeCompare(b.family)
      || sortResolutionGroups(a.resolutionGroup, b.resolutionGroup)
      || sortFrameRates(a.fps, b.fps)
      || a.model.localeCompare(b.model)
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

  function formatVerifiedDate(dateString) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${dateString}T00:00:00Z`));
  }
})();

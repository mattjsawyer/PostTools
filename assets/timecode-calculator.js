(() => {
  const frameRates = {
    "23.976-ndf": { label: "23.976 fps", fps: 24000 / 1001, nominalFps: 24, dropFrame: false },
    "24-ndf": { label: "24 fps", fps: 24, nominalFps: 24, dropFrame: false },
    "25-ndf": { label: "25 fps", fps: 25, nominalFps: 25, dropFrame: false },
    "29.97-ndf": { label: "29.97 fps NDF", fps: 30000 / 1001, nominalFps: 30, dropFrame: false },
    "29.97-df": { label: "29.97 fps DF", fps: 30000 / 1001, nominalFps: 30, dropFrame: true, dropFrames: 2 },
    "30-ndf": { label: "30 fps", fps: 30, nominalFps: 30, dropFrame: false },
    "48-ndf": { label: "48 fps", fps: 48, nominalFps: 48, dropFrame: false },
    "50-ndf": { label: "50 fps", fps: 50, nominalFps: 50, dropFrame: false },
    "59.94-ndf": { label: "59.94 fps NDF", fps: 60000 / 1001, nominalFps: 60, dropFrame: false },
    "59.94-df": { label: "59.94 fps DF", fps: 60000 / 1001, nominalFps: 60, dropFrame: true, dropFrames: 4 },
    "60-ndf": { label: "60 fps", fps: 60, nominalFps: 60, dropFrame: false },
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("timecode-form");

    if (!form) {
      return;
    }

    const frameRateSelect = document.getElementById("timecode-frame-rate");
    const timecodeA = document.getElementById("timecode-a");
    const timecodeB = document.getElementById("timecode-b");
    const clearButton = document.getElementById("timecode-clear-button");
    const copyButton = document.getElementById("timecode-copy-button");
    const resultHeadline = document.getElementById("timecode-result-headline");
    const resultCodeLabel = document.getElementById("timecode-result-code-label");
    const resultCode = document.getElementById("timecode-result-code");
    const resultFramesLabel = document.getElementById("timecode-result-frames-label");
    const resultFrames = document.getElementById("timecode-result-frames");
    const resultRuntimeLabel = document.getElementById("timecode-result-runtime-label");
    const resultRuntime = document.getElementById("timecode-result-runtime");
    const resultRateLabel = document.getElementById("timecode-result-rate-label");
    const resultRate = document.getElementById("timecode-result-rate");
    const copyStatus = document.getElementById("timecode-copy-status");
    const resultNote = document.getElementById("timecode-result-note");

    const bulkDetails = document.getElementById("bulk-timecode-details");
    const bulkInput = document.getElementById("bulk-timecodes");
    const bulkClearButton = document.getElementById("bulk-clear-button");
    const bulkCopyButton = document.getElementById("bulk-copy-button");

    let activeResult = "simple";
    let latestResult = null;
    let latestBulkResult = null;
    let singleResultState = null;
    let bulkResultState = null;
    let statusTimer = null;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      copyResult();
    });

    frameRateSelect.addEventListener("input", () => {
      calculateAll();
      renderActiveResult();
    });
    frameRateSelect.addEventListener("change", () => {
      calculateAll();
      renderActiveResult();
    });

    [timecodeA, timecodeB].forEach((control) => {
      control.addEventListener("input", activateSimpleResult);
      control.addEventListener("change", activateSimpleResult);
      control.addEventListener("focus", activateSimpleResult);
    });

    document.querySelectorAll('input[name="timecode-operation"]').forEach((input) => {
      input.addEventListener("change", activateSimpleResult);
      input.addEventListener("focus", activateSimpleResult);
    });

    clearButton.addEventListener("click", clearSingle);
    clearButton.addEventListener("focus", activateSimpleResult);
    copyButton.addEventListener("click", copyResult);
    copyButton.addEventListener("focus", activateSimpleResult);
    bulkInput.addEventListener("input", activateBulkResult);
    bulkInput.addEventListener("change", activateBulkResult);
    bulkInput.addEventListener("focus", activateBulkResult);
    bulkClearButton.addEventListener("click", clearBulk);
    bulkClearButton.addEventListener("focus", activateBulkResult);
    bulkCopyButton.addEventListener("click", copyBulkResult);
    bulkCopyButton.addEventListener("focus", activateBulkResult);
    bulkDetails.addEventListener("toggle", () => {
      if (bulkDetails.open) {
        activateBulkResult();
      } else {
        activeResult = "simple";
        renderActiveResult();
      }
    });

    calculateAll();
    renderActiveResult();

    function activateSimpleResult() {
      activeResult = "simple";
      calculateSingle();
      renderActiveResult();
    }

    function activateBulkResult() {
      activeResult = "bulk";
      calculateBulk();
      renderActiveResult();
    }

    function calculateAll() {
      calculateSingle();
      calculateBulk();
    }

    function calculateSingle() {
      const rate = getFrameRate();
      const parsedA = parseTimecode(timecodeA.value, rate);
      const parsedB = parseTimecode(timecodeB.value, rate);
      const operation = getOperation();

      latestResult = null;

      if (!parsedA.valid || !parsedB.valid) {
        setSingleResultState({
          headline: getParseMessage(parsedA, parsedB),
          code: "-",
          frames: "-",
          runtime: "-",
          rate: rate.label,
        });
        return;
      }

      const frames = calculateOperation(parsedA.frames, parsedB.frames, operation);
      const code = formatTimecode(frames, rate);
      latestResult = { frames, code };

      setSingleResultState({
        headline: `${getOperationLabel(operation)}: ${code}`,
        code,
        frames: formatFrameCount(frames),
        runtime: formatRuntime(Math.abs(frames) / rate.fps),
        rate: rate.label,
      });
    }

    function calculateBulk() {
      const rate = getFrameRate();
      const parsed = parseBulkTimecodes(bulkInput.value, rate);

      latestBulkResult = null;

      if (parsed.count === 0 && parsed.invalid.length === 0) {
        setBulkResultState({
          headline: "Bulk calculations",
          code: "-",
          frames: "-",
          runtime: "-",
          operations: "0 operations",
          note: "Waiting for timecodes.",
        });
        return;
      }

      if (parsed.invalid.length > 0) {
        latestBulkResult = null;
        setBulkResultState({
          headline: "Check bulk calculations",
          code: "-",
          frames: "-",
          runtime: "-",
          operations: `${parsed.count} valid, ${parsed.invalid.length} invalid`,
          note: `Check: ${parsed.invalid.slice(0, 3).join(", ")}${parsed.invalid.length > 3 ? "..." : ""}`,
        });
        return;
      }

      const frames = Math.round(parsed.frames);
      const code = formatTimecode(frames, rate);
      latestBulkResult = { frames, code };
      setBulkResultState({
        headline: `Bulk total: ${code}`,
        code,
        frames: formatFrameCount(frames),
        runtime: formatRuntime(Math.abs(frames) / rate.fps),
        operations: `${parsed.count} operation${parsed.count === 1 ? "" : "s"}`,
        note: "Use + or - with timecodes. Use * or / with numbers.",
      });
    }

    function clearSingle() {
      activeResult = "simple";
      timecodeA.value = "";
      timecodeB.value = "";
      calculateSingle();
      renderActiveResult();
      timecodeA.focus();
    }

    function clearBulk() {
      activeResult = "bulk";
      bulkInput.value = "";
      calculateBulk();
      renderActiveResult();
      bulkInput.focus();
    }

    function copyResult() {
      activeResult = "simple";
      renderActiveResult();

      if (!latestResult) {
        setStatus("Nothing to copy yet.");
        return;
      }

      copyText(latestResult.code).then((copied) => {
        setStatus(copied ? `Copied ${latestResult.code}.` : "Copy failed. Select the result manually.");
      });
    }

    function copyBulkResult() {
      activeResult = "bulk";
      renderActiveResult();

      if (!latestBulkResult) {
        setStatus("Nothing to copy yet.");
        return;
      }

      copyText(latestBulkResult.code).then((copied) => {
        setStatus(copied ? `Copied ${latestBulkResult.code}.` : "Copy failed. Select the result manually.");
      });
    }

    function setSingleResultState(result) {
      singleResultState = {
        ...result,
        note: "Drop-frame mode skips timecode numbers, not video frames.",
      };
    }

    function setBulkResultState(result) {
      bulkResultState = result;
    }

    function renderActiveResult() {
      const isBulk = activeResult === "bulk";
      const state = isBulk ? bulkResultState : singleResultState;

      if (!state) {
        return;
      }

      resultCodeLabel.textContent = isBulk ? "Bulk total" : "Timecode";
      resultFramesLabel.textContent = "Frames";
      resultRuntimeLabel.textContent = "Runtime";
      resultRateLabel.textContent = isBulk ? "Operations" : "Frame rate";

      resultHeadline.textContent = state.headline;
      resultCode.textContent = state.code;
      resultFrames.textContent = state.frames;
      resultRuntime.textContent = state.runtime;
      resultRate.textContent = isBulk ? state.operations : state.rate;
      resultNote.textContent = state.note;
      copyStatus.textContent = "";
    }

    function setStatus(message) {
      window.clearTimeout(statusTimer);
      copyStatus.textContent = message;
      statusTimer = window.setTimeout(() => {
        copyStatus.textContent = "";
      }, 3000);
    }

    function getFrameRate() {
      return frameRates[frameRateSelect.value] || frameRates["24-ndf"];
    }

    function getOperation() {
      const selected = document.querySelector('input[name="timecode-operation"]:checked');
      return selected ? selected.value : "add";
    }

    function getParseMessage(parsedA, parsedB) {
      if (!parsedA.valid && !parsedB.valid) {
        return "Enter two valid timecodes";
      }

      if (!parsedA.valid) {
        return `Check timecode A: ${parsedA.reason}`;
      }

      return `Check timecode B: ${parsedB.reason}`;
    }

  });

  function calculateOperation(framesA, framesB, operation) {
    if (operation === "subtract") {
      return framesA - framesB;
    }

    if (operation === "difference") {
      return Math.abs(framesA - framesB);
    }

    return framesA + framesB;
  }

  function getOperationLabel(operation) {
    if (operation === "subtract") {
      return "Result";
    }

    if (operation === "difference") {
      return "Difference";
    }

    return "Result";
  }

  function parseBulkTimecodes(value, rate) {
    return String(value).split(/\r?\n/).reduce((result, line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return result;
      }

      const match = trimmed.match(/^([+\-*/])?\s*(\d+[:;]\d{2}[:;]\d{2}[:;]\d{2}|[0-9]+(?:\.[0-9]+)?)/);

      if (!match) {
        result.invalid.push(`line ${index + 1}`);
        return result;
      }

      const operator = match[1] || "+";

      if (operator === "*" || operator === "/") {
        const factor = parsePositiveNumber(match[2]);

        if (factor === null) {
          result.invalid.push(`line ${index + 1}`);
          return result;
        }

        if (operator === "/" && factor === 0) {
          result.invalid.push(`line ${index + 1} division by zero`);
          return result;
        }

        result.count += 1;
        result.frames = operator === "*" ? result.frames * factor : result.frames / factor;
        return result;
      }

      const parsed = parseTimecode(match[2], rate);

      if (!parsed.valid) {
        result.invalid.push(`line ${index + 1}`);
        return result;
      }

      result.count += 1;

      if (operator === "-") {
        result.frames -= parsed.frames;
      } else {
        result.frames += parsed.frames;
      }

      return result;
    }, { count: 0, frames: 0, invalid: [] });
  }

  function parseTimecode(rawValue, rate) {
    const value = String(rawValue).trim();

    if (!value) {
      return { valid: false, reason: "empty value" };
    }

    const isNegative = value.startsWith("-");
    const normalized = value.replace(/^[+-]/, "").replace(/;/g, ":");
    const parts = normalized.split(":");

    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
      return { valid: false, reason: "use HH:MM:SS:FF" };
    }

    const [hours, minutes, seconds, frames] = parts.map(Number);

    if (minutes >= 60 || seconds >= 60) {
      return { valid: false, reason: "minutes and seconds must be below 60" };
    }

    if (frames >= rate.nominalFps) {
      return { valid: false, reason: `frames must be below ${rate.nominalFps}` };
    }

    if (rate.dropFrame && minutes % 10 !== 0 && seconds === 0 && frames < rate.dropFrames) {
      return { valid: false, reason: `drop-frame skips frames 00-${String(rate.dropFrames - 1).padStart(2, "0")} at this minute` };
    }

    const frameCount = rate.dropFrame
      ? dropFrameTimecodeToFrames(hours, minutes, seconds, frames, rate)
      : nonDropTimecodeToFrames(hours, minutes, seconds, frames, rate);

    return {
      valid: true,
      frames: isNegative ? -frameCount : frameCount,
    };
  }

  function parsePositiveNumber(rawValue) {
    const value = String(rawValue).trim().replace(/,/g, "");

    if (!value) {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function nonDropTimecodeToFrames(hours, minutes, seconds, frames, rate) {
    return (((hours * 60 + minutes) * 60 + seconds) * rate.nominalFps) + frames;
  }

  function dropFrameTimecodeToFrames(hours, minutes, seconds, frames, rate) {
    const totalMinutes = (hours * 60) + minutes;
    const skippedFrames = rate.dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));
    return nonDropTimecodeToFrames(hours, minutes, seconds, frames, rate) - skippedFrames;
  }

  function formatTimecode(frameCount, rate) {
    const sign = frameCount < 0 ? "-" : "";
    const frames = Math.abs(Math.round(frameCount));
    const separator = rate.dropFrame ? ";" : ":";

    if (rate.dropFrame) {
      const parts = dropFrameFramesToTimecode(frames, rate);
      return `${sign}${formatPart(parts.hours)}:${formatPart(parts.minutes)}:${formatPart(parts.seconds)}${separator}${formatPart(parts.frames)}`;
    }

    const parts = nonDropFramesToTimecode(frames, rate);
    return `${sign}${formatPart(parts.hours)}:${formatPart(parts.minutes)}:${formatPart(parts.seconds)}${separator}${formatPart(parts.frames)}`;
  }

  function nonDropFramesToTimecode(frameCount, rate) {
    const framesPerHour = rate.nominalFps * 60 * 60;
    const framesPerMinute = rate.nominalFps * 60;
    const hours = Math.floor(frameCount / framesPerHour);
    const minutes = Math.floor((frameCount % framesPerHour) / framesPerMinute);
    const seconds = Math.floor((frameCount % framesPerMinute) / rate.nominalFps);
    const frames = frameCount % rate.nominalFps;

    return { hours, minutes, seconds, frames };
  }

  function dropFrameFramesToTimecode(frameCount, rate) {
    const nominalFps = rate.nominalFps;
    const dropFrames = rate.dropFrames;
    const framesPer10Minutes = (nominalFps * 60 * 10) - (dropFrames * 9);
    const framesPer24Hours = framesPer10Minutes * 6 * 24;
    const framesPerMinute = (nominalFps * 60) - dropFrames;
    const dayChunks = Math.floor(frameCount / framesPer24Hours);
    let remainingFrames = frameCount % framesPer24Hours;
    const tenMinuteChunks = Math.floor(remainingFrames / framesPer10Minutes);
    const framesIntoTenMinuteChunk = remainingFrames % framesPer10Minutes;

    remainingFrames += dropFrames * 9 * tenMinuteChunks;

    if (framesIntoTenMinuteChunk > dropFrames) {
      remainingFrames += dropFrames * Math.floor((framesIntoTenMinuteChunk - dropFrames) / framesPerMinute);
    }

    const framesPerHour = nominalFps * 60 * 60;
    const hours = Math.floor(remainingFrames / framesPerHour) + (dayChunks * 24);
    const minutes = Math.floor((remainingFrames % framesPerHour) / (nominalFps * 60));
    const seconds = Math.floor((remainingFrames % (nominalFps * 60)) / nominalFps);
    const frames = remainingFrames % nominalFps;

    return { hours, minutes, seconds, frames };
  }

  function formatPart(value) {
    return String(value).padStart(2, "0");
  }

  function formatFrameCount(frames) {
    const absolute = Math.abs(frames);
    const sign = frames < 0 ? "-" : "";
    return `${sign}${new Intl.NumberFormat("en-US").format(absolute)} frame${absolute === 1 ? "" : "s"}`;
  }

  function formatRuntime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "-";
    }

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
    }

    if (minutes > 0) {
      return `${minutes} min ${remainingSeconds} sec`;
    }

    return `${remainingSeconds} sec`;
  }

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value)
        .then(() => true)
        .catch(() => false);
    }

    const temp = document.createElement("textarea");
    temp.value = value;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.append(temp);
    temp.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    temp.remove();
    return Promise.resolve(copied);
  }
})();

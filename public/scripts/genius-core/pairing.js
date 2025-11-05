class ModernModeController {
  constructor(wsManager, settingsManager) {
    if (!wsManager) {
      throw new Error("WebSocketManager instance is required.");
    }
    this.wsManager = wsManager;
    this.isPaired = false;
    this.initialStateReceived = false;

    this.bindDOMElements();
    this.initEventListeners();

    let pinMappings = settingsManager.ReadRaw("pins") || {
      left: [],
      right: [],
      reset: [],
    };
    setInterval(() => {
      wsManager.send({
        type: "config",
        data: pinMappings.left.concat(pinMappings.right, pinMappings.reset),
      });
    }, 5000);
    settingsManager.WriteRaw("pins", pinMappings);
    let currentSelector = null;

    function renderPinTags() {
      ["left", "right", "reset"].forEach((fn) => {
        const container = document.getElementById(fn + "-pin-tags");
        container.innerHTML = "";
        pinMappings[fn].forEach((pin) => {
          const tag = document.createElement("span");
          tag.className =
            "bg-white/10 text-white px-2 py-1 rounded-lg flex items-center text-sm cursor-default ring-1 ring-inset ring-white/30";
          tag.innerHTML = `
              <span>${pin}</span>
              <button
                type="button"
                id="('${fn}', ${pin})"
                class="ml-2 text-rose-400 hover:text-rose-600 focus:outline-none"
                aria-label="Remover"
                style="background:none;border:none;padding:0;"
              >
                <i class="fa-solid fa-xmark"></i>
              </button>
            `;
          container.appendChild(tag);
          getById(`('${fn}', ${pin})`).addEventListener("click", () => {
            removePin(fn, pin);
          });
        });
      });
    }

    function removePin(fn, pin) {
      pinMappings[fn] = pinMappings[fn].filter((p) => p !== pin);
      renderPinTags();
    }

    function showPinSelector(fn) {
      currentSelector = fn;
      const usedPins = [
        ...pinMappings.left,
        ...pinMappings.right,
        ...pinMappings.reset,
      ];
      const select = document.getElementById("pin-select-dropdown");
      select.innerHTML = "";
      for (let i = 0; i <= 50; i++) {
        if (!usedPins.includes(i)) {
          const opt = document.createElement("option");
          opt.value = i;
          opt.textContent = i;
          select.appendChild(opt);
        }
      }
      if (select.options.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = "Todos os pinos em uso";
        opt.disabled = true;
        opt.selected = true;
        select.appendChild(opt);
      }
      document.getElementById("pin-select-modal").classList.remove("hidden");
    }

    function closePinSelector() {
      document.getElementById("pin-select-modal").classList.add("hidden");
      currentSelector = null;
    }

    function addSelectedPinToFunction() {
      const select = document.getElementById("pin-select-dropdown");
      const pin = parseInt(select.value, 10);
      if (isNaN(pin)) return;
      if (
        pin < 0 ||
        pin > 50 ||
        Object.values(pinMappings).some((arr) => arr.includes(pin))
      )
        return;
      if (currentSelector && pinMappings[currentSelector]) {
        pinMappings[currentSelector].push(pin);
        pinMappings[currentSelector].sort((a, b) => a - b);
      }
      closePinSelector();
      renderPinTags();


      settingsManager.WriteRaw("pins", pinMappings);

      wsManager.send({
        type: "config",
        data: pinMappings.left.concat(pinMappings.right, pinMappings.reset),
      });
    }

    getById("addSelectedPinToFunction").addEventListener(
      "click",
      addSelectedPinToFunction
    );
    getById("closePinSelector").addEventListener("click", closePinSelector);
    getById("showPinSelectorleft").addEventListener("click", () =>
      showPinSelector("left")
    );
    getById("showPinSelectorright").addEventListener("click", () =>
      showPinSelector("right")
    );
    getById("showPinSelectorreset").addEventListener("click", () =>
      showPinSelector("reset")
    );
    renderPinTags();
    window.getPinMappings = () => JSON.parse(JSON.stringify(pinMappings));
  }

  bindDOMElements() {
    this.connectionModeSelect = document.getElementById("connection-mode");
    this.modernModeSection = document.getElementById("modern-mode-section");
    this.pairedView = document.getElementById("paired-device-view");
    this.unpairedView = document.getElementById("unpaired-device-view");
    this.disconnectBtn = document.getElementById("disconnect-btn");
    this.devicesList = document.getElementById("devices-list");
    this.scanStatus = document.getElementById("scan-status");
    this.pairedDeviceName = document.getElementById("paired-device-name");
    this.pairedDeviceUuid = document.getElementById("paired-device-uuid");
  }

  initEventListeners() {
    this.connectionModeSelect.addEventListener("change", (event) => {
      this.handleModeChange(event.target.value);
    });

    this.startScanning();
    setInterval(() => {
      this.startScanning();
    }, 5000);
    setInterval(() => {
      this.wsManager.send({ type: "state" });
    }, 500);

    this.disconnectBtn.addEventListener("click", () => {
      this.disconnectDevice();
    });

    this.wsManager.on("onScanResult", (devices) => {
      this.renderDevices(devices);
    });

    this.wsManager.on("onState", (state) => {
      if (!this.initialStateReceived) {
        this.handleModeChange(state.IsActive ? "modern" : "legacy");
        
        this.connectionModeSelect.value = state.IsActive ? "modern" : "legacy";
        Array.from(this.connectionModeSelect.options).forEach(opt => {
          opt.selected = (opt.value === (state.IsActive ? "modern" : "legacy"));
        });
        this.initialStateReceived = true;
      }
      this.updateUIFromState(state);
    });

    this.wsManager.on("onConnect", () => {
      if (this.connectionModeSelect.value === "modern") {
        this.wsManager.send({ type: "state" });
      }
    });

    this.wsManager.on("onErrorResponse", (errorMessage) => {
      alert(`Erro do servidor: ${errorMessage}`);
      this.scanStatus.classList.add("hidden");
    });
  }

  handleModeChange(mode) {
    console.log(mode)
    if (mode === "modern") {
      this.modernModeSection.classList.remove("hidden");
      if (this.initialStateReceived) {
        this.wsManager.send({ type: "mode", mode: "modern" });
        this.wsManager.send({ type: "state" });
      }
    } else {
      this.modernModeSection.classList.add("hidden");
      if (this.initialStateReceived) {
        this.wsManager.send({ type: "mode", mode: "legacy" });
      }
    }
  }

  startScanning() {
    if (this.isPaired) return;
    this.scanStatus.textContent = "Buscando por dispositivos...";
    this.scanStatus.classList.remove("hidden");
    this.devicesList.innerHTML = "";
    this.wsManager.send({ type: "state" });
    this.wsManager.send({ type: "scan" });
  }

  renderDevices(devices) {
    this.scanStatus.classList.add("hidden");

    if (!devices || devices.length === 0) {
      this.devicesList.innerHTML =
        '<p class="text-gray-500 text-center py-4">Nenhum dispositivo encontrado.</p>';
      return;
    }

    this.devicesList.innerHTML = devices
      .map(
        (device) => `
        <div class="bg-black/20 p-3 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-semibold text-base">${
              device.name || "Dispositivo Sem Nome"
            }</p>
            <p class="text-xs text-gray-400">${device.uuid}</p>
          </div>
          <button
            data-uuid="${device.uuid}"
            data-name="${device.name || "Dispositivo Sem Nome"}"
            class="pair-btn bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-lg transition-transform duration-200 hover:scale-105 text-sm"
          >
            <i class="fa-solid fa-link"></i> Conectar
          </button>
        </div>
      `
      )
      .join("");

    this.devicesList.querySelectorAll(".pair-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const { uuid, name } = event.currentTarget.dataset;
        this.pairDevice(name, uuid);
      });
    });
  }

  pairDevice(name, uuid) {
    this.wsManager.send({ type: "pair", uuid: uuid });
  }

  disconnectDevice() {
    this.showUnpairedView();
    this.startScanning();
  }

  updateUIFromState(state) {
    if (state && state.PairedDevice && state.PairedDevice.uuid) {
      this.showPairedView(state.PairedDevice);
      this.isPaired = true;
    } else {
      this.showUnpairedView();
      this.isPaired = false;
    }

    document.getElementById("gp-control-latency").textContent = state.Latency + "ms";
  }

  showPairedView(device) {
    this.pairedDeviceName.textContent = device.name;
    this.pairedDeviceUuid.textContent = device.uuid;
    this.unpairedView.classList.add("hidden");
    this.pairedView.classList.remove("hidden");
  }

  showUnpairedView() {
    this.pairedView.classList.add("hidden");
    this.unpairedView.classList.remove("hidden");
  }
}

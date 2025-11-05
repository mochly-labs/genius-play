/*
  TODO:
  * Ajeitar as cores dos inputs das configurações
  TODO:
  * Criar um botão de pausa
  TODO:
  * Fazer o jogo pegar
*/

let hasController = false;

const wsManager = new WebSocketManager(wsUrl, {
  reconnectInterval: 1000,
  keepAliveTimeout: 60000,
});

async function LoadGame() {
  const teamElements = {
    redName: getById("team-red-name"),
    blueName: getById("team-blue-name"),
    gameTitle: getById("gp_game_title_element"),
  };

  const backgroundElement = get(".ingame-bg");
  const startButton = getById("start-btn");
  const homeContent = getById("home-content");

  let isAudioInitialized = false;

  async function getQuestionaryById(id) {
    try {
      const response = await fetch(`${httpUrl}/upload/${id}.json`);
      if (!response.ok) throw new Error("Questionary not found");

      const data = await response.json();
      if (!data?.title) throw new Error("Invalid questionary format");

      return data;
    } catch (error) {
      console.error("❌ Failed to fetch questionary:", error);
      localStorage.removeItem("InGame");
      throw error;
    }
  }

  function initializeAudio() {
    if (isAudioInitialized || !bgm) return true;

    try {
      bgm.loop = true;
      bgm
        .play()
        .then(() => (isAudioInitialized = true))
        .catch((error) => console.error("🎵 Audio playback failed:", error));

      return true;
    } catch (error) {
      console.error("🎧 Audio init error:", error);
      return false;
    }
  }

  function applyTeamColors(colorSettings) {
    if (!colorSettings) return;

    const [blueColor = "#0000FF", redColor = "#FF0000"] =
      colorSettings.split("-");
    document.documentElement.style.setProperty("--team-blue-color", blueColor);
    document.documentElement.style.setProperty("--team-red-color", redColor);
  }

  function applySoundEffectsVolume(volume) {
    Object.values(soundEffects || {}).forEach((sound) => {
      if (sound) sound.volume = volume;
    });
  }

  const settings = JSON.parse(localStorage.getItem("gameSettings") || "{}");
  let currentGame;
  async function StartGame(quiz) {
    currentGame = new Game(
      { quiz, randomize: settings["randomize-mode"] },
      settings
    );
    currentGame.iniciarPergunta();
  }

  try {
    const questionary = JSON.parse(localStorage.getItem("questionary") || "{}");

    wsManager.on("onUuidReceived", () => {
      Toasty.show("Socket conectado!", { type: "success", duration: 3000 });
    });

    wsManager.on("onDisconnect", () => {
      hasController = false;
    });

    wsManager.on("onButtonPressed", (event) => {
      if (!currentGame) return;
      const buttons = {
        1: settings["inverter-toggle"] ? "left" : "right",
        2: settings["inverter-toggle"] ? "right" : "left",
      };
      if (buttons[event]) currentGame.setSelected(buttons[event]);
    });

    let pinMappings = JSON.parse(localStorage.getItem("pins")) || {
      left: [],
      right: [],
      reset: [],
    };

    wsManager.on("onBtnModern", (event) => {
      let team = null;

      if (pinMappings.left.includes(event.data.button)) {
        team = "left";
      } else if (pinMappings.right.includes(event.data.button)) {
        team = "right";
      } else if (pinMappings.reset.includes(event.data.button)) {
        currentGame.scores.left = 0;
        currentGame.scores.right = 0;
        currentGame.atualizarScore(true, 0);
        return;
      }

      if (team) {
        if (settings["inverter-toggle"]) {
          team = team === "left" ? "right" : "left";
        }
        if (currentGame) {
          currentGame.setSelected(team);
        }
      }
    });


    
    setInterval(() => {
      wsManager.send({
        type: "config",
        data: pinMappings.left.concat(pinMappings.right, pinMappings.reset),
      });
    }, 5000);
    wsManager.connect();
    if (homeContent) homeContent.remove();

    teamElements.gameTitle.textContent = questionary.title || "";
    getById("questionary-name").textContent = questionary.title || "";

    if (settings["team-names"] === false) {
      teamElements.redName.textContent = `${
        settings["team1-name"] || "Time 1"
      }`;
      teamElements.blueName.textContent = `${
        settings["team2-name"] || "Team 2"
      }`;
    }

    const loadedQuestionary = await getQuestionaryById(questionary.id);

    if (settings["music-toggle"]) {
      bgm.src =
        loadedQuestionary.music ||
        (await MediaManager.loadMusic()) ||
        "/audio/bgm.mp3";
      bgm.volume = parseInt(settings["music-volume"] || 50) / 100;
    } else {
      bgm.volume = 0;
    }

    if (settings["sound-effects-toggle"]) {
      applySoundEffectsVolume(parseInt(settings["effects-volume"] || 50) / 100);
    }

    if (settings["team-colors"]) {
      applyTeamColors(settings["team-colors"]);
    }

    document.body.classList.toggle("no-blur", settings["lite-mode-toggle"]);
    if (settings["lite-mode-toggle"]) {
      document.querySelectorAll("*").forEach((el) => {
        el.style.setProperty("--tw-backdrop-blur", "blur(0px)", "important");
        el.style.setProperty("--tw-blur", "blur(0px)", "important");
      });
    }

    backgroundElement.style.backgroundImage = `url("${
      loadedQuestionary.background ||
      (await MediaManager.loadWallpaper()) ||
      "/img/default.jpg"
    }")`;

    if (!initializeAudio()) {
      document.addEventListener("click", initializeAudio, { once: true });
    }

    startButton?.addEventListener("click", () => {
      StartGame(loadedQuestionary);
    });
  } catch (error) {
    console.error("💥 Game initialization failed:", error);
    try {
      localStorage.removeItem("InGame");
    } catch (storageError) {
      console.error("🧹 Failed to clear InGame flag:", storageError);
    }
    window.location.reload();
  }
}

function loadHome() {
  const settingsManager = new SettingsManager({
    settingsIds: [
      "sound-toggle",
      "music-toggle",
      "sound-effects-toggle",
      "round-time",
      "team-colors",
      "hide-score",
      "team-names",
      "team1-name",
      "team2-name",
      "music-volume",
      "effects-volume",
      "confetti-toggle",
      "lite-mode-toggle",
      "wrong-question-mode",
      "randomize-mode",
      "release-time",
      "intermission-time",
      "inverter-toggle",
    ],
    defaultSettings: {
      "sound-toggle": true,
      "music-toggle": true,
      "sound-effects-toggle": true,
      "round-time": "30",
      "team-colors": "#FF0000-#FFA500",
      "hide-score": "during-game",
      "team-names": true,
      "team1-name": "Equipe 1",
      "team2-name": "Equipe 2",
      "music-volume": "70",
      "effects-volume": "40",
      "confetti-toggle": true,
      "wrong-question-mode": "skip",
      "randomize-mode": "both",
      "release-time": "10",
      "intermission-time": "5",
      "inverter-toggle": false,
      "lite-mode-toggle": false,
    },
  });

  async function limparTudo() {
    try {
      localStorage.clear();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
    try {
      const dbs = await indexedDB.databases();
      dbs.forEach((db) => indexedDB.deleteDatabase(db.name));
    } catch (e) {
      console.error("Erro ao limpar IndexedDB:", e);
    }
    try {
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
    } catch {}
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}
    }
    window.location.reload();
  }

  getById("ingame")?.remove();
  document.documentElement.style.setProperty("--scale-multiplier", "1.0");

  function updateScaleMultiplier(value) {
    document.documentElement.style.setProperty("--scale-multiplier", value);
  }
  const switchTab = (sectionId) => {
    const sections = document.querySelectorAll(".sect");
    const targetSection = get(sectionId);

    if (!targetSection || !targetSection.classList.contains("hidden")) return;

    sections.forEach((section) => {
      if (!section.classList.contains("hidden")) {
        section.style.transition = "transform 0.4s ease, opacity 0.4s ease";
        section.style.transform = "translateX(-100%)";
        section.style.opacity = "0";

        setTimeout(() => {
          section.classList.add("hidden");
          section.style.transition = "";
          section.style.transform = "";
          section.style.opacity = "";
        }, 400);
      }
    });

    targetSection.classList.remove("hidden");
    targetSection.style.transition = "none";
    targetSection.style.transform = "translateX(100%)";
    targetSection.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targetSection.style.transition =
          "transform 0.4s ease, opacity 0.4s ease";
        targetSection.style.transform = "translateX(0)";
        targetSection.style.opacity = "1";
      });
    });
  };

  const quizManager = new QuizManager({
    quizzes: [],
    quizListId: "quiz-list",
    searchInputId: "search-input",
    httpUrl,
    socketManager: wsManager,
  });

  let context,
    src,
    analyser,
    bgmOld = bgm;
  async function initializeAudio(forced = false) {
    if (context && src && analyser && bgm === bgmOld && !forced) {
      return true;
    }

    try {
      await bgm.play();
      bgm.loop = true;
    } catch (error) {
      console.error("Failed to play background music:", error);
      return false;
    }

    const titleLogo = getById("title-logo");
    if (!titleLogo) {
      console.warn("Title logo not found, skipping beat effect.");
      return true;
    }

    context = context || new AudioContext();
    src = context.createMediaElementSource(bgm);
    analyser = context.createAnalyser();

    src.connect(analyser);
    analyser.connect(context.destination);
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let oldbd = 1;
    function pulseToBeat() {
      analyser.getByteFrequencyData(dataArray);
      const bassBands = dataArray.slice(0, 12);

      const highBands = dataArray.slice(90, 280);
      const numHighBands = highBands.length;

      const bassAverage =
        bassBands.reduce((a, b) => a + b, 0) / bassBands.length;
      let scale = 1.0 + (bassAverage / 400) * 0.9;

      let highBoost = 0;
      const highFrequencyThreshold = 160;
      const activeHighBands = highBands.filter(
        (value) => value > highFrequencyThreshold
      ).length;

      highBoost = activeHighBands * 0.1;
      scale += highBoost;

      let div = 2;
      if (scale > 3) div = 3;
      if (scale > 4) div = 5;
      if (scale > 6) div = 7;
      if (scale > 7) div = 9;
      if (scale > 10) div = 13;
      if (scale > 13) div = 14;
      if (scale > 17) div = 15;
      if (scale > 21) div = 17;
      if (scale > 25) div = 20;
      scale = Math.min(scale / div, 2.0);
      scale = Math.max(scale, 1.0);

      scale = Math.max(scale, oldbd - 0.125);
      scale = Math.min(scale, oldbd + 0.125);

      oldbd = scale;
      updateScaleMultiplier(scale);
      requestAnimationFrame(pulseToBeat);
    }

    requestAnimationFrame(pulseToBeat);

    bgmOld = bgm;

    return true;
  }

  async function init() {
    settingsManager.initialize();
    FileUploader.initialize(wsManager);

    function updateUsername(name) {
      const el = getById("username-goodmorning");
      const el2 = getById("username-display");
      if (el) el.innerText = name;
      if (el2) el2.innerText = name;
    }

    const gameBg = get(".game-bg");

    const buttons = {
      home: get(".home-btn"),
      store: get(".store-btn"),
      addons: get(".addons-btn"),
      controller: get(".controller-btn"),
      builder: get(".builder-btn"),
      uploader: get(".uploader-btn"),
      settings: get(".settings-btn"),
      quit: get(".quit-btn"),
      clearData: get(".clear-data-btn"),
      reload: get(".reload-btn"),
      refresh: get(".refresh-btn"),
      login: get("#login-btn"),
    };

    const inputs = {
      liteMode: getById("lite-mode-toggle"),
      music: getById("game-music"),
      background: getById("game-background"),
      soundToggle: getById("sound-toggle"),
      musicToggle: getById("music-toggle"),
      effectsToggle: getById("sound-effects-toggle"),
      musicVolume: getById("music-volume"),
      effectsVolume: getById("effects-volume"),
      teamNames: getById("team-names"),
      teamNameInputs: getById("team-name-inputs"),
    };

    function updateBgmVolume() {
      bgm.volume =
        inputs.musicToggle.checked && inputs.soundToggle.checked
          ? inputs.musicVolume.value / 100
          : 0;
    }

    function updateEffectsVolume() {
      const volume =
        inputs.effectsToggle.checked && inputs.soundToggle.checked
          ? inputs.effectsVolume.value / 100
          : 0;
      Object.values(soundEffects).forEach((s) => (s.volume = volume));
    }

    function setupAudio() {
      if (!initializeAudio()) {
        ["click", "keydown"].forEach((ev) =>
          document.addEventListener(ev, initializeAudio)
        );
      }
      updateBgmVolume();
      updateEffectsVolume();
    }

    document.body.classList.toggle("no-blur", inputs.liteMode.checked);
    inputs.liteMode?.addEventListener("change", (e) => {
      document.body.classList.toggle("no-blur", e.target.checked);
    });

    inputs.music?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const musicUrl = reader.result;
        bgm.src = musicUrl;
        bgm.load();
        await MediaManager.saveMusic(musicUrl);
        initializeAudio(true);
      };
      reader.readAsDataURL(file);
    });

    inputs.background?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const imageUrl = reader.result;
        gameBg.style.backgroundImage = `url(${imageUrl})`;
        await MediaManager.saveWallpaper(imageUrl);
      };
      reader.readAsDataURL(file);
    });

    inputs.soundToggle?.addEventListener("click", () => {
      const isEnabled = inputs.soundToggle.checked;
      if (!isEnabled) {
        bgm.volume = 0;
        Object.values(soundEffects).forEach((s) => (s.volume = 0));
      } else {
        updateBgmVolume();
        updateEffectsVolume();
      }
    });

    inputs.musicToggle?.addEventListener("change", updateBgmVolume);
    inputs.effectsToggle?.addEventListener("change", updateEffectsVolume);
    inputs.musicVolume?.addEventListener("input", updateBgmVolume);
    inputs.effectsVolume?.addEventListener("input", updateEffectsVolume);
    inputs.teamNames?.addEventListener("change", (e) => {
      inputs.teamNameInputs.classList.toggle("hidden", false);
    });

    inputs.teamNameInputs.classList.toggle("hidden", false);
    document.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        soundEffects.tabSwitch.play();
        soundEffects.tabSwitch.currentTime = 0;
      });
    });

    buttons.home?.addEventListener("click", () => switchTab("#status-section"));
    buttons.builder?.addEventListener("click", () =>
      switchTab("#builder-section")
    );
    buttons.controller?.addEventListener("click", () =>
      switchTab("#control-section")
    );
    buttons.uploader?.addEventListener("click", () =>
      switchTab("#file-uploader-section")
    );
    buttons.settings?.addEventListener("click", () =>
      switchTab("#config-section")
    );
    buttons.refresh?.addEventListener("click", () =>
      wsManager.send({ type: "list-questionaries" })
    );
    buttons.reload?.addEventListener("click", () => window.location.reload());
    buttons.clearData?.addEventListener("click", limparTudo);
    buttons.login?.addEventListener("click", async () => {
      const { username, password } = await LoginModal.show();
      if (!username || !password)
        return FlashModal.show({
          type: "error",
          text: "Campos inválidos",
        });

      wsManager.send({ type: "login", username, password });
      buttons.login.disabled = true;

      FlashModal.show({
        type: "info",
        text: "Login sendo processado!",
      });
    });
    buttons.quit?.addEventListener("click", () => {
      Swal.fire({
        title: "Tem certeza que deseja encerrar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim",
        cancelButtonText: "Não",
      }).then((result) => {
        if (!result.isConfirmed) return;

        bgm.pause();
        bgm.currentTime = 0;
        Object.values(soundEffects).forEach((s) => {
          s.pause();
          s.currentTime = 0;
        });
        bgm = null;

        context?.close();

        document.body.innerHTML = "";
        Object.assign(document.body.style, {
          backgroundColor: "black",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          margin: "0",
        });

        const msg = document.createElement("div");
        Object.assign(msg.style, {
          color: "white",
          fontSize: "2rem",
          fontFamily: "Quicksand, sans-serif",
          zIndex: 99999,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          textAlign: "center",
          opacity: 1,
          transition: "opacity 0.5s ease-in-out",
        });
        msg.textContent = "Até mais!";
        document.body.appendChild(msg);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            msg.style.opacity = 0;
          });
        });

        setTimeout(() => {
          wsManager.send({ type: "shutdown" });
          wsManager.disconnect();
          wsManager.stop();
        }, 600);
      });
    });

    wsManager.on("onConnect", () => {
      wsManager.send({ type: "list-questionaries" });
    });
    const buildVersion = "Beta v2.1.0";

    wsManager.on("onVersionReceived", (data) => {
      let version
      if (!data || !data.version) {
        version = "Beta v2.1.0"
      } else {
        
       version = data.version;
      }
      const currentVersion = buildVersion
        .replace("Beta v", "")
        .split(".")
        .map(Number);
      const remoteVersion = version
        .replace("Alpha v", "")
        .replace("Beta v", "")
        .split(".")
        .map(Number);
      let isOutdated = 0;

      for (let i = 0; i < currentVersion.length; i++) {
        if (remoteVersion[i] > currentVersion[i]) {
          FlashModal.show({
            type: "warning",
            text: "Nova versão disponível!",
            subtext: `Você está usando a versão ${buildVersion}, mas a versão ${version} já está disponível.`,
          });
          isOutdated = 1;
          break;
        } else if (remoteVersion[i] < currentVersion[i]) {
          isOutdated = 2;
          break;
        }
      }
      if (isOutdated === 1) {
        getById("version-fixed").classList.add("text-red-500");
        getById("game-version").classList.add("text-red-500");
        getById("version-fixed").classList.remove("text-green-600");
        getById("game-version").classList.remove("text-green-600");
      }
      if (isOutdated === 2) {
        getById("version-fixed").textContent =
          buildVersion +
          " (mais recente: " +
          version +
          ", atualizado demais, devbuild?)";
        getById("game-version").textContent =
          buildVersion +
          " (mais recente: " +
          version +
          ", atualizado demais, devbuild?)";
      } else {
        getById("version-fixed").textContent =
          buildVersion + " (mais recente: " + version + ")";
        getById("game-version").textContent =
          buildVersion + " (mais recente: " + version + ")";
      }
    });
    wsManager.on("onAuth", (data) => {
      if (data.status === "success") {
        buttons.login.disabled = true;
        buttons.login.classList.add("hidden");
        updateUsername(data.user.name);
        getById("institution-display").textContent = data.user.institutionName;
        getById("institution-display").classList.remove("hidden");
      } else {
        buttons.login.disabled = false;
      }
    });
    wsManager.on("onUuidReceived", (uuid) => {
      Toasty.show("Socket conectado!", { type: "success", duration: 3000 });
      wsManager.updateUuidElement(uuid, true);
    });

    wsManager.on("onQuestionaryReceived", (quizzes) => {
      quizManager.setQuizzes(quizzes);
    });

    wsManager.on("onButtonPressed", (event) => {
      const settings = JSON.parse(localStorage.getItem("gameSettings") || "{}");
      const buttons = {
        1: settings["inverter-toggle"] ? 2 : 1,
        2: settings["inverter-toggle"] ? 1 : 2,
      };
      if (buttons[event]) ButtonPressCalibrator(buttons[event]);
    });

    wsManager.on("onBtnModern", (event) => {
      let btnId = null;

      let pinMappings = JSON.parse(localStorage.getItem("pins")) || {
        left: [],
        right: [],
        reset: [],
      };

      if (pinMappings.left.includes(event.data.button)) {
        btnId = 1;
      } else if (pinMappings.right.includes(event.data.button)) {
        btnId = 2;
      } else if (pinMappings.reset.includes(event.data.button)) {
        return;
      }

      if (btnId !== null) {
        const settings = JSON.parse(localStorage.getItem("gameSettings") || "{}");
        if (settings["inverter-toggle"]) {
          btnId = btnId === 1 ? 2 : 1;
        }
        ButtonPressCalibrator(btnId);
      }
    });


    wsManager.on("onControllerStatusChanged", (isConnected) => {
      wsManager.updateControllerStatusElement(isConnected);
      hasController = isConnected;
    });

    wsManager.on("onDisconnect", () => {
      wsManager.updateConnectionStatus(false);
      wsManager.updateUuidElement(null, false);
      hasController = false;
    });

    wsManager.on("onError", (error) => {
      console.error("WebSocket error:", error);
    });

    wsManager.connect();

    new ModernModeController(wsManager, settingsManager);
    setupAudio();
  }

  return init;
}

function waitLoad() {
  return new Promise((resolve) => {
    const checkIfLoaded = () => {
      if (
        document.readyState === "complete" &&
        !window.performance
          .getEntriesByType("resource")
          .some(
            (r) =>
              r.initiatorType === "xmlhttprequest" ||
              r.initiatorType === "fetch"
          )
      ) {
        resolve();
      } else {
        setTimeout(checkIfLoaded, 100);
      }
    };
    checkIfLoaded();
  });
}
const debugMode = false;

let thisLoaded = false;
window.addEventListener("message", async (event) => {
  if (event.data != "loaded" || thisLoaded || window.wasLoaded) return;
  thisLoaded = true;
  window.wasLoaded = true;
  if (localStorage.getItem("InGame") === "true") {
    const loadingScreen = getById("loading-screen");
    const game = getById("ingame");

    if (debugMode) {
      if (loadingScreen) {
        loadingScreen.style.display = "none";
      }

      LoadGame();
    } else {
      if (loadingScreen) {
        loadingScreen.style.opacity = "1";
        loadingScreen.style.transition = "opacity 1s";
        setTimeout(() => {
          loadingScreen.style.opacity = "0";
          setTimeout(() => {
            game.style.animation = "zoom-in 0.5s ease-in-out forwards";
            loadingScreen.style.display = "none";
            LoadGame();
          }, 300);
        }, 200);
      }
    }
  } else {
    const home = loadHome();
    await waitLoad();

    const gameBg = get(".game-bg");
    if (gameBg) {
      await new Promise((r) =>
        MediaManager.loadWallpaper().then((storedBackground) => {
          gameBg.style.backgroundImage = `url(${
            storedBackground || "/img/default.jpg"
          })`;
          r();
        })
      );
    }

    await new Promise((r) =>
      MediaManager.loadMusic().then((storedMusic) => {
        bgm.src = storedMusic || "/audio/bgm.mp3?nocache=" + Date.now();
        bgm.load();
        audioInitialized = false;
        r();
      })
    );
    await waitLoad();
    if (debugMode) {
      const loadingScreen = getById("loading-screen");

      if (loadingScreen) {
        loadingScreen.style.display = "none";
      }

      home();
      return;
    }

    const loadingScreen = getById("loading-screen");
    const gameElement = getById("game");
    const container = get(".before-game");
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.transition = "opacity 0.2s";
        loadingScreen.style.opacity = "0";
        setTimeout(() => {
          loadingScreen.style.display = "none";
          if (gameElement && container) {
            container.style.animation = "zoom-in 0.5s ease-in-out forwards";
            home();
          }
        }, 200);
      }, 200);
    }
  }
});

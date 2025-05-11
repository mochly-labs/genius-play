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
    console.log(currentGame.getQuestion());
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
      console.log(event);
      if (!currentGame) return;
      const buttons = {
        1: settings["inverter-toggle"] ? "left" : "right",
        2: settings["inverter-toggle"] ? "right" : "left",
        3: "reset",
      };
      if (buttons[event]) currentGame.setSelected(buttons[event]);
    });

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
      bgm.src = loadedQuestionary.music || await MediaManager.loadMusic() || "/audio/bgm.mp3";
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
    analyser.fftSize = 64;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function pulseToBeat() {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const scale = Math.max(Math.min(3, 0.5 + average / 200), 1);
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

    const greetingKey = "user-greeting";

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
      if (!username || !password) return FlashModal.show({
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

        wsManager.disconnect();
        wsManager.stop();
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

        setTimeout(() => window.close(), 600);
      });
    });

    wsManager.on("onConnect", () => {
      wsManager.send({ type: "list-questionaries" });
    });
    wsManager.on("onAuth", (data) => {
      console.log(data)
      if (data.status === "success") {
        buttons.login.disabled = true;
        buttons.login.classList.add("hidden");
        updateUsername(data.user.name);
        getById("institution-display").textContent = data.user.institutionName;
        getById("institution-display").classList.remove("hidden");

        FlashModal.show({
          type: "success",
          text: "Olá, " + data.user.name + "!",
        });
      } else {
        buttons.login.disabled = false;
        FlashModal.show({
          type: "error",
          text: "Falha ao autenticar!",
          subtext: data.error,
        })
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
  if (event.data != "loaded" || thisLoaded) return;
  thisLoaded = true;
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

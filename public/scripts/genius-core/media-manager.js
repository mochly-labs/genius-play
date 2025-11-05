
const MediaManager = {
  DB_NAME: "MediaDB",
  STORE_WALLPAPER: "wallpaper",
  STORE_MUSIC: "music",
  KEY: "currentMedia",

  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_WALLPAPER)) {
          db.createObjectStore(this.STORE_WALLPAPER);
        }
        if (!db.objectStoreNames.contains(this.STORE_MUSIC)) {
          db.createObjectStore(this.STORE_MUSIC);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveMedia(storeName, base64Data) {
    try {
      const db = await this.getDB();
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(base64Data, this.KEY);
      return tx.complete;
    } catch (error) {
      console.error(`Failed to save ${storeName}:`, error);
      throw error;
    }
  },

  async loadMedia(storeName) {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(this.KEY);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Failed to load ${storeName}:`, error);
      return null;
    }
  },

  saveWallpaper: function (base64Data) {
    return this.saveMedia(this.STORE_WALLPAPER, base64Data);
  },
  loadWallpaper: function () {
    return this.loadMedia(this.STORE_WALLPAPER);
  },
  saveMusic: function (base64Data) {
    return this.saveMedia(this.STORE_MUSIC, base64Data);
  },
  loadMusic: function () {
    return this.loadMedia(this.STORE_MUSIC);
  },
};


let soundEffects = {
  click: new Audio("/audio/click.mp3"),
  incorrect: new Audio("/audio/incorrect.mp3"),
  correct: new Audio("/audio/correct.mp3"),
  score: new Audio("/audio/score.mp3"),
  suspense: new Audio("/audio/suspense.mp3"),
  win: new Audio("/audio/win.mp3"),
  tabSwitch: new Audio("/audio/tab-switch.mp3"),
};

let bgm = new Audio("/audio/bgm.mp3?nocache=" + Date.now());
let isAudioInitialized = false;



  const initializeAudio = async () => {
    let audioInitialized = false;
    if (!audioInitialized) {
      audioInitialized = true;
      bgm.loop = true;
      try {
        bgm.play().catch((error) => {
          console.error("Failed to play:", error);
        });
      } catch (e) {
        console.log("no permission");
        audioInitialized = false;
        return false;
      }

      const titleLogo = document.getElementById("title-logo");
      if (titleLogo) {
        if (!context || bgm !== bgmOld) context = new AudioContext();
        if (!src || bgm !== bgmOld) src = context.createMediaElementSource(bgm);
        if (!analyser || bgm !== bgmOld) analyser = context.createAnalyser();
        if (bgm !== bgmOld) {
          bgmOld = bgm;
          analyser.disconnect();
          src.disconnect();
        }

        src.connect(analyser);
        analyser.connect(context.destination);
        analyser.fftSize = 64;

        const bufferLength = analyser.frequencyBinCount;
        let dataArray = new Uint8Array(bufferLength);

        function pulseToBeat() {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          updateScaleMultiplier(
            Math.max(Math.min(2, 0.5 + average / 250), 0.75)
          );
          requestAnimationFrame(pulseToBeat);
        }
        requestAnimationFrame(pulseToBeat);
      }
      return true;
    }
  };
class SettingsManager {
  constructor({ settingsIds, defaultSettings }) {
    this.SETTINGS_IDS = Object.freeze(settingsIds);
    this.DEFAULT_SETTINGS = Object.freeze(defaultSettings);
  }

  saveSettings() {
    const settings = {};

    this.SETTINGS_IDS.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      settings[id] =
        element.type === "checkbox" ? element.checked : element.value;
    });

    this.WriteRaw("gameSettings", settings);
  }

  loadSettings() {
    try {
      const savedSettings = this.ReadRaw("gameSettings") || {};
      const mergedSettings = { ...this.DEFAULT_SETTINGS, ...savedSettings };

      this.SETTINGS_IDS.forEach((id) => {
        const element = document.getElementById(id);
        if (!element || !(id in mergedSettings)) return;

        const value = mergedSettings[id];

        if (element.type === "checkbox") {
          element.checked = value;
        } else if (element instanceof HTMLSelectElement && element.multiple) {
          Array.from(element.options).forEach((opt) => {
            opt.selected = Array.isArray(value) && value.includes(opt.value);
          });
        } else {
          element.value = value;
        }

        element.dispatchEvent(new Event("change"));
        if (element.type !== "checkbox") {
          element.dispatchEvent(new Event("input"));
        }
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  setupAutoSave() {
    this.saveSettings();
    this.SETTINGS_IDS.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return console.warn(`Element with ID ${id} not found.`);

      element.addEventListener("change", () => this.saveSettings());
      element.addEventListener("input", () => this.saveSettings());
    });
  }

  initialize() {
    this.loadSettings();
    this.setupAutoSave();
  }

  WriteRaw(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save raw data for key "${key}":`, error);
    }
  }

  ReadRaw(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Failed to read raw data for key "${key}":`, error);
      return null;
    }
  }
}

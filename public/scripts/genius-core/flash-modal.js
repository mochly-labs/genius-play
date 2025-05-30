// FlashModal.js - A simple modal notification library
// Copyright (MIT, github.com/caffwydev & github.com/mochly-labs for Genius Play project)

const FlashModal = (() => {
  function createIcon(type) {
    const wrapper = document.createElement("div");
    wrapper.className = `flash-modal-icon ${type}`;
    if (type === "success") {
      wrapper.innerHTML = `<div class="checkmark"></div>`;
    } else if (type === "error") {
      wrapper.innerHTML = `<div class="cross"><span></span><span></span></div>`;
    } else if (type === "warning") {
      wrapper.innerHTML = `<div class="exclamation">!</div>`;
    } else if (type === "wave") {
      wrapper.innerHTML = `<div class="wave"><span class="wave-emoji">👋</span></div>`;
    } else {
      wrapper.innerHTML = `<div class="info">i</div>`;
    }
    return wrapper;
  }

  function injectStyles() {
    if (document.getElementById("flash-modal-styles")) return;
    const style = document.createElement("style");
    style.id = "flash-modal-styles";
    style.textContent = `
      .flash-modal-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
        animation: pop 0.4s ease forwards;
      }
      .flash-modal-icon.success .checkmark {
        width: 20px;
        height: 40px;
        border-right: 5px solid #4ade80;
        border-bottom: 5px solid #4ade80;
        transform: rotate(45deg);
        animation: draw-check 0.5s ease forwards;
      }
      .flash-modal-icon.error .cross span {
        position: absolute;
        width: 40px;
        height: 5px;
        background: #f87171;
        top: 50%;
        left: 50%;
        transform-origin: center;
      }
      .flash-modal-icon.error .cross span:first-child {
        transform: translate(-50%, -50%) rotate(45deg);
        animation: cross1 0.5s ease forwards;
      }
      .flash-modal-icon.error .cross span:last-child {
        transform: translate(-50%, -50%) rotate(-45deg);
        animation: cross2 0.5s ease forwards;
      }
      .flash-modal-icon.warning .exclamation {
        font-size: 3rem;
        color: #facc15;
        animation: pulse 1s infinite;
      }
      .flash-modal-icon.info .info {
        font-size: 3rem;
        color: #38bdf8;
        animation: pulse 1s infinite;
      }
      .flash-modal-icon.wave .wave {
        width: 20px;
        height: 20px;
        animation: wave .2s infinite;
        font-size: 2rem;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
      }
        
      .wave-emoji {
        animation-name: wave-animation; 
        animation-duration: 2.5s;
        animation-iteration-count: infinite;
        display: inline-block;
      }

      @keyframes wave-animation {
        0% { transform: rotate( 0.0deg) }
        10% { transform: rotate(14.0deg) }
        20% { transform: rotate(-8.0deg) }
        30% { transform: rotate(14.0deg) }
        40% { transform: rotate(-4.0deg) }
        50% { transform: rotate(10.0deg) }
        60% { transform: rotate( 0.0deg) }
        100% { transform: rotate( 0.0deg) }
      }

      @keyframes pop {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes draw-check {
        0% { transform: rotate(45deg) scaleY(0); }
        100% { transform: rotate(45deg) scaleY(1); }
      }
      @keyframes cross1 {
        0% { transform: translate(-50%, -50%) rotate(45deg) scaleX(0); }
        100% { transform: translate(-50%, -50%) rotate(45deg) scaleX(1); }
      }
      @keyframes cross2 {
        0% { transform: translate(-50%, -50%) rotate(-45deg) scaleX(0); }
        100% { transform: translate(-50%, -50%) rotate(-45deg) scaleX(1); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);
  }
  injectStyles();

  /**
   * Displays a modal notification with an icon, text, and optional sound.
   *
   * @param {Object} options - Configuration options for the modal.
   * @param {string} [options.type="info"] - The type of modal to display ("info", "success", "error", "warning", "wave").
   * @param {string} [options.text=""] - The main text to display in the modal.
   * @param {string} [options.subtext=""] - The subtext to display in the modal.
   * @param {number} [options.duration=3000] - Duration in milliseconds before the modal automatically closes.
   * @param {string|Audio|null} [options.sound=null] - Sound to play when the modal is displayed. Can be a URL or an Audio object.
   * @returns {Promise} A promise that resolves when the modal is closed.
   */

  function show({
    type = "info",
    text = "",
    subtext = "",
    duration = 3000,
    sound = null,
  } = {}) {
    return new Promise((resolve, reject) => {
      let timeoutId;

      const modal = document.createElement("div");
      modal.className = "flash-modal";
      modal.innerHTML = `
      <div class="flash-modal-content"></div>
    `;

      Object.assign(modal.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "2rem",
        zIndex: 999999,
        textAlign: "center",
        padding: "1rem",
        pointerEvents: "auto",
        transition: "opacity 0.3s",
        opacity: "0",
      });

      const content = modal.querySelector(".flash-modal-content");
      Object.assign(content.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        pointerEvents: "auto",
      });

      const icon = createIcon(type);
      content.appendChild(icon);

      if (text) {
        const textEl = document.createElement("div");
        textEl.textContent = text;
        textEl.style.fontWeight = "bold";
        content.appendChild(textEl);
      }

      if (subtext) {
        const subtextEl = document.createElement("div");
        subtextEl.textContent = subtext;
        subtextEl.style.fontSize = "1rem";
        subtextEl.style.opacity = "0.8";
        content.appendChild(subtextEl);
      }

      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        modal.style.opacity = "1";
      });

      if (sound) {
        try {
          const audio = typeof sound === "string" ? new Audio(sound) : sound;
          audio.play().catch(() => {});
        } catch (e) {}
      }

      timeoutId = setTimeout(() => {
        modal.style.opacity = "0";
        setTimeout(() => {
          modal.remove();
          resolve();
        }, 300);
      }, duration);
    });
  }
  /**
   * Displays a quick modal indicating which team buzzed in.
   *
   * @param {"left"|"right"} side - The side that buzzed ("left" or "right").
   * @param {string} teamName - The name of the team.
   * @param {string} color - The team's color (any valid CSS color).
   * @returns {Promise} A promise that resolves when the modal closes.
   */
  function teamBuzz(side, teamName, color) {
    let timeoutId;
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "flash-modal team-buzz";

      Object.assign(modal.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: side === "left" ? "flex-start" : "flex-end",
        padding: "2rem",
        zIndex: 999999,
        opacity: "0",
        transition: "opacity 0.2s ease",
        pointerEvents: "auto",
      });

      const container = document.createElement("div");
      container.className = "team-buzz-container";
      Object.assign(container.style, {
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        animation: "pop 0.3s ease forwards",
      });

      const arrow = document.createElement("div");
      arrow.className = "fancy-arrow";
      Object.assign(arrow.style, {
        width: "40px",
        height: "40px",
        borderTop: `6px solid ${color}`,
        borderRight: `6px solid ${color}`,
        transform: side === "left" ? "rotate(-135deg)" : "rotate(45deg)",
        animation: "arrow-glow 1.2s infinite ease-in-out",
        filter: `drop-shadow(0 0 6px ${color})`,
      });

      const name = document.createElement("div");
      name.textContent = teamName;
      Object.assign(name.style, {
        fontSize: "3rem",
        fontWeight: "900",
        color: color,
        textShadow: `0 0 6px ${color}`,
      });

      if (side === "left") {
        container.appendChild(arrow);
        container.appendChild(name);
      } else {
        container.appendChild(name);
        container.appendChild(arrow);
      }

      modal.appendChild(container);
      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        modal.style.opacity = "1";
      });

      timeoutId = setTimeout(() => {
        modal.style.opacity = "0";
        setTimeout(() => {
          modal.remove();
          resolve();
        }, 300);
      }, 1500);
    });
  }

  return { show, teamBuzz };
})();

const LoginModal = (() => {
  function injectStyles() {
    if (document.getElementById("login-modal-styles")) return;
    const style = document.createElement("style");
    style.id = "login-modal-styles";
    style.textContent = `
      /* Modal Container */
      .login-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        animation: fadeIn 0.4s ease-out;
      }

      /* Modal Content */
      .login-modal-content {
        background-size: 400% 400%;
        animation: gradientBackground 6s ease infinite;
        border-radius: 20px;
        padding: 2.5rem;
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        color: white;
        text-align: center;
        font-size: 1.2rem;
        box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.3);
        transform: scale(0.95);
        animation: popUp 0.6s ease-out forwards;
      }

      /* Header */
      .login-modal-content h2 {
        font-size: 2rem;
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 1rem;
        color: #ffffff;
      }

      /* Input Fields */
      .login-modal input {
        padding: 0.8rem;
        border: 2px solid #ffffff;
        border-radius: 10px;
        background-color: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 1rem;
        width: 100%;
        transition: border-color 0.3s;
      }

      /* Focus Effect on Inputs */
      .login-modal input:focus {
        outline: none;
        border-color: #f97316;
        box-shadow: 0px 0px 10px rgba(255, 165, 0, 0.5);
      }

      /* Button */
      .login-modal button {
        padding: 1rem;
        background-color: #38bdf8;
        border: none;
        border-radius: 10px;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background-color 0.3s ease, transform 0.2s ease;
      }

      /* Button Hover Effect */
      .login-modal button:hover {
        background-color: #2563eb;
        transform: scale(1.05);
      }

      /* Animations */
      @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }

      @keyframes gradientBackground {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes popUp {
        0% { transform: scale(0.95); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  injectStyles();

  function show() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "login-modal";
      modal.innerHTML = `
        <div class="login-modal-content bg-black/50">
          <h2>Login</h2>
          <input type="text" id="username" placeholder="Nome de usuário" required />
          <input type="password" id="password" placeholder="Senha" required />
          <button id="login-btn">Login</button>
        </div>
      `;

      document.body.appendChild(modal);

      const loginButton = modal.querySelector("#login-btn");
      loginButton.addEventListener("click", () => {
        const username = modal.querySelector("#username").value;
        const password = modal.querySelector("#password").value;
        modal.style.opacity = "0";
        setTimeout(() => {
          modal.remove();
          resolve({ username, password });
        }, 300);
      });

      requestAnimationFrame(() => {
        modal.style.opacity = "1";
      });
    });
  }

  return { show };
})();

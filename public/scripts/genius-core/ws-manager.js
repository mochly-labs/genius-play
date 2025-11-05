class WebSocketManager {
  constructor(url, options = {}) {
    this.wsUrl = url;
    this.socket = null;
    this.uuid = null;
    this.keepAliveTimeout = null;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.keepAliveTimeoutDuration = options.keepAliveTimeout || 60000;
    this.quizzes = [];
    this.stopped = false;
    this.eventHandlers = {
      onConnect: [],
      onDisconnect: [],
      onUuidReceived: [],
      onQuestionaryReceived: [],
      onControllerStatusChanged: [],
      onError: [],
      onButtonPressed: [],
      onAuth: [],
      onVersionReceived: [],
      onScanResult: [],
      onState: [],
      onErrorResponse: [],
      onBtnModern: []
    };
  }

  connect() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
        console.warn(message)
      } catch (error) {
        console.error("Error parsing message:", error);
        this.triggerEvent("onError", error);
      }
    };

    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: "handshake" }));
      this.triggerEvent("onConnect");
      this.updateConnectionStatus(true);
    };

    this.socket.onclose = (x) => {
      clearTimeout(this.keepAliveTimeout);
      this.triggerEvent("onDisconnect");
      this.updateConnectionStatus(false);
      this.scheduleReconnect();
      console.error("WebSocket error!??!?!", x);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.triggerEvent("onError", error);
    };
  }

  handleMessage(message) {
    console.log(message)
    switch (message.type) {
      case "uuid":
        this.handleUuidMessage(message);
        break;
      case "keepalive":
        this.resetKeepAliveTimeout();
        break;
      case "questionary":
        this.handleQuestionaryMessage(message);
        break;
      case "handshake":
        break;
      case "status":
        console.log("Status msg:", message, message.type);
        this.handleStatusMessage(message);
        break;
      case "button":
        this.eventHandlers.onButtonPressed.forEach((handler) =>
          handler(message.data)
        );
        break;
      case "stop":
        this.stop();
        break;
      case "auth":
        this.handleAuthMessage(message);
        break;
      case "version":
        this.handleVersionMessage(message);
        break;

      case "scanresult":
        this.triggerEvent("onScanResult", message.data);
        break;
      case "state":
        this.triggerEvent("onState", message.data);
        break;
      case "error":
        this.triggerEvent("onErrorResponse", message.data);
        break;
      case "modernBtn":
        this.triggerEvent("onBtnModern", message);
        break;
      default:
        console.log("Message received from server:", message);
    }
  }

  handleAuthMessage(message) {
    this.triggerEvent("onAuth", message.data);
  }

  handleVersionMessage(message) {
    this.triggerEvent("onVersionReceived", message.data);
  }

  handleUuidMessage(message) {
    this.socket.send(JSON.stringify({ type: "list-questionaries" }));
    this.uuid = message.uuid;
    this.triggerEvent("onUuidReceived", this.uuid);
    this.updateUuidElement(this.uuid, true);
  }

  handleQuestionaryMessage(message) {
    const questionaryList = message.data;
    if (questionaryList) {
      this.quizzes = Object.values(questionaryList);
      this.triggerEvent("onQuestionaryReceived", this.quizzes);
    }
  }

  handleStatusMessage(message) {
    const isConnected =
      (message.status &&
        (message.status === true || message.status === "true")) ||
      (message.data && (message.data === true || message.data === "true"));
    this.triggerEvent("onControllerStatusChanged", isConnected);
    console.log("COnnected?", isConnected)
    this.updateControllerStatusElement(isConnected);
  }

  resetKeepAliveTimeout() {
    clearTimeout(this.keepAliveTimeout);
    this.keepAliveTimeout = setTimeout(() => {
      console.warn("No keepalive received. Reconnecting...");
      this.socket.close();
    }, this.keepAliveTimeoutDuration);
  }

  scheduleReconnect() {
    if (!this.stopped) setTimeout(() => this.connect(), this.reconnectInterval);
  }

  updateConnectionStatus(isConnected) {
    const element = document.getElementById("websocket-connected");
    if (!element) return;

    if (isConnected) {
      element.classList.remove("text-red-600");
      element.classList.add("text-green-600");
      element.textContent = "Sim";
    } else {
      element.classList.remove("text-green-600");
      element.classList.add("text-red-600");
      element.textContent = "Não";
    }
  }

  updateUuidElement(uuid, isConnected) {
    const element = document.getElementById("my-uuid");
    if (!element) return;

    if (isConnected) {
      element.classList.remove("text-yellow-500");
      element.classList.add("text-green-600");
      element.textContent = uuid;
    } else {
      element.classList.remove("text-green-600");
      element.classList.add("text-yellow-500");
      element.textContent = "Sem UUID";
    }
  }

  updateControllerStatusElement(isConnected) {
    const element = document.getElementById("controller-connected");
    if (!element) return;

    if (isConnected) {
      element.classList.remove("text-red-600");
      element.classList.add("text-green-600");
      element.textContent = "Sim";
    } else {
      element.classList.add("text-red-600");
      element.classList.remove("text-green-600");
      element.textContent = "Não";
    }
  }

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  triggerEvent(event, ...args) {
    this.eventHandlers[event].forEach((handler) => handler(...args));
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  stop() {
    this.stopped = true;
    this.disconnect();
    this.quizzes = [];
  }
}

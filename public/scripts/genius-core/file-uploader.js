const FileUploader = {
  handleFileSelection(event) {
    const fileName = event.target.files[0]?.name || "No file selected";
    this.uploadFile();
  },

  uploadFile() {
    const fileInput = document.getElementById("file-input");
    if (!fileInput.files.length) {
      this.showToast("No file selected!", "error");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        await this.sendFileViaWebSocket(reader.result);
      } catch (error) {
        this.showToast("File upload failed!", "error");
        console.error("Upload error:", error);
      }
    };

    reader.onerror = () => {
      this.showToast("Error reading file!", "error");
    };

    reader.readAsText(file);
  },

  async sendFileViaWebSocket(fileData) {
    if (!this.socket || this.socket.socket.readyState !== WebSocket.OPEN) {
      this.showToast("WebSocket not connected!", "error");
      return;
    }

    return new Promise((resolve, reject) => {
      const handleResponse = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "upload") {
            this.socket.socket.removeEventListener("message", handleResponse);

            if (message.success) {
              this.showToast("File uploaded successfully!", "success");
              wsManager.send({
                type: "list-questionaries"
              })
              resolve();
            } else {
              this.showToast("File upload failed!", "error");
              reject(new Error("Server rejected upload"));
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.socket.socket.addEventListener("message", handleResponse);
      this.socket.socket.send(
        JSON.stringify({
          type: "upload",
          data: fileData,
        })
      );
    });
  },

  showToast(message, type) {
    if (typeof Toasty?.show === "function") {
      Toasty.show(message, { type, duration: 3000 });
    }
  },

  initialize(wsManager) {
    this.socket = wsManager;
    const fileInput = document.getElementById("file-input");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => this.handleFileSelection(e));
    }
  },
};

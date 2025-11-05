class QuizManager {
  constructor({
    quizzes = [],
    quizListId,
    searchInputId,
    httpUrl,
    socketManager,
  }) {
    this.quizzes = quizzes;
    this.filteredQuizzes = quizzes;
    this.quizList = document.getElementById(quizListId);
    this.searchInput = document.getElementById(searchInputId);
    this.httpUrl = httpUrl;
    this.socket = socketManager;
    this.previous = [];
    this.isRendering = false;
    this.bindSearch();
  }

  bindSearch() {
    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => this.filterAndRender());
    }
  }

  async fetchBackground(url) {
    try {
      const response = await fetch(`${httpUrl}/upload/${url.split("/").pop()}`);
      if (!response.ok) throw new Error(response.statusText);

      const data = await response.json();
      return data.background || null;
    } catch (error) {
      console.error("Failed to fetch background:", error);
      return "/img/placeholder.webp";
    }
  }

  deleteQuiz(quiz) {
    console.log(quiz);
    this.socket.send({
      type: "delete",
      file: `${quiz.url.split("/").pop()}`,
    });
    this.socket.send({
      type: "list-questionaries",
    });
  }
  async play(questionaryid) {
    if (!hasController) {
      return FlashModal.show({
        type: "error",
        title: "Humm...",
        subtext: "O controlador com o software Genius Play não foi detectado.",
        duration: 1000
      })
    }
    try {
      const questionary = await this.getById(questionaryid);
      localStorage.setItem("questionary", JSON.stringify(questionary));

      function fadeOutBGMAndReload() {
        const fadeDuration = 2500;
        const fadeInterval = 10;
        const fadeStep =
          (bgm.volume * 100) / ((fadeDuration / 2) / fadeInterval);

        const fadeOut = setInterval(() => {
          if (bgm.volume > 0) {
            let oldvol = bgm.volume;
            bgm.volume = Math.max(0, bgm.volume * 100 - fadeStep) / 100;
            console.log("From: " + oldvol + " To: " + bgm.volume);
          } else {
            clearInterval(fadeOut);
            bgm.pause();
            bgm.currentTime = 0;
          }
        }, fadeInterval);

        const ls = document.getElementById("loading-screen");
        if (ls) {
          ls.style.display = "";
          ls.classList.remove("hidden");
          ls.style.opacity = "0";
          ls.style.transition = `opacity ${(fadeDuration - 200) / 1000}s`;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              ls.style.opacity = "1";
            });
          });
        }

        const beforeGame = document.querySelector("#home-content");
        if (beforeGame) beforeGame.style.transform = "scale(0)";

        setTimeout(() => {
          localStorage.setItem("InGame", "true")
          window.location.reload();
        }, fadeDuration + 100);
      }

      fadeOutBGMAndReload();
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  }

  async createCard(quiz) {
    const card = document.createElement("div");
    card.className =
      "quiz-card bg-black/20 backdrop-blur-sm p-6 rounded-lg shadow-md flex flex-col items-center text-center space-y-4";

    if (quiz.hasBackground) {
      const img = document.createElement("img");
      const backgroundUrl = await this.fetchBackground(quiz.url);
      img.src = backgroundUrl || "/img/placeholder.webp";
      img.alt = "Quiz Wallpaper";
      img.className = "w-full rounded-t-lg object-cover max-h-48"; // Garantir que o wallpaper fique no topo
      card.appendChild(img);
    }

    const title = document.createElement("h3");
    title.className = "text-lg font-bold text-white mt-2";
    title.textContent = quiz.title;
    card.appendChild(title);

    const iconContainer = document.createElement("div");
    iconContainer.className =
      "flex gap-4 mt-2 w-full justify-end items-end h-full";
    const deleteIcon = document.createElement("i");
    deleteIcon.className =
      "fas fa-trash cursor-pointer text-transparent bg-gradient-to-br from-red-500 to-red-800 bg-clip-text p-2 rounded-full hover:scale-110 transition-transform";
    deleteIcon.addEventListener("click", () => this.deleteQuiz(quiz));
    iconContainer.appendChild(deleteIcon);

    const downloadIcon = document.createElement("i");
    downloadIcon.className =
      "fas fa-download cursor-pointer text-transparent bg-gradient-to-br from-blue-500 to-blue-800 bg-clip-text p-2 rounded-full hover:scale-110 transition-transform";
    downloadIcon.addEventListener("click", () => this.downloadQuiz(quiz));
    iconContainer.appendChild(downloadIcon);

    const playIcon = document.createElement("i");
    playIcon.className =
      "fas fa-play cursor-pointer text-transparent bg-gradient-to-br from-green-500 to-green-800 bg-clip-text p-2 rounded-full hover:scale-110 transition-transform";
    playIcon.addEventListener("click", () =>
      this.play(quiz.url.split("/").pop().split(".")[0])
    );
    iconContainer.appendChild(playIcon);

    const infoGroup = document.createElement("div");
    infoGroup.className =
      "flex flex-wrap justify-center gap-4 text-sm text-gray-400";
    infoGroup.innerHTML = `
    <div><strong>ID:</strong> ${quiz.url
      .split("/")
      .pop()
      .replace(".json", "")}</div>
    <div><strong>Pontuação:</strong> ${quiz.totalWorth}</div>
    <div><strong>Questões:</strong> ${quiz.questionCount}</div>
  `;
    card.appendChild(infoGroup);

    const tags = document.createElement("div");
    tags.className = "flex gap-2 mt-2 flex-wrap justify-center";

    if (quiz.hasBackground) {
      const bgTag = document.createElement("span");
      bgTag.className =
        "px-3 py-1 bg-purple-500/30 text-purple-300 rounded-full text-xs";
      bgTag.textContent = "Wallpaper";
      tags.appendChild(bgTag);
    }

    if (quiz.hasMusic) {
      const musicTag = document.createElement("span");
      musicTag.className =
        "px-3 py-1 bg-blue-500/30 text-blue-300 rounded-full text-xs";
      musicTag.textContent = "Música";
      tags.appendChild(musicTag);
    }

    card.appendChild(tags);
    card.appendChild(iconContainer);

    return card;
  }

  async downloadQuiz(quiz) {
    try {
      const response = await fetch(
        `${this.httpUrl}/upload/${quiz.url.split("/").pop()}`
      );
      if (!response.ok) throw new Error("Failed to fetch the file");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = quiz.url.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading the quiz:", error);
    }
  }

  async render() {
    if (this.isRendering) return console.warn("Already rendering!");
    this.isRendering = true;
    this.quizList.innerHTML = "";
    for (const quiz of this.filteredQuizzes) {
      const card = await this.createCard(quiz);
      this.quizList.appendChild(card);
    }
    this.isRendering = false;
  }

  filterAndRender() {
    const searchInput = this.searchInput.value.toLowerCase();
    const searchKeywords = searchInput.split(" ");
    this.filteredQuizzes = this.quizzes.filter((quiz) =>
      searchKeywords.every((keyword) =>
        quiz.title.toLowerCase().includes(keyword)
      )
    );
    if (this.filteredQuizzes.length === 0) return this.render();
      if (
        this.filteredQuizzes.length === this.previous.length &&
        this.filteredQuizzes.every(
          (quiz, i) =>
            quiz.url.split("/").pop() === this.previous[i]?.url.split("/").pop()
        )
      ) {
        return;
      }

    this.previous = [...this.filteredQuizzes];
    this.render();
  }

  setQuizzes(quizzes) {
    this.quizzes = quizzes;
    this.filteredQuizzes = quizzes;
    this.previous = [];
    this.filterAndRender();
  }
  async getById(id) {
    return fetch(`${httpUrl}/upload/${id}.json`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.title) {
          console.log("Questionary loaded:", data.title);
          return { title: data.title, id };
        } else {
          throw new Error("Invalid questionary");
        }
      });
  }
}

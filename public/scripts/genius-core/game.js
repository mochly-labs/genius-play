class Game {
  constructor({ quiz, randomize }, settings) {
    let Quiz = quiz;
    if (randomize === "both" || randomize === "questions-only") {
      let seed = generate();
      Quiz.questions = shuffle(Quiz.questions, seed);
    }
    if (randomize === "both" || randomize === "alternatives-only") {
      Quiz.questions.forEach((question) => {
        let seed = generate();
        question.alternatives = shuffle(question.alternatives, seed);
        question.optionImages = shuffle(question.optionImages, seed);
      });
    }
    this.quiz = Quiz;
    this.settings = settings;
    this.currentQuestionIndex = 0;
    this.scores = { left: 0, right: 0 };
    this.waiting = false;
    this.selectedTeam = null;
    this.questionTimeout = null;
    this.endGame = false;
    this.debugSequence = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    this.debugBuffer = [];
    this.debugEnabled = false;
    window.addEventListener("keydown", (e) => {
      if (this.debugEnabled) {
        if (e.key === "d") {
          this.toggleDebugMenu();
          return;
        }
      }

      this.debugBuffer.push(e.key);
      if (this.debugBuffer.length > this.debugSequence.length) {
        this.debugBuffer.shift();
      }

      console.log(this.debugBuffer.join(","));

      if (this.debugBuffer.join(",") === this.debugSequence.join(",")) {
        this.debugBuffer = [];
        Toasty.show(
          "Menu de debug " + (this.debugEnabled ? "desativado" : "ativado")
        );
        this.debugEnabled = !this.debugEnabled;
      }
    });

    this.modals = {
      intermission: getById("intermission-screen"),
      start: getById("start-screen"),
      question: getById("question-screen"),
      end: getById("score-screen"),
    };

    this.teamElements = {
      redName: getById("team-red-name"),
      blueName: getById("team-blue-name"),
      gameTitle: getById("gp_game_title_element"),
      redBox: getById("team-red-box"),
      blueBox: getById("team-blue-box"),
      vs: getById("vs-box"),
      scoreboard: getById("scoreboard-container"),
    };

    this.applyTeamNames();
    this.intermissionCancel = () => {};
    this.intermissionIntervalId = null;
  }
  toggleDebugMenu() {
    if (document.getElementById("debug-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "debug-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "999999";

    const modal = document.createElement("div");
    modal.style.background = "#111";
    modal.style.color = "#0f0";
    modal.style.padding = "20px";
    modal.style.border = "2px solid lime";
    modal.style.borderRadius = "12px";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "10px";
    modal.style.minWidth = "240px";
    modal.style.fontFamily = "monospace";

    const options = [
      {
        label: "➕ Adicionar ponto Equipe 1",
        action: () => {
          this.updateScore("left", 1);
          this.selectedTeam = "left";
          this.atualizarScore(false, 1);
        },
      },
      {
        label: "➕ Adicionar ponto Equipe 2",
        action: () => {
          this.updateScore("right", 1);
          this.selectedTeam = "right";
          this.atualizarScore(false, 1);
        },
      },
      {
        label: "⏸ Intermissão",
        action: () =>
          this.intermission(
            3000,
            this.currentQuestionIndex + 1,
            this.quiz.questions.length
          ),
      },
      {
        label: "⏩ Pular intermissão",
        action: () => this.intermissionCancel(),
      },
      {
        label: "❓ Próxima Questão",
        action: () => {
          this.nextQuestion();
          this.iniciarPergunta();
        },
      },
      { label: "🏁 Finalizar Jogo", action: () => this.finalizarJogo() },
      {
        label: "📊 Mostrar Pontuação",
        action: () =>
          alert(
            `Pontuação atual:\nEquipe 1: ${this.scores.left}\nEquipe 2: ${this.scores.right}`
          ),
      },
      { label: "❌ Cancelar", action: null },
    ];

    for (const { label, action } of options) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.padding = "10px";
      btn.style.background = "#222";
      btn.style.border = "1px solid #0f0";
      btn.style.color = "#0f0";
      btn.style.borderRadius = "6px";
      btn.style.cursor = "pointer";
      btn.onmouseenter = () => (btn.style.background = "#333");
      btn.onmouseleave = () => (btn.style.background = "#222");

      btn.onclick = () => {
        try {
          if (action) action();
        } catch (e) {
          console.error(e);
        }
        document.body.removeChild(overlay);
      };

      modal.appendChild(btn);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  applyTeamNames() {
    const [redColor = "#0000FF", blueColor = "#FF0000"] =
      this.settings["team-colors"]?.split("-") || [];
    this.teamElements.redName.textContent =
      this.settings["team2-name"] || "Equipe 2";
    this.teamElements.redName.style.color = redColor;
    this.teamElements.blueName.textContent =
      this.settings["team1-name"] || "Equipe 1";
    this.teamElements.blueName.style.color = blueColor;
  }

  showModal(modal) {
    Object.values(this.modals).forEach((m) =>
      m?.classList.toggle("hidden", m !== modal)
    );
  }
  async intermission(time, current, total) {
    this.showModal(this.modals.intermission);
    const intermissionTimer = getById("intermission-timer-progress");
    const intermissionTimerCurrent = getById("intermission_current_question");
    const intermissionTimerTotal = getById("intermission_total_questions");
    const timerText = getById("intermission-timer-el");

    intermissionTimerCurrent.textContent = `${current}`;
    intermissionTimerTotal.textContent = `${total}`;

    let remainingTime = Math.ceil(time / 1000);

    // 💫 Cancelamento
    let cancel = false;

    // ⏳ Contagem visual
    if (timerText) {
      timerText.textContent = `${remainingTime}`;
      this.intermissionIntervalId = setInterval(() => {
        remainingTime--;
        if (remainingTime <= 0) {
          clearInterval(this.intermissionIntervalId);
        }
        timerText.textContent = `${Math.max(0, remainingTime)}`;
      }, 1000);
    }

    // 🌈 Progresso
    if (intermissionTimer) {
      intermissionTimer.style.transition = "";
      intermissionTimer.style.width = "100%";
      requestAnimationFrame(() => {
        intermissionTimer.style.transition = `width ${time / 1000}s linear`;
        requestAnimationFrame(() => {
          intermissionTimer.style.width = "0%";
        });
      });
    }
    let Resolve = () => {};
    this.intermissionCancel = () => {
      console.log("Intermission canceled!");
      cancel = true;
      clearInterval(this.intermissionIntervalId);
      timerText.textContent = "⏹ Cancelado!";
      Resolve();
    };
    return new Promise((resolve) => {
      Resolve = resolve;
      setTimeout(() => {
        if (!cancel) resolve();
      }, time);
    });
  }

  async iniciarPergunta() {
    const timeout = parseInt(this.settings["release-time"]);
    await this.intermission(
      parseInt(this.settings["intermission-time"]) * 1000,
      this.currentQuestionIndex + 1,
      this.quiz.questions.length
    );
    this.selectedTeam = null;
    const questao = this.getQuestion();
    this.renderizarPergunta(questao);
    updateTeamSelect(3);
    this.setTextoCentro(`Esperem!`);

    let segundos = timeout;
    this.iniciarTimerBar(timeout);
    const intervalo = setInterval(() => {
      segundos--;
      if (segundos <= 0) {
        updateTeamSelect(0);
        clearInterval(intervalo);
        this.setTextoCentro("VALENDO!");
        this.waiting = true;
        this.iniciarTimerBar(this.settings["round-time"]);
        this.questionTimeout = setTimeout(() => {
          this.waiting = false;
          FlashModal.show({
            text: "Tempo esgotado!",
            type: "error",
          });
          this.showModal(null);
          setTimeout(async () => {
            this.nextQuestion();
            this.iniciarPergunta();
          }, 3000);
        }, this.settings["round-time"] * 1000);
      } else {
        this.setTextoCentro(`Aguardem ${segundos} segundos`);
      }
    }, 1000);
  }

  iniciarTimerBar(segundos) {
    const barra = getById("timer-progress");
    barra.style.transition = `none`;
    barra.style.width = `100%`;
    requestAnimationFrame(() => {
      barra.style.transition = `width ${segundos}s linear`;
      requestAnimationFrame(() => {
        barra.style.width = `0%`;
      });
    });
  }

  setTextoCentro(texto) {
    const textoEl = getById("team-select-text");
    textoEl.textContent = texto;
  }
  highlightAlternative(id, correta) {
    const button = document.querySelector(`[data-id="${id}"]`);
    if (!button) return;
    button.classList.add(correta ? "correct" : "wrong");
    setTimeout(() => {
      button.classList.remove("correct", "wrong");
    }, 2000);
  }

  async verificarResposta(idSelecionado) {
    if (this.waiting || !this.selectedTeam) return;

    const pergunta = this.getQuestion();
    const correta = pergunta.correct === idSelecionado;

    const pontos = pergunta.worth;
    this.showModal(null);
    if (this.questionTimeout) clearTimeout(this.questionTimeout);
    if (correta) {
      if (this.settings["confetti-toggle"])
        confetti({
          particleCount: 100,
          startVelocity: 30,
          spread: 360,
          zIndex: 99999999,
        });
      this.highlightAlternative(idSelecionado, true);
      this.updateScore(this.selectedTeam, pontos);
      soundEffects.correct.play();
      await FlashModal.show({
        text: "Acertou!",
        type: "success",
      });
    } else {
      soundEffects.incorrect.play();
      await FlashModal.show({
        text: "Oops, resposta errada!",
        subtext:
          this.settings["wrong-question-mode"] === "retry" && !this.hasRetried
            ? "Tenta de novo, vai que dá!"
            : "Mais sorte na próxima!",
        type: "error",
      });

      this.highlightAlternative(idSelecionado, false);

      if (this.settings["wrong-question-mode"] === "pass") {
        const otherTeam = this.selectedTeam === "left" ? "right" : "left";
        this.waiting = true;
        this.setSelected(otherTeam);
        await FlashModal.show({ text: "Repassado para o adversário!" });
        this.showModal(this.modals.question);
        return;
      }
      if (
        this.settings["wrong-question-mode"] === "retry" &&
        !this.hasRetried
      ) {
        this.hasRetried = true;
        this.showModal(this.modals.question);
        return;
      }
    }

    const mostrarScore = this.settings["hide-score"] === "never";
    if (mostrarScore) {
      this.atualizarScore(false, correta ? pontos : 0);
    }

    setTimeout(() => {
      const prox = this.nextQuestion();
      if (prox) this.iniciarPergunta();
    }, 3000);
  }

  nextQuestion() {
    this.currentQuestionIndex++;
    this.hasRetried = false;
    if (this.currentQuestionIndex >= this.quiz.questions.length) {
      this.finalizarJogo();
      return false;
    }
    return this.getQuestion();
  }

  async finalizarJogo() {
    this.endGame = true;
    this.setTextoCentro("Fim do Jogo!");
    updateTeamSelect(3);

    const winnerText = getById("winner-text");
    const hideScore = this.settings["hide-score"];
    if (hideScore === "none") {
      this.setTextoCentro("Jogo finalizado!");
      return;
    }

    this.atualizarScore(false, 0);
    this.showModal(this.modals.end);
    getById("team-red-score").textContent = this.scores.right;
    getById("team-blue-score").textContent = this.scores.left;

    winnerText.textContent = "O vencedor é...";

    soundEffects.suspense.play();
    await new Promise((resolve) =>
      soundEffects.suspense.addEventListener(
        "ended",
        () => {
          resolve();
        },
        { once: true }
      )
    );
    if (this.settings["confetti-toggle"])
      confetti({
        particleCount: 1000,
        startVelocity: 80,
        zIndex: 99999999,
      }); // 🎉

    winnerText.classList.add("text-3xl", "font-bold");

    this.atualizarScore(true, 0);
    if (this.scores.left === this.scores.right) {
      const totalScore = this.scores.left + this.scores.right;
      const totalPossibleScore = this.quiz.questions.length;
      const scoreRatio = totalScore / totalPossibleScore;

      winnerText.textContent =
        scoreRatio <= 0.5
          ? "Empate! Falta estudo..."
          : "Empate! Todo mundo arrasou!";
    } else {
      const winner =
        this.scores.left > this.scores.right
          ? this.teamElements.blueBox
          : this.teamElements.redBox;

      const loser =
        this.scores.left > this.scores.right
          ? this.teamElements.redBox
          : this.teamElements.blueBox;

      // Reorganizar layout
      this.teamElements.vs.classList.add("hidden");
      this.teamElements.scoreboard.classList.remove("flex-row");
      this.teamElements.scoreboard.classList.add("flex-col", "gap-4");

      // Define a ordem no layout
      winner.classList.add(
        "animate-pulse",
        "ring-4",
        "ring-gray-300",
        "shadow-xl",
        "shadow-gray-500/50",
        "transition-all",
        "duration-700"
      );

      winner.style.order = "0";
      loser.style.order = "1";
      loser.style.transform = "scale(0.75)";
      loser.style.opacity = "0.75";
      loser.style.transition = "all 0.5s ease";

      // Mensagem fofa de parabéns ✨
      const teamName = winner.querySelector("div[id$='name']").textContent;
      winnerText.textContent = `Parabéns ${teamName}! 🎉`;
      soundEffects.win.play();
    }
    if (this.settings["confetti-toggle"])
      confetti({
        particleCount: 1000,
        startVelocity: 80,
        zIndex: 99999999,
      });
    let ticks = 20;
    if (this.settings["confetti-toggle"]) {
      let interval;
      interval = setInterval(() => {
        ticks--;
        if (ticks <= 0) {
          clearInterval(interval);
          return;
        }
        confetti({
          particleCount: 1000,
          startVelocity: 160,
          zIndex: 99999999,
          origin: {
            x: 0.5,
            y: 0.9,
          },
          ticks: 300,
        }); // 🎉
      }, 200);
    }
  }

  updateScore(team, points) {
    this.scores[team] += points;
  }

  getQuestion() {
    return this.quiz.questions[this.currentQuestionIndex];
  }

  getScore() {
    return this.scores;
  }
  plus(texto) {
    const plusOneElement = document.createElement("p");
    plusOneElement.innerHTML = texto;
    plusOneElement.classList.add(
      "one-plus",
      "text-2xl",
      "text-white",
      "font-bold"
    );

    if (this.selectedTeam === "right")
      getById("team-red-container").appendChild(plusOneElement);
    if (this.selectedTeam === "left")
      getById("team-blue-container").appendChild(plusOneElement);

    setTimeout(() => {
      plusOneElement.remove();
    }, 2000);
  }

  setSelected(team) {
    if (this.waiting) {
      this.waiting = false;

      if (this.questionTimeout) clearTimeout(this.questionTimeout);
      this.iniciarTimerBar(999999999999999999999999999999999999999);
      this.setTextoCentro(
        team === "right"
          ? this.settings["team2-name"]
          : this.settings["team1-name"]
      );
      this.selectedTeam = team;
      updateTeamSelect(team === "right" ? 2 : 1);
      FlashModal.teamBuzz(
        team,
        team === "right"
          ? this.settings["team2-name"]
          : this.settings["team1-name"],
        this.settings["team-colors"].split("-")[team === "left" ? 1 : 0]
      ).then(() => {
        this.questionTimeout = setTimeout(() => {
          this.waiting = false;
          FlashModal.show({
            text: "Tempo esgotado!",
            type: "error",
          });
          this.showModal(null);
          setTimeout(async () => {
            this.nextQuestion();
            this.iniciarPergunta();
          }, 3000);
        }, this.settings["round-time"] * 1000);
        this.iniciarTimerBar(this.settings["round-time"]);
      });
    }
  }

  setAlternatives(alternatives, container) {
    container.innerHTML = "";

    if (alternatives.length > 10) {
      const carouselWrapper = document.createElement("div");
      carouselWrapper.className =
        "carousel-wrapper flex gap-4 p-4 flex-grow overflow-x-auto rounded-lg border border-white/20 backdrop-blur-md";

      alternatives.forEach((wrapper) => carouselWrapper.appendChild(wrapper));
      container.appendChild(carouselWrapper);
      carouselWrapper.style.scrollBehavior = "smooth";

      let scrollAmount = 0;
      const scrollStep = 10;
      let wasReset = false;

      const autoScroll = () => {
        scrollAmount += scrollStep;
        if (
          scrollAmount >=
          carouselWrapper.scrollWidth - carouselWrapper.clientWidth
        ) {
          if (!wasReset) {
            wasReset = true;
            setTimeout(() => {
              scrollAmount = 0;
              wasReset = false;
            }, 2000);
          }
        }
        carouselWrapper.scrollLeft = scrollAmount;
        requestAnimationFrame(autoScroll);
      };

      autoScroll();
    } else {
      alternatives.forEach((wrapper) => container.appendChild(wrapper));
    }
  }

  renderizarPergunta(pergunta) {
    this.showModal(this.modals.question);
    const img = getById("question-image");
    const texto = getById("question-text");

    if (pergunta.image) {
      img.src = pergunta.image;
      img.classList.remove("hidden");
    } else {
      img.classList.add("hidden");
    }

    texto.textContent = pergunta.question;

    const container = getById("alternatives-container");
    container.innerHTML = "";

    const elements = pergunta.alternatives.map((alt, i) => {
      const el = createAlternative(alt, pergunta.optionImages?.[i], i);
      el.dataset.id = `option-${i}`;
      el.onclick = () => this.verificarResposta(`${alt}`);
      return el;
    });

    this.setAlternatives(elements, container);
  }

  atualizarScore(endgame = false, points) {
    console.log(endgame, this.settings["hide-score"], points);
    if (this.settings["hide-score"] === "none") return;
    if (!endgame && this.settings["hide-score"] === "during-game") return;
    soundEffects.score.play();
    getById("team-red-score").textContent = this.scores.right;
    getById("team-blue-score").textContent = this.scores.left;

    getById("score-win-img").classList.toggle("hidden", !endgame);
    console.log(getById("score-win-img").classList);
    getById("winner-buttons").classList.toggle("hidden", !endgame);

    this.showModal(this.modals.end);
    if (points && points > 0) this.plus(`+${points}`);
  }
}

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
    };

    this.applyTeamNames();
  }

  applyTeamNames() {
    if (this.settings["team-names"]) {
      this.teamElements.redName.textContent =
        this.settings["team1-name"] || "Equipe 1";
      this.teamElements.blueName.textContent =
        this.settings["team2-name"] || "Equipe 2";
    }
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
    intermissionTimerCurrent.textContent = `${current}`;
    const intermissionTimerTotal = getById("intermission_total_questions");
    intermissionTimerTotal.textContent = `${total}`;
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
    return new Promise((resolve) => setTimeout(resolve, time));
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
      soundEffects.correct.play();
      await FlashModal.show({
        text: "Acertou!",
        type: "success",
      });

      this.updateScore(this.selectedTeam, pontos);
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
      this.atualizarScore(false, pontos);
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

    getById("team-red-score").textContent = this.scores.right;
    getById("team-blue-score").textContent = this.scores.left;

    winnerText.classList.add("text-3xl", "font-bold", "animate-pulse");

    const winnerEmoji = this.scores.left === this.scores.right ? "🌟" : "🏆";
    winnerText.textContent =
      winnerEmoji + " " + winnerText.textContent + " " + winnerEmoji;
    this.atualizarScore(true, 0);
    if (this.scores.left === this.scores.right) {
      winnerText.textContent = "Empate! Todo mundo arrasou!";
    } else {
      const team =
        this.scores.left > this.scores.right
          ? this.teamElements.blueName.textContent
          : this.teamElements.redName.textContent;
      soundEffects.win.play();
      winnerText.textContent = `Parabéns ${team}!`;
    }
    if (this.settings["confetti-toggle"])
      confetti({
        particleCount: 1000,
        startVelocity: 80,
        zIndex: 99999999,
      });
    setTimeout(() => {
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
    }, 3000);
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
      this.setTextoCentro(
        team === "right"
          ? this.settings["team2-name"]
          : this.settings["team1-name"]
      );
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
      this.selectedTeam = team;
      updateTeamSelect(team === "right" ? 2 : 1);
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
      el.querySelector("button").dataset.id = `option-${i}`;
      el.querySelector("button").onclick = () =>
        this.verificarResposta(`${alt}`);
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

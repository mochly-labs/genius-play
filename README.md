# 🎮 Genius Play! 🎮

Um minigame de passa ou repassa com compatibilidade com Arduino.
Atualizado em Abril-Maio de 2025 para novo visual e modo de jogo, com otimização extrema e reescrita do código.

> [!WARNING]
> Versão ALPHA, pode conter bugs e erros extremos.

## 🚀 Como Rodar

### 🔹 Modo Pré-Compilado
1. 📥 Baixe o arquivo de release mais recente.
2. 📂 Extraia o conteúdo do arquivo baixado.
3. ▶️ Abra o arquivo **Passa Ou Repassa (sua plataforma).exe**
4. 🌐 Quando o app abrir, entre em tela cheia e divirta-se!

### 🔹 Modo Código-Fonte
1. 📥 Clone ou baixe o repositório.
2. ▶️ Rode o comando: `go mod tidy`
3. 🔧 Rode o comando: `go build -o executable && ./executable`
4. 🌐 Quando o app abrir, entre em tela cheia e divirta-se!

---

## ⚡ Como Instalar o Código no Arduino (Obrigatório)

1. 📥 **Baixe** o repositório do jogo.
2. 📝 **Baixe o Arduino IDE**.
3. 🔌 **Conecte o Arduino** ao computador.
4. 📂 **Navegue até a pasta `hardware` dentro do repositório**.
5. 📜 **Abra o código `.ino`** na IDE.
6. 🛠️ **Selecione a placa correta e a porta COM**.
7. ▶️ **Carregue o código para o Arduino**.
8. ✅ **Pronto! O Arduino está configurado para o jogo!**

---

## 🔌 Fiação

🔹 **Botão Time 1** → Pino **7**

🔹 **Botão Time 2** → Pino **8**

🔹 **Botão Reset** → Pino **2**

### Luzes (não implementado ainda)
🔹 **Luz Time 1** → Pino **9**

🔹 **Luz Time 2** → Pino **10**

🔹 **Luz "GO"** → Pino **11**

---

## 📋 Como Usar

1. **Criando Questionários** ✍️
   - Clique em **Editor** para abrir o **construtor de questionários**.
   - Defina um **título** e adicione as **perguntas**.
   - Clique no circulo do lado das opções para **selecionar a resposta correta**.
   - 📂 **Importe** um questionário pronto para edição (opcional).
   - 💾 **Exporte** o questionário usando o botão **Exportar**.
   - 🔙 Aperte **Voltar** para retornar ao minigame.

2. **Carregando um Questionário** 📂
   - Clique em **Questionários** para abrir o gerenciador de questionários.
   - Clique em **Selecionar Arquivo** e escolha um arquivo exportado ou um pronto do repositório.
   - 📤 Aperte **Enviar** para carregar o questionário.

---

## 🎮 Como Jogar

1. 🔌 **Conecte seu Arduino** com o software carregado e fios corretamente conectados.
3. 📑 Clique em **Questionários**, procure o questionário e clique em **Play**.
4. ⚙️ *Aguarde o carregamento do jogo*
5. 🚀 Aperte **Iniciar Jogo** e espere começar!
6. ⏳ Quando a mensagem "VALENDO" aparecer, os times podem apertar o botão.
7. 🗣️ O time que apertar primeiro responde, e o controlador aperta a alternativa.
8. 🎮 O jogo valida da seguinte maneira:
   - ✅ Se correta, o jogo avança automaticamente (ou aguarda o controlador apertar **A** ou **Reset**).
   - ❌ Se errada, o jogo repassa a pergunta (ou avança conforme a configuração).
9. 🏆 **O time com mais pontos no final vence!** 🎉

---

🎉 **Agora é só aproveitar e se divertir!** 🎉

🔗 **Made by [caffwydev](https://github.com/caffwydev) && T-Reis (https://github.com/T-Reis90)**

🕒 **2025** - Mochly labs
# 🎮 PASSA OU REPASSA (GOLANG) 🎮

Um minigame desenvolvido para o 8° ano do IEPAM em 2024, em parceria com o professor Thiago de Matemática. 🏫📚

Atualizado em Março de 2025 para abandonar o Node.js e utilizar Golang. Aplicação leve.


---

- **⚡ Projeto feito com tecnologia THUNDERBOLT(Scanner de Serial Personalizado)**

---

## 🚀 Como Rodar

### 🔹 Modo Pré-Compilado
1. 📥 Baixe o arquivo de release mais recente.
2. 📂 Extraia o conteúdo do arquivo baixado.
3. ▶️ Abra o arquivo **Passa Ou Repassa (sua plataforma).exe**
4. 🌐 Abra seu navegador em **https://127.0.0.1:8080**, entre em tela cheia e divirta-se!

### 🔹 Modo Código-Fonte
1. 📥 Clone ou baixe o repositório.
2. ▶️ Rode o comando: `go mod tidy`
2. 🔧 Rode o comando: `go run main.go reader.go serial.go`
3. 🌐 Abra seu navegador em **https://127.0.0.1:8080**, entre em tela cheia e divirta-se!

---

## ⚡ Como Instalar o Código no Arduino (Obrigatório)

1. 📥 **Baixe** o repositório do jogo.
2. 📝 **Baixe o Arduino IDE**.
3. 🔌 **Conecte o Arduino** ao computador.
4. 📂 **Navegue até a pasta `arduino` dentro do repositório**.
5. 📜 **Abra o código `.ino`** na IDE.
6. 🛠️ **Selecione a placa correta e a porta COM**.
7. ▶️ **Carregue o código para o Arduino**.
8. ✅ **Pronto! O Arduino está configurado para o jogo!**

---

## 🔌 Fiação

🔹 **Botão Time 1** → Pino **7**

🔹 **Botão Time 2** → Pino **8**

🔹 **Botão Reset** → Pino **2**

---

## 📋 Como Usar

1. **Criando Questionários** ✍️
   - Aperte **B** para abrir o **construtor de questionários**.
   - Defina um **título** e adicione as **perguntas**.
   - Clique fora das opções para **selecionar a resposta correta**.
   - 📂 **Importe** um questionário pronto para edição (opcional).
   - 💾 **Exporte** o questionário usando o botão **Exportar**.
   - 🔙 Aperte **Voltar** para retornar ao minigame.

2. **Carregando um Questionário** 📂
   - Aperte **U** para abrir o carregador de questionários.
   - Clique em **Selecionar Arquivo** e escolha um arquivo exportado ou um pronto do repositório.
   - 📤 Aperte **Enviar** para carregar o questionário.

---

## 🎮 Como Jogar

1. 🔌 **Conecte seu Arduino** com o software carregado e fios corretamente conectados.
2. 🛠️ **Aperte C** para abrir as configurações do APP.
3. 📑 **Aperte S** para selecionar o questionário e clique em **Continuar**.
4. ⚙️ **Configure o jogo**:
   - **Modo Repassar** 🔄
   - **Auto Avançar** ⏭️
   - **Cores dos Times** 🎨
   - **Nomes dos Times** ✏️
5. 🚀 Aperte **Iniciar Jogo** e espere começar!
6. ⏳ Quando as alternativas aparecerem, os times podem apertar o botão.
7. 🗣️ O time que apertar primeiro responde escolhendo um número de **1 a 4**.
8. 🎮 O controlador do jogo confirma a resposta apertando o número no teclado **duas vezes**.
   - ✅ Se correta, o jogo avança automaticamente (ou aguarda o controlador apertar **A** ou **Reset**).
   - ❌ Se errada, o jogo repassa a pergunta (ou avança conforme a configuração).
9. 🏆 **O time com mais pontos no final vence!** 🎉

---

## 🔗 Repositórios

🔹 **Código-Fonte:** [GitHub - Passa ou Repassa (Jogo)](https://github.com/caffwydev/passa-ou-repassa-src-go)

🔹 **Questionários Prontos:** [GitHub - Questionários Prontos](https://github.com/caffwydev/questionarios-prontos)

---

🎉 **Agora é só aproveitar e se divertir!** 🎉

🔗 **Made by [caffwydev](https://github.com/caffwydev)**
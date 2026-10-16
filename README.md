# Fodinha — Contador

Aplicativo web para contar vidas, palpites e vazas de Fodinha com baralho gaúcho/espanhol. Um único celular controla a partida, sem login ou backend.

## Rodar localmente

Requer Node.js 22.

- Instalar: npm install
- Iniciar: npm run dev
- Executar testes: npm test
- Gerar build: npm run build

## Regras implementadas

- De 2 a 40 participantes, com nomes e distribuidor inicial configuráveis.
- Vidas iniciais: 1 a 99; baralho de 40 ou 80 cartas.
- Mãos sobem de 1 até o máximo de cartas inteiras por jogador ativo e continuam no máximo.
- Quando um jogador sai, a próxima mão volta a 1 carta.
- Palpites na ordem depois do distribuidor; o último jogador (pé) não pode fechar a soma exata, se a regra estiver ativada.
- Penalidade: diferença absoluta entre palpite e vazas obtidas.
- Vaza melada acumula o bolo para o próximo vencedor. Bolo pendente na última vaza é descartado por padrão ou atribuído ao último vencedor, conforme a configuração.
- Empate por eliminação simultânea de todos os sobreviventes: mão extra com uma vida temporária ou empate final, conforme a configuração.
- Registro por vaza ou por totais; correções, desfazer e conferência antes de aplicar penalidades.
- O aplicativo não lê as cartas: a mesa decide qual carta ganhou ou melou.

## Histórico, privacidade e offline

Partida atual, até 60 estados de desfazer, até 30 partidas finalizadas e nomes recentes são salvos em localStorage neste navegador. Não são transmitidos a servidor. Limpar os dados do site apagará essas informações. Não há sincronização entre dispositivos.

PWA instalável com cache offline após a primeira carga online. No celular, use **Adicionar à tela inicial** no menu do navegador.

## Publicação

O projeto está configurado para o endereço https://refdudu.github.io/fodinha/ com base /fodinha/.

Depois de o código entrar na branch principal:
1. Abra Settings → Pages no GitHub.
2. Escolha **GitHub Actions** como fonte.
3. A workflow de deploy gerará o site após push na main.

A branch de desenvolvimento possui uma workflow de CI para testar e compilar a aplicação. Não é necessário publicar a branch para desenvolvê-la.

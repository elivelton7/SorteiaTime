# ⚽ SorteiaTime / Pelada Manager

Aplicação web moderna (mobile-first) para gerenciamento completo de futebol/peladas, confirmação de presença e sorteio equilibrado de times.

## 🚀 Funcionalidades

- **Autenticação & Isolamento**: Login com Supabase Auth (Email e OAuth Social) com dados isolados por organizador.
- **Gerenciamento de Peladas / Horários**:
  - Cadastro de horários com local, horário, notas e configuração de formato (`4v4`, `5v5`, `6v6`, `7v7`, etc.).
  - Cálculo automático da data mais próxima do jogo.
- **Gestão de Jogadores**:
  - Jogadores vinculados diretamente à pelada correspondente.
  - Classificação por nível (0 a 5 estrelas) e posição (Goleiro / Linha).
  - Tabela densa e compacta com busca rápida.
  - **Importação em Lote**: Suporte a upload de arquivos `.txt` e `.csv` com detecção automática de goleiros (ex: `Pengo - Goleiro`) e prévia antes de salvar.
  - **Remoção em Massa**: Opção para limpar e recadastrar jogadores.
- **Controle de Presença**:
  - Confirmação rápida em 1 clique (Confirmado / Não confirmado).
  - Resumo de elenco e estatísticas em tempo real (total, goleiros, média de estrelas).
- **Sorteio Equilibrado de Times**:
  - Algoritmo guloso (greedy balance + snake draft) com embaralhamento em empates de rating.
  - **Validação de Goleiros**: Exige rigorosamente 1 goleiro por time.
  - **Tamanho Exato dos Times**: Cada time formado respeita estritamente o limite configurado (`players_per_team`).
  - **Múltiplos Times Dinâmicos**: Monta Time A, B, C, D... de acordo com o total de confirmados e goleiros disponíveis.
  - **Suplentes**: Jogadores excedentes são alocados automaticamente na lista de reservas/próximos a entrar.
  - **Persistência**: Sorteio salvo no `localStorage` por data e pelada.
  - **Compartilhamento**: Botão para copiar escalação formatada para o WhatsApp.

## 🛠️ Tecnologias

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, Lucide Icons
- **Backend / Database**: Supabase (PostgreSQL, Auth, Row Level Security)

## 📦 Como rodar localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/elivelton7/SorteiaTime.git
   cd SorteiaTime
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Duplique o arquivo `.env.example` como `.env`:
     ```bash
     cp .env.example .env
     ```
   - Preencha com sua URL e Anon Key do Supabase:
     ```env
     VITE_SUPABASE_URL=https://seu-projeto.supabase.co
     VITE_SUPABASE_ANON_KEY=sua-chave-anon
     ```

4. Execute o script do banco de dados:
   - Abra o Supabase SQL Editor e execute o conteúdo de `supabase_schema.sql`.

5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

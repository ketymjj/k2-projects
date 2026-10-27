# K2 Projects

Sistema web de gestão de projetos e tarefas, feito para equipes que precisam organizar projetos, distribuir tarefas, acompanhar prazos e ver o progresso em tempo real. O escopo é enxuto e cobre oito módulos: Dashboard, Projetos, Tarefas, Kanban, Calendário, Usuários, Comentários e Notificações.

| Camada | Tecnologias |
|---|---|
| Backend | .NET 8, ASP.NET Core Web API, EF Core 8 + migrations, PostgreSQL 16, FluentValidation, JWT, SignalR, Serilog, Swagger, xUnit |
| Frontend | Angular 21 (standalone components, Signals, zoneless), RxJS, Reactive Forms, Angular Material 3, Angular CDK Drag and Drop, Chart.js |
| Infra local | Docker Compose (somente o PostgreSQL) |

---

## Como executar

### Pré-requisitos

- .NET SDK 8
- Node.js 20 ou superior (testado com Node 24)
- Docker Desktop, para subir o PostgreSQL

### 1. Banco de dados

Na raiz do repositório:

```bash
docker compose up -d
```

Isso sobe o PostgreSQL 16 na porta **5433**, com o banco `k2projects`, usuário `k2` e senha `k2_local_dev`. Essas credenciais valem apenas para o ambiente local.

### 2. API

```bash
cd BackEnd
dotnet run --project src/K2Projects.Api --launch-profile http
```

- A API fica em **http://localhost:5080** e o Swagger em **http://localhost:5080/swagger**.
- No ambiente `Development`, a API aplica as migrations e popula o banco com os dados de demonstração na primeira execução (configurações `Database:MigrateOnStartup` e `Database:SeedDemoData`).

### 3. Frontend

```bash
cd FrontEnd
npm install
npm start
```

Depois é só abrir **http://localhost:4200**.

---

## Credenciais de demonstração

> ⚠️ **Exclusivas para ambiente local.** São dados fictícios criados pelo seed e não devem ser usados em nenhum outro ambiente.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@k2projects.local` | `Admin@2026` |
| Gerente | `carlos.mendes@k2projects.local` | `Gerente@2026` |
| Gerente | `juliana.prado@k2projects.local` | `Gerente@2026` |
| Colaborador | `bruno.lima@k2projects.local` | `Colab@2026` |
| Colaborador | `fernanda.souza@k2projects.local` | `Colab@2026` |
| Colaborador | `rafael.costa@k2projects.local` | `Colab@2026` |
| Colaborador | `camila.rocha@k2projects.local` | `Colab@2026` |
| Colaborador | `diego.martins@k2projects.local` | `Colab@2026` |
| Colaborador | `larissa.alves@k2projects.local` | `Colab@2026` |

O seed cria 9 usuários, 5 projetos (Sistema de Vendas, Portal do Cliente, Aplicativo Mobile, API de Integração e Dashboard Financeiro), 40 tarefas principais, 10 subtarefas, comentários e notificações. As datas são calculadas a partir do dia da primeira execução, então sempre há tarefas atrasadas, tarefas vencendo hoje ou amanhã e tarefas concluídas.

Para recriar o banco do zero, com um seed novo:

```bash
docker exec k2projects-postgres psql -U k2 -d postgres -c "DROP DATABASE k2projects WITH (FORCE);" -c "CREATE DATABASE k2projects OWNER k2;"
```

Em seguida, reinicie a API.

---

## Testes

```bash
cd BackEnd
dotnet test
```

São **63 testes**, todos passando:

- **UnitTests (52):** testam os serviços reais sobre EF Core InMemory. Cobrem cadastro e atualização de projeto, criação de tarefa, atribuição de responsável, mudança de status, conclusão e reabertura (`CompletedAt`), cálculo de progresso, identificação de atraso considerando o fuso horário, permissões por perfil e por vínculo ao projeto, comentários, notificações (incluindo a deduplicação dos alertas de prazo), movimentação no Kanban, subtarefas circulares ou em outro projeto e exclusão em cascata.
- **IntegrationTests (11):** sobem a API completa com `WebApplicationFactory` e JWT real. Cobrem login, 401/403, gestão de usuários, usuário desativado perdendo o acesso, erros de validação por campo, exclusão de projeto com confirmação, os **códigos de erro estáveis** e os parâmetros das notificações usados na tradução, além do **fluxo principal de demonstração** de ponta a ponta.

O fluxo principal também foi validado em navegador real (Edge, via Playwright): login, criação de projeto, membros, tarefa, arrastar no Kanban, comentário, notificação, conclusão, progresso, dashboard, notificações em tempo real via SignalR, sessão expirada, tema escuro e layout mobile. O multi-idioma também foi validado no navegador: alternância PT ↔ EN sem recarregar, persistência após atualizar a página, todos os módulos, modais, validações, gráficos, calendário e datepicker, notificações (inclusive em tempo real), Kanban funcionando após a troca e ausência de chaves de tradução na tela. Esses scripts E2E não fazem parte do repositório.

---

## Arquitetura

```text
BackEnd/
├── K2Projects.sln
├── src/
│   ├── K2Projects.Domain/          Entidades, enums e regras de domínio (ex.: WorkTask.ChangeStatus, IsOverdue)
│   ├── K2Projects.Application/     Serviços de caso de uso, DTOs, validadores, AccessService (autorização)
│   ├── K2Projects.Infrastructure/  EF Core (DbContext, mapeamentos, migrations, seed), JWT, BCrypt, relógio, worker de prazos
│   └── K2Projects.Api/             Controllers REST, hub SignalR, tratamento global de exceções, Swagger
└── tests/
    ├── K2Projects.UnitTests/
    └── K2Projects.IntegrationTests/

FrontEnd/src/app/
├── core/       auth (serviço + login), guards, interceptors, services (API, SignalR, notificações, preferências)
├── shared/     componentes reutilizáveis (badges, estados, confirmação, gráfico), modelos e utilitários
├── layout/     shell, sidebar e header
└── features/   dashboard, projects, tasks, kanban, calendar, users, comments, notifications, settings
```

Algumas decisões que valem registrar:

- **Sem abstrações desnecessárias.** A camada Application usa um `IAppDbContext` direto, sem repositórios genéricos nem MediatR.
- **Tabelas sem palavras reservadas.** A entidade de tarefa se chama `WorkTask` (tabela `work_tasks`), para não conflitar com `System.Threading.Tasks.Task` nem com palavras reservadas do SQL. Todas as tabelas usam snake_case.
- **Datas de prazo como `date`.** `StartDate` e `DueDate` são `DateOnly`. "Hoje" é calculado no fuso configurado em `App:TimeZone` (padrão `America/Sao_Paulo`). Uma tarefa só fica atrasada quando o vencimento é anterior a hoje nesse fuso e ela ainda não foi concluída.
- **Atualização entre telas.** Toda alteração emite um evento `dataChanged` pelo SignalR, e o frontend também emite eventos locais. Assim, Dashboard, listagens, Kanban e calendário se recarregam quando dados mudam, inclusive quando outro usuário faz a alteração.
- **Erros padronizados.** As respostas de erro seguem `ProblemDetails`, com erros de validação agrupados por campo, que o frontend exibe junto ao campo correspondente.
- **Logs estruturados.** Serilog registra cada requisição e os eventos de negócio (login, criação, movimentação, exclusão).

---

## Multi-idioma (pt-BR / en-US)

A interface funciona em **Português (Brasil)** e **English (United States)**. A troca é imediata, sem recarregar a página, e pode ser feita pelo seletor 🇧🇷 PT / 🇺🇸 EN no cabeçalho, na tela de login ou em Configurações.

- **Biblioteca:** [Transloco](https://jsverse.github.io/transloco/) (`@jsverse/transloco` 8.4), que permite trocar o idioma em tempo de execução.
- **Arquivos de tradução:** `FrontEnd/public/i18n/pt-BR.json` e `en-US.json`, com as mesmas chaves nos dois arquivos.
- **Preferência:** fica salva em `localStorage` na chave `k2projects.language`. Sem preferência salva, o idioma é `pt-BR`.
- **Código do núcleo:** `FrontEnd/src/app/core/i18n/`. Nos templates, usa-se o pipe `transloco`; no TypeScript, a função `t()` de `i18n-state.ts`, que também atualiza gráficos e textos calculados quando o idioma muda.
- **Datas e números:** seguem o idioma ativo (24/10/2026 em pt-BR, 10/24/2026 em en-US). Isso inclui os meses e dias da semana do calendário, o datepicker (que também aceita datas digitadas no formato do idioma), as datas relativas ("há 2 dias" / "2 days ago"), a paginação e o título da aba do navegador.
- **Valores internos não são traduzidos.** Enums como `AFazer` ou `Urgente`, IDs, rotas e propriedades JSON continuam iguais; só os rótulos exibidos mudam.
- **Conteúdo cadastrado não é traduzido.** Nomes de projetos, títulos e descrições de tarefas e comentários aparecem exatamente como foram escritos.

### Mensagens vindas da API

- **Erros:** a API devolve um **código estável** em cada erro (`ProblemDetails.code`, por exemplo `PROJECT_NOT_FOUND` ou `INVALID_CREDENTIALS`), com parâmetros em `args` quando há (por exemplo `{ "count": 3 }`). Nas validações, os códigos vêm por campo em `errorCodes`. O frontend traduz esses códigos pela seção `apiErrors` dos arquivos de tradução. A lista completa de códigos está em `BackEnd/src/K2Projects.Application/Common/ErrorCodes.cs`. O texto em português continua em `title`, como reserva e para os logs.
- **Notificações:** cada notificação traz o tipo e os parâmetros do evento (`args`: tarefa, projeto, autor, data), e o texto é montado no idioma do usuário. Notificações criadas antes dessa mudança não têm parâmetros: nesse caso, o título é traduzido pelo tipo e a mensagem aparece no texto original em português (pt-BR) ou numa mensagem genérica (en-US). A coluna `notifications.args` foi adicionada pela migration `AddNotificationArgs`, sem alterar os dados existentes.

## Permissões

| Ação | Administrador | Gerente | Colaborador |
|---|---|---|---|
| Gerenciar usuários | ✅ | — | — |
| Ver projetos | Todos | Os que gerencia ou participa | Os que participa |
| Criar projeto | ✅ (define o responsável) | ✅ (fica como responsável) | — |
| Editar/excluir projeto, membros | Todos | Somente os seus | — |
| Criar, editar, atribuir e excluir tarefas | Todas | Nos seus projetos | — |
| Alterar status / mover no Kanban | Todas | Nos seus projetos e nas atribuídas a ele | Somente as atribuídas a ele |
| Comentar | Em tarefas visíveis | Em tarefas visíveis | Em tarefas visíveis |
| Editar/excluir comentário | Somente os próprios | Somente os próprios | Somente os próprios |

A autorização é aplicada no backend, no `AccessService`. Projetos e tarefas que o usuário não pode ver retornam 404, e ações não permitidas retornam 403. O frontend usa as flags `canManage`, `canEdit` e `canChangeStatus` vindas da API apenas para esconder botões. Um usuário desativado perde o acesso imediatamente, mesmo que ainda tenha um token válido.

## Regras de negócio implementadas

1. Toda tarefa pertence a um projeto, e o responsável precisa ser membro do projeto (ou o responsável por ele).
2. Subtarefas precisam estar no mesmo projeto da tarefa principal. Ciclos (A → B → A) são bloqueados.
3. O percentual do projeto é calculado automaticamente: tarefas concluídas ÷ total de tarefas.
4. Concluir uma tarefa registra `CompletedAt`, e reabrir limpa esse campo.
5. A exclusão de um projeto com tarefas exige confirmação explícita: na interface, o usuário digita o nome do projeto; na API, é preciso enviar `confirm=true`. Tarefas, subtarefas e comentários são removidos juntos, e as notificações perdem o vínculo com a tarefa.
6. Um membro com tarefas em aberto no projeto não pode ser removido antes de as tarefas serem reatribuídas.
7. Geram notificação: nova atribuição, troca de responsável (o novo e o antigo são avisados), novo comentário (para responsável, criador e quem já comentou), prazo próximo (vence hoje ou amanhã) e atraso.
8. Um worker em segundo plano verifica os prazos a cada 10 minutos (`App:DeadlineCheckIntervalMinutes`). Um índice único `(user_id, dedup_key)` impede notificações duplicadas para o mesmo evento.
9. Os dados são validados no frontend (Reactive Forms) e no backend (FluentValidation e check constraints no banco).

## Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (retorna o JWT) |
| GET | `/api/dashboard` | Indicadores, gráficos e listagens |
| GET/POST/PUT/DELETE | `/api/projects` | CRUD de projetos (`DELETE ?confirm=true`) |
| GET/POST/DELETE | `/api/projects/{id}/members` | Membros do projeto |
| GET | `/api/projects/{id}/board` | Tarefas do Kanban |
| GET/POST/PUT/DELETE | `/api/tasks` | CRUD e filtros de tarefas (paginação, projeto, responsável, status, prioridade, busca, período, atrasadas) |
| GET | `/api/tasks/my` | Minhas tarefas agrupadas |
| PATCH | `/api/tasks/{id}/status` · `/move` | Mudança de status / movimentação no Kanban |
| GET/POST | `/api/tasks/{id}/comments` · PUT/DELETE `/api/comments/{id}` | Comentários |
| GET/PATCH | `/api/notifications` · `/unread-count` · `/{id}/read` · `/read-all` | Notificações |
| GET/POST/PUT/PATCH | `/api/users` | Usuários (somente administrador) |
| GET/PUT/POST | `/api/profile` · `/password` | Perfil do usuário autenticado |
| WS | `/hubs/notifications` | SignalR (eventos `notification` e `dataChanged`) |

A documentação completa está no Swagger.

## Configuração

| Chave | Padrão | Descrição |
|---|---|---|
| `ConnectionStrings:Default` | `localhost:5433` | Conexão com o PostgreSQL |
| `Jwt:Key` | definida só em `appsettings.Development.json` | Chave HMAC com 32 ou mais caracteres. Em outros ambientes, configure por variável de ambiente (`Jwt__Key`). |
| `Jwt:ExpirationMinutes` | 480 | Validade do token |
| `App:TimeZone` | `America/Sao_Paulo` | Fuso usado para definir prazos e atrasos |
| `App:DeadlineCheckIntervalMinutes` | 10 | Intervalo do worker de prazos |
| `Cors:AllowedOrigins` | `http://localhost:4200` | Origens permitidas para o frontend |

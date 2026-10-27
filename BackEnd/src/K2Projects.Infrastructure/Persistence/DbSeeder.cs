using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Infrastructure.Persistence;

/// <summary>
/// Dados fictícios de demonstração — EXCLUSIVOS PARA AMBIENTE LOCAL.
/// As datas são relativas ao dia atual para sempre existirem tarefas atrasadas e com prazo próximo.
/// </summary>
public class DbSeeder(AppDbContext db, IPasswordHasher hasher, IClock clock, ILogger<DbSeeder> logger)
{
    public const string AdminPassword = "Admin@2026";
    public const string ManagerPassword = "Gerente@2026";
    public const string CollaboratorPassword = "Colab@2026";

    private record TaskSeed(string Title, string Description, WorkTaskStatus Status, TaskPriority Priority, int? Assignee, int Start, int Due, int? Parent = null);

    private record ProjectSeed(string Name, string Description, ProjectStatus Status, int Owner, int[] Members, int Start, int Due, TaskSeed[] Tasks);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(ct))
        {
            logger.LogInformation("Seed ignorado: o banco já possui dados.");
            return;
        }

        var today = clock.Today;
        var now = clock.UtcNow;
        DateTime At(int offsetDays, int hour = 12)
        {
            var value = today.AddDays(offsetDays).ToDateTime(new TimeOnly(hour, 0), DateTimeKind.Utc);
            return value > now ? now : value;
        }

        // 0 = admin, 1-2 = gerentes, 3-8 = colaboradores
        var users = new List<User>
        {
            NewUser("Ana Ribeiro", "admin@k2projects.local", UserRole.Administrador, AdminPassword),
            NewUser("Carlos Mendes", "carlos.mendes@k2projects.local", UserRole.Gerente, ManagerPassword),
            NewUser("Juliana Prado", "juliana.prado@k2projects.local", UserRole.Gerente, ManagerPassword),
            NewUser("Bruno Lima", "bruno.lima@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
            NewUser("Fernanda Souza", "fernanda.souza@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
            NewUser("Rafael Costa", "rafael.costa@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
            NewUser("Camila Rocha", "camila.rocha@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
            NewUser("Diego Martins", "diego.martins@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
            NewUser("Larissa Alves", "larissa.alves@k2projects.local", UserRole.Colaborador, CollaboratorPassword),
        };
        for (var i = 0; i < users.Count; i++) users[i].CreatedAt = At(-120 + i);
        db.Users.AddRange(users);

        const WorkTaskStatus T = WorkTaskStatus.AFazer, P = WorkTaskStatus.EmAndamento, C = WorkTaskStatus.Concluido;
        const TaskPriority Low = TaskPriority.Baixa, Med = TaskPriority.Media, High = TaskPriority.Alta, Urg = TaskPriority.Urgente;

        var projects = new[]
        {
            new ProjectSeed("Sistema de Vendas", "Plataforma de vendas com carrinho, pagamentos e relatórios gerenciais.",
                ProjectStatus.EmAndamento, 1, [3, 4, 5], -35, 30,
            [
                new("Modelar banco de dados de pedidos", "Definir entidades de pedido, itens e pagamentos.", C, High, 0, -30, -20),
                new("Criar API de cadastro de clientes", "CRUD de clientes com validação de CPF/CNPJ.", C, High, 2, -25, -15),
                new("Implementar carrinho de compras", "Carrinho persistente com cálculo de totais.", P, Urg, 0, -10, 3),
                new("Integrar gateway de pagamento", "Integração com cartão de crédito e PIX.", P, High, 2, -8, -2),
                new("Tela de listagem de pedidos", "Listagem com filtros por status e período.", T, Med, 1, -2, 7),
                new("Relatório de vendas por período", "Relatório consolidado com exportação.", T, Med, 1, 0, 14),
                new("Ajustar layout responsivo do checkout", "Corrigir quebras de layout em telas pequenas.", T, Low, 1, -5, -1),
                new("Testes automatizados do fluxo de compra", "Cobrir o fluxo completo de compra com testes E2E.", T, High, 2, 1, 10),
                new("Adicionar e remover itens", "Operações básicas do carrinho.", C, Med, 0, -10, -6, 2),
                new("Cálculo de frete", "Consultar transportadoras e calcular frete por CEP.", P, High, 0, -6, 2, 2),
                new("Aplicar cupons de desconto", "Validar cupons e regras de desconto.", T, Med, 2, -1, 5, 2),
                new("Configurar credenciais do sandbox", "Chaves de teste do gateway.", C, Low, 2, -8, -6, 3),
                new("Tratar pagamento recusado", "Mensagens e nova tentativa de pagamento.", T, High, 2, -5, -2, 3),
            ]),
            new ProjectSeed("Portal do Cliente", "Portal de autoatendimento para clientes: boletos, chamados e perfil.",
                ProjectStatus.EmAndamento, 2, [6, 7, 8], -45, 25,
            [
                new("Definir identidade visual do portal", "Paleta, tipografia e componentes base.", C, Med, 0, -40, -32),
                new("Implementar login com recuperação de senha", "Login seguro e fluxo de recuperação por e-mail.", C, Urg, 1, -30, -22),
                new("Área de segunda via de boletos", "Consulta e emissão de segunda via.", P, High, 1, -7, 1),
                new("Central de chamados", "Abertura e acompanhamento de chamados.", P, Med, 2, -6, 5),
                new("Página de perfil do cliente", "Edição de dados cadastrais e preferências.", T, Low, 0, 0, 9),
                new("Notificações por e-mail", "Templates de e-mail para eventos do portal.", T, Med, 2, -10, -4),
                new("Acessibilidade nas páginas principais", "Adequação às diretrizes WCAG 2.1.", T, Med, 0, 2, 20),
                new("Configurar monitoramento de erros", "Captura de erros do front-end.", C, Low, 1, -15, -10),
                new("Gerar PDF do boleto", "Geração do PDF com código de barras.", P, High, 1, -5, 1, 2),
                new("Enviar boleto por e-mail", "Envio automático do boleto ao cliente.", T, Med, 2, -2, 4, 2),
            ]),
            new ProjectSeed("Aplicativo Mobile", "Aplicativo para Android e iOS com acesso aos principais serviços.",
                ProjectStatus.Planejado, 1, [5, 6, 7], -20, 60,
            [
                new("Pesquisa com usuários", "Entrevistas para levantar necessidades.", C, Med, 1, -20, -12),
                new("Protótipo navegável", "Protótipo de alta fidelidade das telas principais.", P, High, 1, -5, 4),
                new("Definir arquitetura do app", "Escolha de framework, estado e navegação.", P, High, 0, -4, 0),
                new("Configurar pipeline de build", "Build e distribuição automatizados.", T, Med, 2, 3, 12),
                new("Tela de onboarding", "Apresentação inicial do aplicativo.", T, Med, 1, 5, 15),
                new("Autenticação biométrica", "Login com digital e reconhecimento facial.", T, High, 0, 7, 25),
                new("Push notifications", "Envio de notificações para o dispositivo.", T, Low, 2, 10, 30),
                new("Planejar publicação nas lojas", "Checklist de publicação na App Store e Google Play.", T, Low, null, 20, 45),
                new("Fluxo de cadastro", "Telas do fluxo de cadastro no protótipo.", C, Med, 1, -5, -2, 1),
            ]),
            new ProjectSeed("API de Integração", "API para integração com parceiros, ERP e marketplaces.",
                ProjectStatus.EmAndamento, 2, [3, 8, 4], -40, 20,
            [
                new("Documentar contratos no Swagger", "Documentação completa dos endpoints.", C, Med, 1, -35, -28),
                new("Autenticação OAuth para parceiros", "Fluxo client credentials para parceiros.", C, Urg, 0, -28, -18),
                new("Endpoint de sincronização de estoque", "Sincronização de estoque com o ERP.", P, Urg, 0, -12, -3),
                new("Webhooks de status de pedido", "Notificar parceiros sobre mudanças de status.", P, High, 2, -6, 2),
                new("Rate limiting por cliente", "Limitar requisições por parceiro.", T, Med, 1, -1, 6),
                new("Logs estruturados e correlação", "Rastreabilidade de requisições ponta a ponta.", T, Med, 2, 0, 8),
                new("Testes de carga", "Validar a API sob carga de pico.", T, High, 1, -9, -6),
                new("Versionamento da API (v2)", "Estratégia de versionamento e depreciação.", T, Low, null, 5, 30),
                new("Mapear campos do ERP", "De-para dos campos de estoque.", C, Med, 0, -12, -8, 2),
                new("Job de sincronização incremental", "Sincronizar apenas registros alterados.", P, High, 0, -7, 1, 2),
            ]),
            new ProjectSeed("Dashboard Financeiro", "Painel gerencial com indicadores financeiros e DRE.",
                ProjectStatus.Concluido, 1, [4, 7], -95, -28,
            [
                new("Levantamento de indicadores", "Definição dos KPIs com a área financeira.", C, High, 0, -90, -80),
                new("Modelagem do data mart", "Modelo dimensional para os indicadores.", C, High, 1, -80, -65),
                new("Gráfico de fluxo de caixa", "Visualização do fluxo de caixa mensal.", C, Med, 0, -65, -55),
                new("DRE gerencial", "Demonstrativo de resultados por período.", C, High, 1, -60, -50),
                new("Filtros por centro de custo", "Filtros dinâmicos no painel.", C, Med, 0, -50, -45),
                new("Exportação para Excel", "Exportar relatórios do painel.", C, Low, 1, -45, -40),
                new("Homologação com a diretoria", "Validação final com os usuários-chave.", C, Urg, 0, -40, -35),
                new("Treinamento dos usuários", "Treinamento das equipes financeiras.", C, Med, 1, -35, -30),
            ]),
        };

        var allTasks = new List<WorkTask>();
        var comments = new List<TaskComment>();
        var notifications = new List<Notification>();
        var commentTexts = new[]
        {
            "Comecei a análise, devo atualizar até o fim do dia.",
            "Encontrei um ponto de atenção na regra de negócio, vamos alinhar na daily?",
            "Atualizei a branch com as últimas alterações.",
            "Revisado. Pode seguir para homologação.",
            "Preciso de acesso ao ambiente de testes para continuar.",
            "Ajustes aplicados conforme o feedback."
        };

        foreach (var ps in projects)
        {
            var owner = users[ps.Owner];
            var project = new Project
            {
                Name = ps.Name,
                Description = ps.Description,
                Status = ps.Status,
                OwnerId = owner.Id,
                StartDate = today.AddDays(ps.Start),
                DueDate = today.AddDays(ps.Due),
                CreatedAt = At(ps.Start - 2),
                UpdatedAt = At(-1)
            };
            foreach (var m in ps.Members)
                project.Members.Add(new ProjectMember { UserId = users[m].Id, AddedAt = At(ps.Start - 1) });
            db.Projects.Add(project);

            var projectTasks = new List<WorkTask>();
            var sortByStatus = new Dictionary<WorkTaskStatus, int>();
            foreach (var ts in ps.Tasks)
            {
                var assignee = ts.Assignee.HasValue ? users[ps.Members[ts.Assignee.Value]] : null;
                var sort = sortByStatus.GetValueOrDefault(ts.Status);
                sortByStatus[ts.Status] = sort + 1;

                var task = new WorkTask
                {
                    ProjectId = project.Id,
                    Title = ts.Title,
                    Description = ts.Description,
                    Priority = ts.Priority,
                    AssignedToId = assignee?.Id,
                    StartDate = today.AddDays(ts.Start),
                    DueDate = today.AddDays(ts.Due),
                    CreatedById = owner.Id,
                    ParentTaskId = ts.Parent.HasValue ? projectTasks[ts.Parent.Value].Id : null,
                    SortOrder = sort,
                    CreatedAt = At(Math.Min(ts.Start, 0) - 1, 9)
                };
                task.ChangeStatus(ts.Status, At(Math.Min(ts.Due, 0), 17));
                if (ts.Status != WorkTaskStatus.AFazer) task.UpdatedAt = At(Math.Min(ts.Due, 0), 17);
                projectTasks.Add(task);

                if (assignee is not null)
                {
                    notifications.Add(new Notification
                    {
                        UserId = assignee.Id,
                        Type = NotificationType.TaskAssigned,
                        Title = "Nova tarefa atribuída",
                        Message = $"Você foi definido como responsável pela tarefa \"{task.Title}\" no projeto {project.Name}.",
                        RelatedTaskId = task.Id,
                        Args = NotificationArgs.Serialize(new Dictionary<string, string> { ["task"] = task.Title, ["project"] = project.Name }),
                        IsRead = ts.Status == WorkTaskStatus.Concluido || ts.Start < -7,
                        CreatedAt = task.CreatedAt
                    });
                }
            }
            allTasks.AddRange(projectTasks);

            // Comentários nas tarefas em andamento e em algumas concluídas
            var commented = projectTasks.Where(t => t.Status == WorkTaskStatus.EmAndamento).Concat(projectTasks.Where(t => t.Status == WorkTaskStatus.Concluido).Take(1));
            var c = 0;
            foreach (var task in commented)
            {
                var participants = new List<Guid> { owner.Id };
                if (task.AssignedToId.HasValue) participants.Insert(0, task.AssignedToId.Value);
                for (var i = 0; i < 2; i++)
                {
                    var authorId = participants[i % participants.Count];
                    comments.Add(new TaskComment
                    {
                        TaskId = task.Id,
                        UserId = authorId,
                        Content = commentTexts[(c + i) % commentTexts.Length],
                        CreatedAt = At(-2 + i, 10 + i * 3)
                    });
                }
                if (task.AssignedToId.HasValue && task.AssignedToId != owner.Id)
                {
                    notifications.Add(new Notification
                    {
                        UserId = task.AssignedToId.Value,
                        Type = NotificationType.NewComment,
                        Title = "Novo comentário",
                        Message = $"{owner.Name} comentou na tarefa \"{task.Title}\".",
                        RelatedTaskId = task.Id,
                        Args = NotificationArgs.Serialize(new Dictionary<string, string> { ["task"] = task.Title, ["author"] = owner.Name }),
                        IsRead = false,
                        CreatedAt = At(-1, 13)
                    });
                }
                c++;
            }
        }

        db.Tasks.AddRange(allTasks);
        db.TaskComments.AddRange(comments);
        db.Notifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seed concluído: {Users} usuários, {Projects} projetos, {Tasks} tarefas, {Comments} comentários, {Notifications} notificações",
            users.Count, projects.Length, allTasks.Count, comments.Count, notifications.Count);

        User NewUser(string name, string email, UserRole role, string password) =>
            new() { Name = name, Email = email, Role = role, Active = true, PasswordHash = hasher.Hash(password) };
    }
}

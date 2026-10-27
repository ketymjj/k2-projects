using System.Net;
using System.Net.Http.Json;
using K2Projects.Domain.Enums;

namespace K2Projects.IntegrationTests;

public class ApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ApiTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Login_invalido_retorna_401()
    {
        var user = await _factory.CreateUserAsync("Login Teste", UserRole.Colaborador);
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = "errada123" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        // código estável para o frontend traduzir
        Assert.Equal("INVALID_CREDENTIALS", (await response.JsonAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Endpoint_protegido_sem_token_retorna_401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/projects");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_retorna_token_e_me_retorna_usuario()
    {
        var user = await _factory.CreateUserAsync("Me Teste", UserRole.Gerente);
        var client = await _factory.ClientForAsync(user);

        var me = await (await client.GetAsync("/api/auth/me")).JsonAsync();

        Assert.Equal(user.Email, me.GetProperty("email").GetString());
        Assert.Equal("Gerente", me.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Somente_administrador_gerencia_usuarios()
    {
        var collaborator = await _factory.CreateUserAsync("Colab Perm", UserRole.Colaborador);
        var admin = await _factory.CreateUserAsync("Admin Perm", UserRole.Administrador);
        var collabClient = await _factory.ClientForAsync(collaborator);
        var adminClient = await _factory.ClientForAsync(admin);
        var newUser = new { name = "Novo Usuário", email = $"novo.{Guid.NewGuid():N}@it.local", password = "Senha1234", role = "Colaborador" };

        Assert.Equal(HttpStatusCode.Forbidden, (await collabClient.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await collabClient.PostJsonAsync("/api/users", newUser)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await adminClient.PostJsonAsync("/api/users", newUser)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await adminClient.PostJsonAsync("/api/users", newUser)).StatusCode);
    }

    [Fact]
    public async Task Usuario_desativado_perde_acesso()
    {
        var admin = await _factory.CreateUserAsync("Admin Desativa", UserRole.Administrador);
        var collaborator = await _factory.CreateUserAsync("Colab Desativado", UserRole.Colaborador);
        var adminClient = await _factory.ClientForAsync(admin);
        var collabClient = await _factory.ClientForAsync(collaborator);

        var deactivate = await adminClient.PatchJsonAsync($"/api/users/{collaborator.Id}/active", new { active = false });
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await collabClient.GetAsync("/api/projects")).StatusCode);
    }

    [Fact]
    public async Task Validacao_retorna_400_com_erros_por_campo()
    {
        var manager = await _factory.CreateUserAsync("Gerente Valida", UserRole.Gerente);
        var client = await _factory.ClientForAsync(manager);

        var response = await client.PostJsonAsync("/api/projects", new { name = "", status = "Planejado", startDate = "2026-12-10", dueDate = "2026-12-01" });
        var body = await response.JsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(body.GetProperty("errors").TryGetProperty("name", out _));
        Assert.True(body.GetProperty("errors").TryGetProperty("dueDate", out _));
        Assert.Equal("VALIDATION_FAILED", body.GetProperty("code").GetString());
        var codes = body.GetProperty("errorCodes");
        Assert.Contains(codes.GetProperty("name").EnumerateArray(), c => c.GetString() == "PROJECT_NAME_REQUIRED");
        Assert.Contains(codes.GetProperty("dueDate").EnumerateArray(), c => c.GetString() == "PROJECT_DATES_ORDER");
    }

    [Fact]
    public async Task Erros_de_permissao_e_nao_encontrado_retornam_codigos_estaveis()
    {
        var collaborator = await _factory.CreateUserAsync("Colab Codigos", UserRole.Colaborador);
        var client = await _factory.ClientForAsync(collaborator);

        var forbidden = await client.GetAsync("/api/users");
        var notFound = await client.GetAsync($"/api/tasks/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
        Assert.Equal("TASK_NOT_FOUND", (await notFound.JsonAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Notificacao_traz_parametros_para_traducao_no_frontend()
    {
        var manager = await _factory.CreateUserAsync("Gerente Args", UserRole.Gerente);
        var collaborator = await _factory.CreateUserAsync("Colab Args", UserRole.Colaborador);
        var managerClient = await _factory.ClientForAsync(manager);
        var collabClient = await _factory.ClientForAsync(collaborator);
        var projectId = (await (await managerClient.PostJsonAsync("/api/projects", new { name = "Projeto Args", status = "EmAndamento", memberIds = new[] { collaborator.Id } })).JsonAsync()).GetProperty("id").GetGuid();
        await managerClient.PostJsonAsync("/api/tasks", new { projectId, title = "Tarefa Args", status = "AFazer", priority = "Alta", assignedToId = collaborator.Id });

        var notification = (await (await collabClient.GetAsync("/api/notifications")).JsonAsync()).GetProperty("items")[0];

        Assert.Equal("TaskAssigned", notification.GetProperty("type").GetString());
        Assert.Equal("Tarefa Args", notification.GetProperty("args").GetProperty("task").GetString());
        Assert.Equal("Projeto Args", notification.GetProperty("args").GetProperty("project").GetString());
    }

    [Fact]
    public async Task Fluxo_principal_de_demonstracao()
    {
        var manager = await _factory.CreateUserAsync("Gerente Fluxo", UserRole.Gerente);
        var collaborator = await _factory.CreateUserAsync("Colab Fluxo", UserRole.Colaborador);
        var managerClient = await _factory.ClientForAsync(manager);
        var collabClient = await _factory.ClientForAsync(collaborator);

        // Criar projeto
        var projectResponse = await managerClient.PostJsonAsync("/api/projects", new
        {
            name = "Projeto Fluxo", description = "Demo", status = "EmAndamento",
            startDate = "2026-10-01", dueDate = "2026-12-31"
        });
        Assert.Equal(HttpStatusCode.Created, projectResponse.StatusCode);
        var projectId = (await projectResponse.JsonAsync()).GetProperty("id").GetGuid();

        // Adicionar membro
        var members = await managerClient.PostJsonAsync($"/api/projects/{projectId}/members", new { userId = collaborator.Id });
        Assert.Equal(HttpStatusCode.OK, members.StatusCode);

        // Criar tarefa e atribuir responsável
        var taskResponse = await managerClient.PostJsonAsync("/api/tasks", new
        {
            projectId, title = "Criar API", status = "AFazer", priority = "Alta",
            assignedToId = collaborator.Id, dueDate = "2026-12-01"
        });
        Assert.Equal(HttpStatusCode.Created, taskResponse.StatusCode);
        var taskId = (await taskResponse.JsonAsync()).GetProperty("id").GetGuid();
        await managerClient.PostJsonAsync("/api/tasks", new { projectId, title = "Outra", status = "AFazer", priority = "Baixa" });

        // Colaborador recebe notificação de atribuição
        var unread = await (await collabClient.GetAsync("/api/notifications/unread-count")).JsonAsync();
        Assert.Equal(1, unread.GetProperty("count").GetInt32());

        // Kanban: mover para Em Andamento
        var board = await (await collabClient.GetAsync($"/api/projects/{projectId}/board")).JsonAsync();
        Assert.Equal(2, board.GetArrayLength());
        var moved = await collabClient.PatchJsonAsync($"/api/tasks/{taskId}/move", new { status = "EmAndamento", position = 0 });
        Assert.Equal("EmAndamento", (await moved.JsonAsync()).GetProperty("status").GetString());

        // Comentário gera notificação para o gerente (criador da tarefa)
        var comment = await collabClient.PostJsonAsync($"/api/tasks/{taskId}/comments", new { content = "Iniciando o desenvolvimento" });
        Assert.Equal(HttpStatusCode.OK, comment.StatusCode);
        var managerNotifications = await (await managerClient.GetAsync("/api/notifications")).JsonAsync();
        Assert.Contains(managerNotifications.GetProperty("items").EnumerateArray(), n => n.GetProperty("type").GetString() == "NewComment");

        // Concluir tarefa
        var done = await collabClient.PatchJsonAsync($"/api/tasks/{taskId}/status", new { status = "Concluido" });
        Assert.NotEqual(System.Text.Json.JsonValueKind.Null, (await done.JsonAsync()).GetProperty("completedAt").ValueKind);

        // Progresso do projeto atualizado
        var detail = await (await managerClient.GetAsync($"/api/projects/{projectId}")).JsonAsync();
        Assert.Equal(50, detail.GetProperty("project").GetProperty("progress").GetInt32());

        // Dashboard atualizado
        var dashboard = await (await managerClient.GetAsync("/api/dashboard")).JsonAsync();
        Assert.Equal(1, dashboard.GetProperty("totalProjects").GetInt32());
        Assert.Equal(2, dashboard.GetProperty("totalTasks").GetInt32());
        Assert.Equal(1, dashboard.GetProperty("completedTasks").GetInt32());
        Assert.Equal(1, dashboard.GetProperty("pendingTasks").GetInt32());
    }

    [Fact]
    public async Task Colaborador_nao_move_tarefa_de_outro_pelo_kanban()
    {
        var manager = await _factory.CreateUserAsync("Gerente Kanban", UserRole.Gerente);
        var collaborator = await _factory.CreateUserAsync("Colab Kanban", UserRole.Colaborador);
        var managerClient = await _factory.ClientForAsync(manager);
        var collabClient = await _factory.ClientForAsync(collaborator);

        var projectId = (await (await managerClient.PostJsonAsync("/api/projects", new { name = "Projeto Kanban", status = "EmAndamento", memberIds = new[] { collaborator.Id } })).JsonAsync()).GetProperty("id").GetGuid();
        var taskId = (await (await managerClient.PostJsonAsync("/api/tasks", new { projectId, title = "Sem responsável", status = "AFazer", priority = "Media" })).JsonAsync()).GetProperty("id").GetGuid();

        var response = await collabClient.PatchJsonAsync($"/api/tasks/{taskId}/move", new { status = "Concluido", position = 0 });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Excluir_projeto_com_tarefas_exige_confirmacao()
    {
        var manager = await _factory.CreateUserAsync("Gerente Exclui", UserRole.Gerente);
        var client = await _factory.ClientForAsync(manager);
        var projectId = (await (await client.PostJsonAsync("/api/projects", new { name = "Projeto Exclusão", status = "Planejado" })).JsonAsync()).GetProperty("id").GetGuid();
        await client.PostJsonAsync("/api/tasks", new { projectId, title = "Tarefa", status = "AFazer", priority = "Media" });

        var withoutConfirm = await client.DeleteAsync($"/api/projects/{projectId}");
        Assert.Equal(HttpStatusCode.Conflict, withoutConfirm.StatusCode);
        var conflict = await withoutConfirm.JsonAsync();
        Assert.Equal("PROJECT_HAS_TASKS", conflict.GetProperty("code").GetString());
        Assert.Equal(1, conflict.GetProperty("args").GetProperty("count").GetInt32());

        var confirmed = await client.DeleteAsync($"/api/projects/{projectId}?confirm=true");
        Assert.Equal(HttpStatusCode.NoContent, confirmed.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{projectId}")).StatusCode);
    }
}

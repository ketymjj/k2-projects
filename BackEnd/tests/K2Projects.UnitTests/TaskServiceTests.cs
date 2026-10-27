using K2Projects.Application.Common;
using K2Projects.Application.Tasks;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.UnitTests;

public class TaskServiceTests
{
    private static CreateTaskRequest NewTask(Guid projectId, Guid? assignee = null, Guid? parent = null, WorkTaskStatus status = WorkTaskStatus.AFazer) =>
        new(projectId, "Criar API", "Descrição", status, TaskPriority.Alta, assignee, new DateOnly(2026, 10, 20), new DateOnly(2026, 10, 30), parent);

    private static UpdateTaskRequest Update(CreateTaskRequest r, Guid? assignee = null, Guid? parent = null, WorkTaskStatus? status = null) =>
        new(r.Title, r.Description, status ?? r.Status, r.Priority, assignee, r.StartDate, r.DueDate, parent);

    [Fact]
    public async Task Cria_tarefa_no_projeto()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.LoginAs(f.Manager);

        var task = await f.Tasks.CreateAsync(NewTask(project.Id), default);

        Assert.Equal(project.Id, task.ProjectId);
        Assert.Equal(WorkTaskStatus.AFazer, task.Status);
        Assert.True(task.CanEdit);
        Assert.Contains("task", f.Realtime.Changes);
    }

    [Fact]
    public async Task Tarefa_deve_pertencer_a_um_projeto()
    {
        var f = new TestFixture();
        await ValidationAssert.FailsAsync(() => f.Tasks.CreateAsync(NewTask(Guid.Empty), default), "ProjectId");
    }

    [Fact]
    public async Task Prazo_anterior_ao_inicio_e_invalido()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var request = NewTask(project.Id) with { StartDate = new DateOnly(2026, 11, 10), DueDate = new DateOnly(2026, 11, 1) };

        await ValidationAssert.FailsAsync(() => f.Tasks.CreateAsync(request, default), "DueDate");
    }

    [Fact]
    public async Task Atribuir_responsavel_gera_notificacao()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.LoginAs(f.Manager);

        var task = await f.Tasks.CreateAsync(NewTask(project.Id, f.Collaborator.Id), default);

        Assert.Equal(f.Collaborator.Id, task.AssignedToId);
        var notification = Assert.Single(f.Realtime.Sent);
        Assert.Equal(NotificationType.TaskAssigned, notification.Type);
        Assert.Equal(f.Collaborator.Id, notification.UserId);
        Assert.True(await f.Db.Notifications.AnyAsync(n => n.UserId == f.Collaborator.Id && n.RelatedTaskId == task.Id));
    }

    [Fact]
    public async Task Responsavel_precisa_ser_membro_do_projeto()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.Collaborator);

        await ValidationAssert.FailsAsync(() => f.Tasks.CreateAsync(NewTask(project.Id, f.OtherCollaborator.Id), default), "AssignedToId");
    }

    [Fact]
    public async Task Alterar_responsavel_notifica_novo_e_antigo_responsavel()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.Collaborator, f.OtherCollaborator);
        f.LoginAs(f.Manager);
        var request = NewTask(project.Id, f.Collaborator.Id);
        var task = await f.Tasks.CreateAsync(request, default);
        f.Realtime.Sent.Clear();

        await f.Tasks.UpdateAsync(task.Id, Update(request, f.OtherCollaborator.Id), default);

        Assert.Equal(2, f.Realtime.Sent.Count);
        Assert.All(f.Realtime.Sent, n => Assert.Equal(NotificationType.AssigneeChanged, n.Type));
        Assert.Contains(f.Realtime.Sent, n => n.UserId == f.OtherCollaborator.Id);
        Assert.Contains(f.Realtime.Sent, n => n.UserId == f.Collaborator.Id);
    }

    [Fact]
    public async Task Mudanca_de_status_e_conclusao_registram_data()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var seeded = f.SeedTask(project, assignee: f.Collaborator);
        f.LoginAs(f.Collaborator);

        var inProgress = await f.Tasks.ChangeStatusAsync(seeded.Id, WorkTaskStatus.EmAndamento, default);
        Assert.Equal(WorkTaskStatus.EmAndamento, inProgress.Status);
        Assert.Null(inProgress.CompletedAt);

        var done = await f.Tasks.ChangeStatusAsync(seeded.Id, WorkTaskStatus.Concluido, default);
        Assert.Equal(WorkTaskStatus.Concluido, done.Status);
        Assert.Equal(f.Clock.UtcNow, done.CompletedAt);

        var reopened = await f.Tasks.ChangeStatusAsync(seeded.Id, WorkTaskStatus.AFazer, default);
        Assert.Null(reopened.CompletedAt);
    }

    [Fact]
    public async Task Colaborador_so_altera_status_das_proprias_tarefas()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.Collaborator, f.OtherCollaborator);
        var other = f.SeedTask(project, assignee: f.OtherCollaborator);
        f.LoginAs(f.Collaborator);

        await Assert.ThrowsAsync<ForbiddenException>(() => f.Tasks.ChangeStatusAsync(other.Id, WorkTaskStatus.Concluido, default));
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Tasks.MoveAsync(other.Id, new MoveTaskRequest(WorkTaskStatus.Concluido, 0), default));
    }

    [Fact]
    public async Task Colaborador_nao_cria_nem_edita_tarefas()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var own = f.SeedTask(project, assignee: f.Collaborator);
        f.LoginAs(f.Collaborator);

        await Assert.ThrowsAsync<ForbiddenException>(() => f.Tasks.CreateAsync(NewTask(project.Id), default));
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Tasks.UpdateAsync(own.Id, Update(NewTask(project.Id)), default));
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Tasks.DeleteAsync(own.Id, default));
    }

    [Fact]
    public async Task Usuario_fora_do_projeto_nao_visualiza_tarefa()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.Collaborator);
        var task = f.SeedTask(project);
        f.LoginAs(f.OtherCollaborator);

        await Assert.ThrowsAsync<NotFoundException>(() => f.Tasks.GetAsync(task.Id, default));
    }

    [Fact]
    public async Task Kanban_move_altera_status_e_reordena_coluna()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var a = f.SeedTask(project, "A", WorkTaskStatus.EmAndamento, sortOrder: 0);
        var b = f.SeedTask(project, "B", WorkTaskStatus.EmAndamento, sortOrder: 1);
        var moving = f.SeedTask(project, "C", WorkTaskStatus.AFazer, f.Collaborator);
        f.LoginAs(f.Collaborator);

        var moved = await f.Tasks.MoveAsync(moving.Id, new MoveTaskRequest(WorkTaskStatus.EmAndamento, 1), default);

        Assert.Equal(WorkTaskStatus.EmAndamento, moved.Status);
        var column = await f.Db.Tasks.Where(t => t.Status == WorkTaskStatus.EmAndamento).OrderBy(t => t.SortOrder).Select(t => t.Title).ToListAsync();
        Assert.Equal(["A", "C", "B"], column);
        Assert.Contains("task", f.Realtime.Changes);
    }

    [Fact]
    public async Task Kanban_mover_para_concluido_registra_conclusao_e_atualiza_progresso()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var task = f.SeedTask(project, assignee: f.Collaborator);
        f.SeedTask(project, "Outra");
        f.LoginAs(f.Collaborator);

        var moved = await f.Tasks.MoveAsync(task.Id, new MoveTaskRequest(WorkTaskStatus.Concluido, 0), default);
        Assert.NotNull(moved.CompletedAt);

        var detail = await f.Projects.GetAsync(project.Id, default);
        Assert.Equal(50, detail.Project.Progress);
    }

    [Fact]
    public async Task Subtarefa_deve_estar_no_mesmo_projeto_da_tarefa_principal()
    {
        var f = new TestFixture();
        var p1 = f.SeedProject();
        var p2 = f.SeedProject();
        var parentInOtherProject = f.SeedTask(p2, "Pai");

        await ValidationAssert.FailsAsync(() => f.Tasks.CreateAsync(NewTask(p1.Id, parent: parentInOtherProject.Id), default), "ParentTaskId");
    }

    [Fact]
    public async Task Nao_permite_subtarefas_circulares()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var a = f.SeedTask(project, "A");
        var b = f.SeedTask(project, "B", parentId: a.Id);
        var c = f.SeedTask(project, "C", parentId: b.Id);

        // A → B → C; tornar A subtarefa de C criaria um ciclo
        await ValidationAssert.FailsAsync(() => f.Tasks.UpdateAsync(a.Id, Update(NewTask(project.Id), parent: c.Id), default), "ParentTaskId");
        await ValidationAssert.FailsAsync(() => f.Tasks.UpdateAsync(a.Id, Update(NewTask(project.Id), parent: a.Id), default), "ParentTaskId");
    }

    [Fact]
    public async Task Excluir_tarefa_remove_subtarefas_e_comentarios()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var parent = f.SeedTask(project, "Pai");
        var child = f.SeedTask(project, "Filha", parentId: parent.Id);
        f.SeedTask(project, "Neta", parentId: child.Id);
        f.Db.TaskComments.Add(new() { TaskId = child.Id, UserId = f.Admin.Id, Content = "oi" });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();

        await f.Tasks.DeleteAsync(parent.Id, default);

        Assert.False(await f.Db.Tasks.AnyAsync());
        Assert.False(await f.Db.TaskComments.AnyAsync());
    }

    [Fact]
    public async Task Filtros_e_atraso_na_listagem()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.SeedTask(project, "Atrasada", assignee: f.Collaborator, due: f.Clock.Today.AddDays(-1));
        f.SeedTask(project, "Vence hoje", due: f.Clock.Today);
        f.SeedTask(project, "Concluida antiga", WorkTaskStatus.Concluido, due: f.Clock.Today.AddDays(-5));

        var overdue = await f.Tasks.ListAsync(new TaskQuery { Overdue = true }, default);
        Assert.Equal("Atrasada", Assert.Single(overdue.Items).Title);
        Assert.True(overdue.Items[0].IsOverdue);

        var byAssignee = await f.Tasks.ListAsync(new TaskQuery { AssignedToId = f.Collaborator.Id }, default);
        Assert.Single(byAssignee.Items);

        var search = await f.Tasks.ListAsync(new TaskQuery { Search = "hoje" }, default);
        Assert.False(Assert.Single(search.Items).IsOverdue);
    }

    [Fact]
    public async Task Minhas_tarefas_agrupa_por_status_e_atraso()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.SeedTask(project, "Todo", assignee: f.Collaborator, due: f.Clock.Today.AddDays(2));
        f.SeedTask(project, "Doing", WorkTaskStatus.EmAndamento, f.Collaborator);
        f.SeedTask(project, "Done", WorkTaskStatus.Concluido, f.Collaborator);
        f.SeedTask(project, "Late", WorkTaskStatus.EmAndamento, f.Collaborator, f.Clock.Today.AddDays(-3));
        f.SeedTask(project, "De outro", assignee: null);
        f.LoginAs(f.Collaborator);

        var my = await f.Tasks.MyTasksAsync(default);

        Assert.Equal("Todo", Assert.Single(my.Todo).Title);
        Assert.Equal("Doing", Assert.Single(my.InProgress).Title);
        Assert.Equal("Done", Assert.Single(my.Done).Title);
        Assert.Equal("Late", Assert.Single(my.Overdue).Title);
    }
}

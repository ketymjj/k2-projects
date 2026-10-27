using K2Projects.Application.Comments;
using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.UnitTests;

public class CommentAndNotificationTests
{
    [Fact]
    public async Task Comentario_mantem_autor_e_tarefa_e_notifica_quem_acompanha()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var task = f.SeedTask(project, assignee: f.Collaborator); // criada pelo gerente (owner)
        f.LoginAs(f.Collaborator);

        var comment = await f.Comments.AddAsync(task.Id, new CommentRequest("Comecei a tarefa"), default);

        Assert.Equal(f.Collaborator.Id, comment.UserId);
        Assert.Equal(task.Id, comment.TaskId);
        Assert.True(comment.IsMine);
        var notification = Assert.Single(f.Realtime.Sent);
        Assert.Equal(NotificationType.NewComment, notification.Type);
        Assert.Equal(f.Manager.Id, notification.UserId); // criador acompanha; autor não é notificado
    }

    [Fact]
    public async Task Comentarios_em_ordem_cronologica()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var task = f.SeedTask(project, assignee: f.Collaborator);
        f.LoginAs(f.Collaborator);
        await f.Comments.AddAsync(task.Id, new CommentRequest("Primeiro"), default);
        f.Clock.UtcNow = f.Clock.UtcNow.AddMinutes(5);
        await f.Comments.AddAsync(task.Id, new CommentRequest("Segundo"), default);

        var list = await f.Comments.ListAsync(task.Id, default);

        Assert.Equal(["Primeiro", "Segundo"], list.Select(c => c.Content));
    }

    [Fact]
    public async Task Somente_o_autor_edita_ou_exclui_o_comentario()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var task = f.SeedTask(project, assignee: f.Collaborator);
        f.LoginAs(f.Collaborator);
        var comment = await f.Comments.AddAsync(task.Id, new CommentRequest("Original"), default);

        f.LoginAs(f.Manager);
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Comments.UpdateAsync(comment.Id, new CommentRequest("Hack"), default));
        await Assert.ThrowsAsync<ForbiddenException>(() => f.Comments.DeleteAsync(comment.Id, default));

        f.LoginAs(f.Collaborator);
        var edited = await f.Comments.UpdateAsync(comment.Id, new CommentRequest("Editado"), default);
        Assert.Equal("Editado", edited.Content);
        await f.Comments.DeleteAsync(comment.Id, default);
        Assert.False(await f.Db.TaskComments.AnyAsync());
    }

    [Fact]
    public async Task Usuario_sem_acesso_a_tarefa_nao_ve_comentarios()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.Collaborator);
        var task = f.SeedTask(project);
        f.LoginAs(f.OtherCollaborator);

        await Assert.ThrowsAsync<NotFoundException>(() => f.Comments.ListAsync(task.Id, default));
        await Assert.ThrowsAsync<NotFoundException>(() => f.Comments.AddAsync(task.Id, new CommentRequest("x"), default));
    }

    [Fact]
    public async Task Comentario_vazio_e_invalido()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var task = f.SeedTask(project);

        await ValidationAssert.FailsAsync(() => f.Comments.AddAsync(task.Id, new CommentRequest(" "), default), "Content");
    }

    [Fact]
    public async Task Verificacao_de_prazos_gera_notificacoes_sem_duplicar()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.SeedTask(project, "Atrasada", assignee: f.Collaborator, due: f.Clock.Today.AddDays(-2));
        f.SeedTask(project, "Vence amanhã", assignee: f.Collaborator, due: f.Clock.Today.AddDays(1));
        f.SeedTask(project, "Vence semana que vem", assignee: f.Collaborator, due: f.Clock.Today.AddDays(7));
        f.SeedTask(project, "Concluída atrasada", WorkTaskStatus.Concluido, f.Collaborator, f.Clock.Today.AddDays(-2));
        f.SeedTask(project, "Sem responsável", due: f.Clock.Today.AddDays(-2));

        var first = await f.Notifications.CheckDeadlinesAsync(default);
        var second = await f.Notifications.CheckDeadlinesAsync(default);

        Assert.Equal(2, first);
        Assert.Equal(0, second);
        var types = await f.Db.Notifications.Select(n => n.Type).ToListAsync();
        Assert.Contains(NotificationType.Overdue, types);
        Assert.Contains(NotificationType.DueSoon, types);

        // parâmetros para o frontend montar o texto no idioma do usuário
        var dueSoon = NotificationDto.From(await f.Db.Notifications.FirstAsync(n => n.Type == NotificationType.DueSoon));
        Assert.Equal("Vence amanhã", dueSoon.Args!["task"]);
        Assert.Equal(f.Clock.Today.AddDays(1).ToString("yyyy-MM-dd"), dueSoon.Args["dueDate"]);
        Assert.Equal("false", dueSoon.Args["today"]);
    }

    [Fact]
    public void Troca_de_responsavel_informa_a_variante_nos_parametros()
    {
        var task = new K2Projects.Domain.Entities.WorkTask { Title = "Tarefa X" };

        var assigned = NotificationDto.From(NotificationFactory.AssigneeChanged(Guid.NewGuid(), task, isNewAssignee: true));
        var removed = NotificationDto.From(NotificationFactory.AssigneeChanged(Guid.NewGuid(), task, isNewAssignee: false));

        Assert.Equal("assigned", assigned.Args!["variant"]);
        Assert.Equal("removed", removed.Args!["variant"]);
        Assert.Equal("Tarefa X", removed.Args["task"]);
    }

    [Fact]
    public async Task Marcar_como_lida_e_marcar_todas()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.LoginAs(f.Manager);
        await f.Tasks.CreateAsync(new(project.Id, "T1", null, WorkTaskStatus.AFazer, TaskPriority.Baixa, f.Collaborator.Id, null, null, null), default);
        await f.Tasks.CreateAsync(new(project.Id, "T2", null, WorkTaskStatus.AFazer, TaskPriority.Baixa, f.Collaborator.Id, null, null, null), default);

        f.LoginAs(f.Collaborator);
        Assert.Equal(2, await f.Notifications.UnreadCountAsync(default));

        var list = await f.Notifications.ListAsync(new NotificationQuery(), default);
        await f.Notifications.MarkReadAsync(list.Items[0].Id, default);
        Assert.Equal(1, await f.Notifications.UnreadCountAsync(default));

        await f.Notifications.MarkAllReadAsync(default);
        Assert.Equal(0, await f.Notifications.UnreadCountAsync(default));
    }

    [Fact]
    public async Task Usuario_nao_marca_notificacao_de_outro()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.LoginAs(f.Manager);
        await f.Tasks.CreateAsync(new(project.Id, "T1", null, WorkTaskStatus.AFazer, TaskPriority.Baixa, f.Collaborator.Id, null, null, null), default);
        var id = (await f.Db.Notifications.FirstAsync()).Id;

        f.LoginAs(f.OtherCollaborator);
        await Assert.ThrowsAsync<NotFoundException>(() => f.Notifications.MarkReadAsync(id, default));
    }
}

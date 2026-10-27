using K2Projects.Application.Common;
using K2Projects.Application.Projects;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.UnitTests;

public class ProjectServiceTests
{
    private static ProjectRequest Request(string name = "Novo Projeto", Guid? owner = null, IReadOnlyList<Guid>? members = null) =>
        new(name, "Descrição", new DateOnly(2026, 11, 1), new DateOnly(2026, 12, 1), ProjectStatus.Planejado, owner, members);

    [Fact]
    public async Task Gerente_cria_projeto_e_se_torna_responsavel()
    {
        var f = new TestFixture();
        f.LoginAs(f.Manager);

        var created = await f.Projects.CreateAsync(Request(members: [f.Collaborator.Id]), default);

        Assert.Equal(f.Manager.Id, created.OwnerId);
        Assert.Equal(1, created.MemberCount);
        Assert.True(created.CanManage);
        Assert.Contains("project", f.Realtime.Changes);
    }

    [Fact]
    public async Task Colaborador_nao_pode_criar_projeto()
    {
        var f = new TestFixture();
        f.LoginAs(f.Collaborator);

        await Assert.ThrowsAsync<ForbiddenException>(() => f.Projects.CreateAsync(Request(), default));
    }

    [Fact]
    public async Task Cadastro_valida_nome_e_datas()
    {
        var f = new TestFixture();
        var invalid = new ProjectRequest("", null, new DateOnly(2026, 12, 1), new DateOnly(2026, 11, 1), ProjectStatus.Planejado, null, null);

        await ValidationAssert.FailsAsync(() => f.Projects.CreateAsync(invalid, default), "Name");
        await ValidationAssert.FailsAsync(() => f.Projects.CreateAsync(invalid, default), "DueDate");
    }

    [Fact]
    public async Task Admin_nao_pode_definir_colaborador_como_responsavel()
    {
        var f = new TestFixture();
        await ValidationAssert.FailsAsync(() => f.Projects.CreateAsync(Request(owner: f.Collaborator.Id), default), "OwnerId");
    }

    [Fact]
    public async Task Atualiza_projeto_do_proprio_gerente()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager);
        f.LoginAs(f.Manager);

        var updated = await f.Projects.UpdateAsync(project.Id,
            Request("Nome Atualizado") with { Status = ProjectStatus.EmAndamento }, default);

        Assert.Equal("Nome Atualizado", updated.Name);
        Assert.Equal(ProjectStatus.EmAndamento, updated.Status);
        Assert.NotNull(updated.UpdatedAt);
    }

    [Fact]
    public async Task Gerente_nao_altera_projeto_de_outro_gerente()
    {
        var f = new TestFixture();
        var project = f.SeedProject(f.Manager, f.OtherManager);
        f.LoginAs(f.OtherManager);

        await Assert.ThrowsAsync<ForbiddenException>(() => f.Projects.UpdateAsync(project.Id, Request(), default));
    }

    [Fact]
    public async Task Colaborador_so_visualiza_projetos_dos_quais_participa()
    {
        var f = new TestFixture();
        f.SeedProject(f.Manager, f.Collaborator);
        f.SeedProject(f.Manager, f.OtherCollaborator);
        f.LoginAs(f.Collaborator);

        var list = await f.Projects.ListAsync(new ProjectQuery(), default);

        Assert.Single(list.Items);
        Assert.False(list.Items[0].CanManage);
    }

    [Fact]
    public async Task Progresso_do_projeto_reflete_as_tarefas()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.SeedTask(project, "A", WorkTaskStatus.Concluido);
        f.SeedTask(project, "B", WorkTaskStatus.EmAndamento);
        f.SeedTask(project, "C", WorkTaskStatus.AFazer);
        f.SeedTask(project, "D", WorkTaskStatus.Concluido);

        var detail = await f.Projects.GetAsync(project.Id, default);

        Assert.Equal(4, detail.Project.TaskCount);
        Assert.Equal(50, detail.Project.Progress);
    }

    [Fact]
    public async Task Exclusao_de_projeto_com_tarefas_exige_confirmacao()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        var parent = f.SeedTask(project, "Pai");
        f.SeedTask(project, "Filha", parentId: parent.Id);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => f.Projects.DeleteAsync(project.Id, confirm: false, default));
        Assert.Contains("2 tarefa", ex.Message);
        Assert.True(await f.Db.Projects.AnyAsync(p => p.Id == project.Id));

        await f.Projects.DeleteAsync(project.Id, confirm: true, default);
        Assert.False(await f.Db.Projects.AnyAsync(p => p.Id == project.Id));
        Assert.False(await f.Db.Tasks.AnyAsync());
    }

    [Fact]
    public async Task Nao_remove_membro_com_tarefas_em_aberto()
    {
        var f = new TestFixture();
        var project = f.SeedProject();
        f.SeedTask(project, assignee: f.Collaborator);

        await Assert.ThrowsAsync<ConflictException>(() => f.Projects.RemoveMemberAsync(project.Id, f.Collaborator.Id, default));
    }

    [Fact]
    public async Task Adiciona_membro_ao_projeto()
    {
        var f = new TestFixture();
        var project = f.SeedProject();

        var members = await f.Projects.AddMemberAsync(project.Id, f.OtherCollaborator.Id, default);

        Assert.Contains(members, m => m.UserId == f.OtherCollaborator.Id);
        await Assert.ThrowsAsync<ConflictException>(() => f.Projects.AddMemberAsync(project.Id, f.OtherCollaborator.Id, default));
    }
}

using K2Projects.Application.Common;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.Application.Security;

/// <summary>
/// Centraliza as regras de autorização por perfil e por vínculo ao projeto.
/// Administrador: tudo. Gerente: gerencia os projetos dos quais é responsável.
/// Colaborador: visualiza projetos dos quais participa e altera o status das tarefas atribuídas a ele.
/// </summary>
public class AccessService(IAppDbContext db, ICurrentUser currentUser)
{
    public Guid UserId => currentUser.UserId;
    public UserRole Role => currentUser.Role;
    public bool IsAdmin => currentUser.Role == UserRole.Administrador;
    public bool IsManager => currentUser.Role == UserRole.Gerente;
    public bool CanCreateProjects => IsAdmin || IsManager;

    public IQueryable<Project> VisibleProjects()
    {
        if (IsAdmin) return db.Projects;
        var me = UserId;
        return db.Projects.Where(p => p.OwnerId == me || p.Members.Any(m => m.UserId == me));
    }

    public IQueryable<WorkTask> VisibleTasks()
    {
        if (IsAdmin) return db.Tasks;
        var me = UserId;
        return db.Tasks.Where(t => t.AssignedToId == me
                                   || t.Project!.OwnerId == me
                                   || t.Project.Members.Any(m => m.UserId == me));
    }

    public bool CanManageProject(Project project) => CanManageProject(project.OwnerId);

    public bool CanManageProject(Guid projectOwnerId) => IsAdmin || (IsManager && projectOwnerId == UserId);

    public bool CanChangeTaskStatus(WorkTask task, Guid projectOwnerId) =>
        CanManageProject(projectOwnerId) || task.AssignedToId == UserId;

    /// <summary>Carrega um projeto visível ao usuário ou lança NotFound.</summary>
    public async Task<Project> GetVisibleProjectAsync(Guid projectId, CancellationToken ct)
    {
        return await VisibleProjects().FirstOrDefaultAsync(p => p.Id == projectId, ct)
               ?? throw new NotFoundException("Projeto não encontrado.", ErrorCodes.ProjectNotFound);
    }

    /// <summary>Carrega um projeto que o usuário pode gerenciar; lança NotFound/Forbidden.</summary>
    public async Task<Project> GetManageableProjectAsync(Guid projectId, CancellationToken ct)
    {
        var project = await GetVisibleProjectAsync(projectId, ct);
        if (!CanManageProject(project)) throw new ForbiddenException("Somente o responsável pelo projeto ou um administrador pode alterá-lo.", ErrorCodes.ManageProjectForbidden);
        return project;
    }

    /// <summary>Carrega uma tarefa visível (com o projeto) ou lança NotFound.</summary>
    public async Task<WorkTask> GetVisibleTaskAsync(Guid taskId, CancellationToken ct)
    {
        return await VisibleTasks().Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId, ct)
               ?? throw new NotFoundException("Tarefa não encontrada.", ErrorCodes.TaskNotFound);
    }
}

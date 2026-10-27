using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Application.Security;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Projects;

public class ProjectService(
    IAppDbContext db,
    AccessService access,
    IClock clock,
    IRealtimeNotifier realtime,
    IValidator<ProjectRequest> validator,
    ILogger<ProjectService> logger)
{
    public async Task<PagedResult<ProjectListItemDto>> ListAsync(ProjectQuery query, CancellationToken ct)
    {
        var q = access.VisibleProjects().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(p => p.Name.ToLower().Contains(term) || (p.Description != null && p.Description.ToLower().Contains(term)));
        }
        if (query.Status.HasValue) q = q.Where(p => p.Status == query.Status);

        var page = await Project(q.OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)).ToPagedAsync(query, ct);
        return page with { Items = page.Items.Select(WithProgress).ToList() };
    }

    public async Task<IReadOnlyList<ProjectLookupDto>> LookupAsync(CancellationToken ct)
    {
        var me = access.UserId;
        var isAdmin = access.IsAdmin;
        var isManager = access.IsManager;
        return await access.VisibleProjects().AsNoTracking().OrderBy(p => p.Name)
            .Select(p => new ProjectLookupDto(p.Id, p.Name, p.Status, isAdmin || (isManager && p.OwnerId == me)))
            .ToListAsync(ct);
    }

    public async Task<ProjectDetailDto> GetAsync(Guid id, CancellationToken ct)
    {
        var item = await Project(access.VisibleProjects().AsNoTracking().Where(p => p.Id == id)).FirstOrDefaultAsync(ct)
                   ?? throw new NotFoundException("Projeto não encontrado.", ErrorCodes.ProjectNotFound);

        var counts = await db.Tasks.AsNoTracking().Where(t => t.ProjectId == id)
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return new ProjectDetailDto(
            WithProgress(item),
            counts.FirstOrDefault(c => c.Status == WorkTaskStatus.AFazer)?.Count ?? 0,
            counts.FirstOrDefault(c => c.Status == WorkTaskStatus.EmAndamento)?.Count ?? 0,
            await GetMembersInternalAsync(id, ct));
    }

    public async Task<ProjectListItemDto> CreateAsync(ProjectRequest request, CancellationToken ct)
    {
        if (!access.CanCreateProjects) throw new ForbiddenException("Somente administradores e gerentes podem criar projetos.", ErrorCodes.CreateProjectForbidden);
        await validator.ValidateAndThrowAsync(request, ct);

        var ownerId = await ResolveOwnerAsync(request.OwnerId, null, ct);
        var project = new Project
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            StartDate = request.StartDate,
            DueDate = request.DueDate,
            Status = request.Status,
            OwnerId = ownerId
        };

        if (request.MemberIds is { Count: > 0 })
        {
            var validIds = await ActiveUserIdsAsync(request.MemberIds, ct);
            foreach (var userId in validIds.Where(u => u != ownerId))
                project.Members.Add(new ProjectMember { UserId = userId });
        }

        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Projeto {ProjectId} criado por {UserId}", project.Id, access.UserId);
        await realtime.BroadcastDataChangedAsync("project", project.Id, ct);
        return await GetListItemAsync(project.Id, ct);
    }

    public async Task<ProjectListItemDto> UpdateAsync(Guid id, ProjectRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var project = await access.GetManageableProjectAsync(id, ct);

        project.Name = request.Name.Trim();
        project.Description = request.Description?.Trim();
        project.StartDate = request.StartDate;
        project.DueDate = request.DueDate;
        project.Status = request.Status;
        project.OwnerId = await ResolveOwnerAsync(request.OwnerId, project, ct);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Projeto {ProjectId} atualizado por {UserId}", project.Id, access.UserId);
        await realtime.BroadcastDataChangedAsync("project", project.Id, ct);
        return await GetListItemAsync(project.Id, ct);
    }

    /// <summary>
    /// Exclui o projeto. Se houver tarefas, exige confirmação explícita (confirm = true) e
    /// remove tarefas, subtarefas e comentários; notificações relacionadas perdem o vínculo com a tarefa.
    /// </summary>
    public async Task DeleteAsync(Guid id, bool confirm, CancellationToken ct)
    {
        var project = await access.GetManageableProjectAsync(id, ct);
        var tasks = await db.Tasks.Where(t => t.ProjectId == id).ToListAsync(ct);

        if (tasks.Count > 0 && !confirm)
            throw new ConflictException(
                $"O projeto possui {tasks.Count} tarefa(s). Confirme a exclusão para remover o projeto e todas as tarefas vinculadas.",
                ErrorCodes.ProjectHasTasks,
                new Dictionary<string, object?> { ["count"] = tasks.Count },
                new { taskCount = tasks.Count, requiresConfirmation = true });

        var taskIds = tasks.Select(t => t.Id).ToList();
        if (taskIds.Count > 0)
        {
            var notifications = await db.Notifications.Where(n => n.RelatedTaskId != null && taskIds.Contains(n.RelatedTaskId.Value)).ToListAsync(ct);
            foreach (var n in notifications) n.RelatedTaskId = null;
            db.TaskComments.RemoveRange(await db.TaskComments.Where(c => taskIds.Contains(c.TaskId)).ToListAsync(ct));
            foreach (var t in tasks) t.ParentTaskId = null;
            await db.SaveChangesAsync(ct);
            db.Tasks.RemoveRange(tasks);
        }

        db.ProjectMembers.RemoveRange(await db.ProjectMembers.Where(m => m.ProjectId == id).ToListAsync(ct));
        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Projeto {ProjectId} excluído por {UserId} ({TaskCount} tarefas removidas)", id, access.UserId, taskIds.Count);
        await realtime.BroadcastDataChangedAsync("project", id, ct);
    }

    public async Task<IReadOnlyList<ProjectMemberDto>> GetMembersAsync(Guid projectId, CancellationToken ct)
    {
        await access.GetVisibleProjectAsync(projectId, ct);
        return await GetMembersInternalAsync(projectId, ct);
    }

    public async Task<IReadOnlyList<ProjectMemberDto>> AddMemberAsync(Guid projectId, Guid userId, CancellationToken ct)
    {
        var project = await access.GetManageableProjectAsync(projectId, ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw new NotFoundException("Usuário não encontrado.", ErrorCodes.UserNotFound);
        if (!user.Active) throw new ConflictException("Não é possível adicionar um usuário inativo.", ErrorCodes.InactiveMember);
        if (user.Id == project.OwnerId) throw new ConflictException("O responsável pelo projeto já participa dele.", ErrorCodes.OwnerAlreadyParticipates);
        if (await db.ProjectMembers.AnyAsync(m => m.ProjectId == projectId && m.UserId == userId, ct))
            throw new ConflictException("Este usuário já é membro do projeto.", ErrorCodes.AlreadyMember);

        db.ProjectMembers.Add(new ProjectMember { ProjectId = projectId, UserId = userId });
        project.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await realtime.BroadcastDataChangedAsync("project", projectId, ct);
        return await GetMembersInternalAsync(projectId, ct);
    }

    public async Task RemoveMemberAsync(Guid projectId, Guid userId, CancellationToken ct)
    {
        var project = await access.GetManageableProjectAsync(projectId, ct);
        var member = await db.ProjectMembers.FirstOrDefaultAsync(m => m.ProjectId == projectId && m.UserId == userId, ct)
                     ?? throw new NotFoundException("Membro não encontrado neste projeto.", ErrorCodes.MemberNotFound);

        var openTasks = await db.Tasks.CountAsync(t => t.ProjectId == projectId && t.AssignedToId == userId && t.Status != WorkTaskStatus.Concluido, ct);
        if (openTasks > 0)
            throw new ConflictException($"Este membro é responsável por {openTasks} tarefa(s) em aberto. Reatribua as tarefas antes de removê-lo.",
                ErrorCodes.MemberHasOpenTasks, new Dictionary<string, object?> { ["count"] = openTasks });

        db.ProjectMembers.Remove(member);
        project.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await realtime.BroadcastDataChangedAsync("project", projectId, ct);
    }

    private async Task<ProjectListItemDto> GetListItemAsync(Guid id, CancellationToken ct) =>
        WithProgress(await Project(db.Projects.AsNoTracking().Where(p => p.Id == id)).FirstAsync(ct));

    private async Task<IReadOnlyList<ProjectMemberDto>> GetMembersInternalAsync(Guid projectId, CancellationToken ct) =>
        await db.ProjectMembers.AsNoTracking()
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.User!.Name)
            .Select(m => new ProjectMemberDto(
                m.UserId, m.User!.Name, m.User.Email, m.User.Role, m.AddedAt,
                db.Tasks.Count(t => t.ProjectId == projectId && t.AssignedToId == m.UserId && t.Status != WorkTaskStatus.Concluido)))
            .ToListAsync(ct);

    private IQueryable<ProjectListItemDto> Project(IQueryable<Project> query)
    {
        var me = access.UserId;
        var isAdmin = access.IsAdmin;
        var isManager = access.IsManager;
        var today = clock.Today;
        return query.Select(p => new ProjectListItemDto(
            p.Id, p.Name, p.Description, p.StartDate, p.DueDate, p.Status, p.OwnerId, p.Owner!.Name,
            p.Tasks.Count(),
            p.Tasks.Count(t => t.Status == WorkTaskStatus.Concluido),
            p.Tasks.Count(t => t.Status != WorkTaskStatus.Concluido && t.DueDate != null && t.DueDate < today),
            0,
            p.Members.Count(),
            p.CreatedAt, p.UpdatedAt,
            isAdmin || (isManager && p.OwnerId == me)));
    }

    private static ProjectListItemDto WithProgress(ProjectListItemDto p) =>
        p with { Progress = Domain.Entities.Project.CalculateProgress(p.TaskCount, p.CompletedTaskCount) };

    /// <summary>Administrador pode definir qualquer gerente/administrador como responsável; gerente é sempre o responsável.</summary>
    private async Task<Guid> ResolveOwnerAsync(Guid? requestedOwnerId, Project? existing, CancellationToken ct)
    {
        if (!access.IsAdmin)
        {
            var current = existing?.OwnerId ?? access.UserId;
            if (requestedOwnerId.HasValue && requestedOwnerId != current)
                throw new ForbiddenException("Somente administradores podem alterar o responsável pelo projeto.", ErrorCodes.ChangeOwnerForbidden);
            return current;
        }

        var ownerId = requestedOwnerId ?? existing?.OwnerId ?? access.UserId;
        var owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == ownerId, ct)
                    ?? throw Validation.Fail("OwnerId", ErrorCodes.OwnerNotFound, "Responsável não encontrado.");
        if (!owner.Active || owner.Role == UserRole.Colaborador)
            throw Validation.Fail("OwnerId", ErrorCodes.OwnerInvalidRole, "O responsável deve ser um gerente ou administrador ativo.");

        if (existing is not null && existing.OwnerId != ownerId)
        {
            // O novo responsável deixa de constar como membro comum; o anterior passa a ser membro para manter o acesso.
            var newOwnerMembership = await db.ProjectMembers.FirstOrDefaultAsync(m => m.ProjectId == existing.Id && m.UserId == ownerId, ct);
            if (newOwnerMembership is not null) db.ProjectMembers.Remove(newOwnerMembership);
            if (!await db.ProjectMembers.AnyAsync(m => m.ProjectId == existing.Id && m.UserId == existing.OwnerId, ct))
                db.ProjectMembers.Add(new ProjectMember { ProjectId = existing.Id, UserId = existing.OwnerId });
        }
        return ownerId;
    }

    private async Task<List<Guid>> ActiveUserIdsAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var distinct = ids.Distinct().ToList();
        return await db.Users.Where(u => distinct.Contains(u.Id) && u.Active).Select(u => u.Id).ToListAsync(ct);
    }
}

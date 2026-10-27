using FluentValidation;
using FluentValidation.Results;
using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Application.Security;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Tasks;

public class TaskService(
    IAppDbContext db,
    AccessService access,
    IClock clock,
    IRealtimeNotifier realtime,
    IValidator<CreateTaskRequest> createValidator,
    IValidator<UpdateTaskRequest> updateValidator,
    IValidator<MoveTaskRequest> moveValidator,
    ILogger<TaskService> logger)
{
    public async Task<PagedResult<TaskListItemDto>> ListAsync(TaskQuery query, CancellationToken ct)
    {
        var q = access.VisibleTasks().AsNoTracking();
        var today = clock.Today;

        if (query.ProjectId.HasValue) q = q.Where(t => t.ProjectId == query.ProjectId);
        if (query.AssignedToId.HasValue) q = q.Where(t => t.AssignedToId == query.AssignedToId);
        if (query.Status.HasValue) q = q.Where(t => t.Status == query.Status);
        if (query.Priority.HasValue) q = q.Where(t => t.Priority == query.Priority);
        if (query.ParentTaskId.HasValue) q = q.Where(t => t.ParentTaskId == query.ParentTaskId);
        if (query.DueFrom.HasValue) q = q.Where(t => t.DueDate >= query.DueFrom);
        if (query.DueTo.HasValue) q = q.Where(t => t.DueDate <= query.DueTo);
        if (query.Overdue == true)
            q = q.Where(t => t.Status != WorkTaskStatus.Concluido && t.DueDate != null && t.DueDate < today);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(term) || (t.Description != null && t.Description.ToLower().Contains(term)));
        }

        q = query.SortBy?.ToLowerInvariant() switch
        {
            "priority" => q.OrderByDescending(t => t.Priority).ThenBy(t => t.DueDate == null).ThenBy(t => t.DueDate),
            "title" => q.OrderBy(t => t.Title),
            "createdat" => q.OrderByDescending(t => t.CreatedAt),
            "board" => q.OrderBy(t => t.Status).ThenBy(t => t.SortOrder).ThenBy(t => t.CreatedAt),
            _ => q.OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.Priority)
        };

        return await ProjectToDto(q).ToPagedAsync(query, ct);
    }

    /// <summary>Tarefas do projeto ordenadas por coluna e posição para o Kanban.</summary>
    public async Task<IReadOnlyList<TaskListItemDto>> BoardAsync(Guid projectId, CancellationToken ct)
    {
        await access.GetVisibleProjectAsync(projectId, ct);
        return await ProjectToDto(db.Tasks.AsNoTracking().Where(t => t.ProjectId == projectId)
                .OrderBy(t => t.Status).ThenBy(t => t.SortOrder).ThenBy(t => t.CreatedAt))
            .ToListAsync(ct);
    }

    /// <summary>Tarefas atribuídas ao usuário autenticado, agrupadas. Atrasadas aparecem somente no grupo "Atrasadas".</summary>
    public async Task<MyTasksDto> MyTasksAsync(CancellationToken ct)
    {
        var me = access.UserId;
        var all = await ProjectToDto(db.Tasks.AsNoTracking().Where(t => t.AssignedToId == me)
                .OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.Priority))
            .ToListAsync(ct);

        return new MyTasksDto(
            all.Where(t => t.Status == WorkTaskStatus.AFazer && !t.IsOverdue).ToList(),
            all.Where(t => t.Status == WorkTaskStatus.EmAndamento && !t.IsOverdue).ToList(),
            all.Where(t => t.Status == WorkTaskStatus.Concluido).OrderByDescending(t => t.CompletedAt).Take(50).ToList(),
            all.Where(t => t.IsOverdue).ToList());
    }

    public async Task<TaskDetailDto> GetAsync(Guid id, CancellationToken ct)
    {
        var item = await ProjectToDto(access.VisibleTasks().AsNoTracking().Where(t => t.Id == id)).FirstOrDefaultAsync(ct)
                   ?? throw new NotFoundException("Tarefa não encontrada.", ErrorCodes.TaskNotFound);

        var extra = await db.Tasks.AsNoTracking().Where(t => t.Id == id)
            .Select(t => new { t.Description, t.CreatedById, CreatedByName = t.CreatedBy!.Name })
            .FirstAsync(ct);

        var subtasks = await ProjectToDto(db.Tasks.AsNoTracking().Where(t => t.ParentTaskId == id)
                .OrderBy(t => t.Status).ThenBy(t => t.CreatedAt))
            .ToListAsync(ct);

        return new TaskDetailDto(item, extra.Description, extra.CreatedById, extra.CreatedByName, subtasks);
    }

    public async Task<TaskListItemDto> CreateAsync(CreateTaskRequest request, CancellationToken ct)
    {
        await createValidator.ValidateAndThrowAsync(request, ct);
        var project = await access.GetManageableProjectAsync(request.ProjectId, ct);
        await EnsureValidAssigneeAsync(project, request.AssignedToId, ct);

        if (request.ParentTaskId.HasValue)
            await EnsureValidParentAsync(null, request.ParentTaskId.Value, project.Id, ct);

        var now = clock.UtcNow;
        var task = new WorkTask
        {
            ProjectId = project.Id,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Priority = request.Priority,
            AssignedToId = request.AssignedToId,
            StartDate = request.StartDate,
            DueDate = request.DueDate,
            ParentTaskId = request.ParentTaskId,
            CreatedById = access.UserId,
            SortOrder = await NextSortOrderAsync(project.Id, request.Status, ct)
        };
        task.ChangeStatus(request.Status, now);
        db.Tasks.Add(task);

        var notifications = new List<Notification>();
        if (task.AssignedToId.HasValue && task.AssignedToId != access.UserId)
            notifications.Add(NotificationFactory.TaskAssigned(task.AssignedToId.Value, task, project.Name));
        db.Notifications.AddRange(notifications);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Tarefa {TaskId} criada no projeto {ProjectId} por {UserId}", task.Id, project.Id, access.UserId);
        await AfterChangeAsync(project.Id, notifications, ct);
        return await GetListItemAsync(task.Id, ct);
    }

    public async Task<TaskListItemDto> UpdateAsync(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        await updateValidator.ValidateAndThrowAsync(request, ct);
        var task = await access.GetVisibleTaskAsync(id, ct);
        var project = task.Project!;
        if (!access.CanManageProject(project))
            throw new ForbiddenException("Somente o responsável pelo projeto ou um administrador pode editar esta tarefa.", ErrorCodes.EditTaskForbidden);

        if (request.AssignedToId != task.AssignedToId)
            await EnsureValidAssigneeAsync(project, request.AssignedToId, ct);
        if (request.ParentTaskId.HasValue && request.ParentTaskId != task.ParentTaskId)
            await EnsureValidParentAsync(task.Id, request.ParentTaskId.Value, project.Id, ct);

        var previousAssignee = task.AssignedToId;
        if (request.Status != task.Status)
        {
            task.SortOrder = await NextSortOrderAsync(project.Id, request.Status, ct);
            task.ChangeStatus(request.Status, clock.UtcNow);
        }

        task.Title = request.Title.Trim();
        task.Description = request.Description?.Trim();
        task.Priority = request.Priority;
        task.AssignedToId = request.AssignedToId;
        task.StartDate = request.StartDate;
        task.DueDate = request.DueDate;
        task.ParentTaskId = request.ParentTaskId;

        var notifications = AssigneeChangeNotifications(task, previousAssignee);
        db.Notifications.AddRange(notifications);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Tarefa {TaskId} atualizada por {UserId}", task.Id, access.UserId);
        await AfterChangeAsync(project.Id, notifications, ct);
        return await GetListItemAsync(task.Id, ct);
    }

    public async Task<TaskListItemDto> ChangeStatusAsync(Guid id, WorkTaskStatus status, CancellationToken ct)
    {
        if (!Enum.IsDefined(status))
            throw Validation.Fail("Status", ErrorCodes.StatusInvalid, "Status inválido.");

        var task = await access.GetVisibleTaskAsync(id, ct);
        if (!access.CanChangeTaskStatus(task, task.Project!.OwnerId))
            throw new ForbiddenException("Você só pode alterar o status das tarefas atribuídas a você.", ErrorCodes.ChangeStatusForbidden);

        if (task.Status != status)
        {
            task.SortOrder = await NextSortOrderAsync(task.ProjectId, status, ct);
            task.ChangeStatus(status, clock.UtcNow);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Status da tarefa {TaskId} alterado para {Status} por {UserId}", task.Id, status, access.UserId);
            await AfterChangeAsync(task.ProjectId, [], ct);
        }
        return await GetListItemAsync(task.Id, ct);
    }

    /// <summary>Move o cartão no Kanban: altera o status (se mudou de coluna) e reordena a coluna de destino.</summary>
    public async Task<TaskListItemDto> MoveAsync(Guid id, MoveTaskRequest request, CancellationToken ct)
    {
        await moveValidator.ValidateAndThrowAsync(request, ct);
        var task = await access.GetVisibleTaskAsync(id, ct);
        if (!access.CanChangeTaskStatus(task, task.Project!.OwnerId))
            throw new ForbiddenException("Você só pode mover as tarefas atribuídas a você.", ErrorCodes.MoveTaskForbidden);

        var column = await db.Tasks
            .Where(t => t.ProjectId == task.ProjectId && t.Status == request.Status && t.Id != task.Id)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.CreatedAt)
            .ToListAsync(ct);

        column.Insert(Math.Min(request.Position, column.Count), task);
        var previousStatus = task.Status;
        task.ChangeStatus(request.Status, clock.UtcNow);
        for (var i = 0; i < column.Count; i++)
            column[i].SortOrder = i;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Tarefa {TaskId} movida no Kanban de {From} para {To} (posição {Position}) por {UserId}",
            task.Id, previousStatus, request.Status, request.Position, access.UserId);
        await AfterChangeAsync(task.ProjectId, [], ct);
        return await GetListItemAsync(task.Id, ct);
    }

    /// <summary>Exclui a tarefa e suas subtarefas (recursivamente), com os comentários vinculados.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var task = await access.GetVisibleTaskAsync(id, ct);
        if (!access.CanManageProject(task.Project!))
            throw new ForbiddenException("Somente o responsável pelo projeto ou um administrador pode excluir esta tarefa.", ErrorCodes.DeleteTaskForbidden);

        var projectTasks = await db.Tasks.Where(t => t.ProjectId == task.ProjectId).ToListAsync(ct);
        var toDelete = new List<WorkTask> { task };
        for (var i = 0; i < toDelete.Count; i++)
            toDelete.AddRange(projectTasks.Where(t => t.ParentTaskId == toDelete[i].Id && !toDelete.Contains(t)));

        var ids = toDelete.Select(t => t.Id).ToList();
        var notifications = await db.Notifications.Where(n => n.RelatedTaskId != null && ids.Contains(n.RelatedTaskId.Value)).ToListAsync(ct);
        foreach (var n in notifications) n.RelatedTaskId = null;
        db.TaskComments.RemoveRange(await db.TaskComments.Where(c => ids.Contains(c.TaskId)).ToListAsync(ct));
        foreach (var t in toDelete) t.ParentTaskId = null;
        await db.SaveChangesAsync(ct);

        db.Tasks.RemoveRange(toDelete);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Tarefa {TaskId} excluída por {UserId} ({Count} itens incluindo subtarefas)", id, access.UserId, ids.Count);
        await AfterChangeAsync(task.ProjectId, [], ct);
    }

    private List<Notification> AssigneeChangeNotifications(WorkTask task, Guid? previousAssignee)
    {
        var list = new List<Notification>();
        if (previousAssignee == task.AssignedToId) return list;
        if (task.AssignedToId.HasValue && task.AssignedToId != access.UserId)
            list.Add(NotificationFactory.AssigneeChanged(task.AssignedToId.Value, task, isNewAssignee: true));
        if (previousAssignee.HasValue && previousAssignee != access.UserId)
            list.Add(NotificationFactory.AssigneeChanged(previousAssignee.Value, task, isNewAssignee: false));
        return list;
    }

    private async Task AfterChangeAsync(Guid projectId, List<Notification> notifications, CancellationToken ct)
    {
        if (notifications.Count > 0) await realtime.SendNotificationsAsync(notifications, ct);
        await realtime.BroadcastDataChangedAsync("task", projectId, ct);
    }

    /// <summary>O responsável deve ser um usuário ativo que participa do projeto (membro ou responsável pelo projeto).</summary>
    private async Task EnsureValidAssigneeAsync(Project project, Guid? assigneeId, CancellationToken ct)
    {
        if (!assigneeId.HasValue) return;
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == assigneeId, ct);
        if (user is null || !user.Active)
            throw Validation.Fail("AssignedToId", ErrorCodes.AssigneeNotFound, "Responsável não encontrado ou inativo.");
        var participates = project.OwnerId == user.Id
                           || await db.ProjectMembers.AnyAsync(m => m.ProjectId == project.Id && m.UserId == user.Id, ct);
        if (!participates)
            throw Validation.Fail("AssignedToId", ErrorCodes.AssigneeNotMember, "O responsável precisa ser membro do projeto.");
    }

    /// <summary>A tarefa principal deve existir no mesmo projeto e não pode gerar ciclo (A → B → A).</summary>
    private async Task EnsureValidParentAsync(Guid? taskId, Guid parentId, Guid projectId, CancellationToken ct)
    {
        if (taskId == parentId)
            throw Validation.Fail("ParentTaskId", ErrorCodes.ParentSelf, "Uma tarefa não pode ser subtarefa dela mesma.");

        var parent = await db.Tasks.AsNoTracking().Where(t => t.Id == parentId)
                         .Select(t => new { t.ProjectId, t.ParentTaskId }).FirstOrDefaultAsync(ct)
                     ?? throw Validation.Fail("ParentTaskId", ErrorCodes.ParentNotFound, "Tarefa principal não encontrada.");

        if (parent.ProjectId != projectId)
            throw Validation.Fail("ParentTaskId", ErrorCodes.ParentOtherProject, "A subtarefa deve pertencer ao mesmo projeto da tarefa principal.");

        if (!taskId.HasValue) return;
        var current = parent.ParentTaskId;
        var guard = 0;
        while (current.HasValue && guard++ < 1000)
        {
            if (current == taskId)
                throw Validation.Fail("ParentTaskId", ErrorCodes.ParentCycle, "Esta associação criaria um ciclo de subtarefas.");
            var next = current.Value;
            current = await db.Tasks.AsNoTracking().Where(t => t.Id == next).Select(t => t.ParentTaskId).FirstOrDefaultAsync(ct);
        }
    }

    private async Task<int> NextSortOrderAsync(Guid projectId, WorkTaskStatus status, CancellationToken ct)
    {
        var max = await db.Tasks.Where(t => t.ProjectId == projectId && t.Status == status)
            .Select(t => (int?)t.SortOrder).MaxAsync(ct);
        return (max ?? -1) + 1;
    }

    private async Task<TaskListItemDto> GetListItemAsync(Guid id, CancellationToken ct) =>
        await ProjectToDto(db.Tasks.AsNoTracking().Where(t => t.Id == id)).FirstAsync(ct);

    private IQueryable<TaskListItemDto> ProjectToDto(IQueryable<WorkTask> query)
    {
        var me = access.UserId;
        var isAdmin = access.IsAdmin;
        var isManager = access.IsManager;
        var today = clock.Today;
        return query.Select(t => new TaskListItemDto(
            t.Id, t.ProjectId, t.Project!.Name, t.Title, t.Status, t.Priority,
            t.AssignedToId, t.AssignedTo != null ? t.AssignedTo.Name : null,
            t.StartDate, t.DueDate,
            t.ParentTaskId, t.ParentTask != null ? t.ParentTask.Title : null,
            t.Subtasks.Count(),
            t.Subtasks.Count(s => s.Status == WorkTaskStatus.Concluido),
            t.Comments.Count(),
            t.Status != WorkTaskStatus.Concluido && t.DueDate != null && t.DueDate < today,
            t.SortOrder, t.CompletedAt, t.CreatedAt, t.UpdatedAt,
            isAdmin || (isManager && t.Project.OwnerId == me),
            isAdmin || (isManager && t.Project.OwnerId == me) || t.AssignedToId == me));
    }
}

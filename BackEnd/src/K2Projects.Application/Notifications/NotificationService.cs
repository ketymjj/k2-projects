using System.Text.Json;
using K2Projects.Application.Common;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Notifications;

/// <summary>
/// Notificação para o frontend. "Args" traz os parâmetros do evento para o texto ser montado no idioma do usuário;
/// Title/Message (em português) são usados como reserva para notificações antigas sem parâmetros.
/// </summary>
public record NotificationDto(
    Guid Id, string Title, string Message, NotificationType Type,
    Guid? RelatedTaskId, bool IsRead, DateTime CreatedAt, IReadOnlyDictionary<string, string>? Args)
{
    public static NotificationDto From(Notification n) =>
        new(n.Id, n.Title, n.Message, n.Type, n.RelatedTaskId, n.IsRead, n.CreatedAt, NotificationArgs.Parse(n.Args));
}

public static class NotificationArgs
{
    public static string Serialize(IReadOnlyDictionary<string, string> args) => JsonSerializer.Serialize(args);

    public static IReadOnlyDictionary<string, string>? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json); }
        catch (JsonException) { return null; }
    }
}

public class NotificationQuery : PageQuery
{
    public bool? OnlyUnread { get; set; }
}

/// <summary>Monta as notificações dos eventos do sistema.</summary>
public static class NotificationFactory
{
    public static Notification TaskAssigned(Guid userId, WorkTask task, string projectName) => new()
    {
        UserId = userId,
        Type = NotificationType.TaskAssigned,
        Title = "Nova tarefa atribuída",
        Message = $"Você foi definido como responsável pela tarefa \"{task.Title}\" no projeto {projectName}.",
        RelatedTaskId = task.Id,
        Args = NotificationArgs.Serialize(new Dictionary<string, string> { ["task"] = task.Title, ["project"] = projectName })
    };

    public static Notification AssigneeChanged(Guid userId, WorkTask task, bool isNewAssignee) => new()
    {
        UserId = userId,
        Type = NotificationType.AssigneeChanged,
        Title = isNewAssignee ? "Tarefa atribuída a você" : "Responsável alterado",
        Message = isNewAssignee
            ? $"A tarefa \"{task.Title}\" agora está sob sua responsabilidade."
            : $"Você não é mais o responsável pela tarefa \"{task.Title}\".",
        RelatedTaskId = task.Id,
        Args = NotificationArgs.Serialize(new Dictionary<string, string>
        {
            ["task"] = task.Title,
            ["variant"] = isNewAssignee ? "assigned" : "removed"
        })
    };

    public static Notification NewComment(Guid userId, WorkTask task, string authorName) => new()
    {
        UserId = userId,
        Type = NotificationType.NewComment,
        Title = "Novo comentário",
        Message = $"{authorName} comentou na tarefa \"{task.Title}\".",
        RelatedTaskId = task.Id,
        Args = NotificationArgs.Serialize(new Dictionary<string, string> { ["task"] = task.Title, ["author"] = authorName })
    };

    public static Notification DueSoon(Guid userId, Guid taskId, string title, DateOnly dueDate, DateOnly today) => new()
    {
        UserId = userId,
        Type = NotificationType.DueSoon,
        Title = "Prazo próximo",
        Message = dueDate == today
            ? $"A tarefa \"{title}\" vence hoje."
            : $"A tarefa \"{title}\" vence em {dueDate:dd/MM/yyyy}.",
        RelatedTaskId = taskId,
        DedupKey = $"due-soon:{taskId}:{dueDate:yyyy-MM-dd}",
        Args = NotificationArgs.Serialize(new Dictionary<string, string>
        {
            ["task"] = title,
            ["dueDate"] = dueDate.ToString("yyyy-MM-dd"),
            ["today"] = dueDate == today ? "true" : "false"
        })
    };

    public static Notification Overdue(Guid userId, Guid taskId, string title, DateOnly dueDate) => new()
    {
        UserId = userId,
        Type = NotificationType.Overdue,
        Title = "Tarefa atrasada",
        Message = $"A tarefa \"{title}\" venceu em {dueDate:dd/MM/yyyy} e ainda não foi concluída.",
        RelatedTaskId = taskId,
        DedupKey = $"overdue:{taskId}:{dueDate:yyyy-MM-dd}",
        Args = NotificationArgs.Serialize(new Dictionary<string, string> { ["task"] = title, ["dueDate"] = dueDate.ToString("yyyy-MM-dd") })
    };
}

public class NotificationService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IClock clock,
    IRealtimeNotifier realtime,
    ILogger<NotificationService> logger)
{
    /// <summary>Quantos dias antes do vencimento a tarefa é considerada com "prazo próximo".</summary>
    public const int DueSoonDays = 1;

    public async Task<PagedResult<NotificationDto>> ListAsync(NotificationQuery query, CancellationToken ct)
    {
        var me = currentUser.UserId;
        var q = db.Notifications.AsNoTracking().Where(n => n.UserId == me);
        if (query.OnlyUnread == true) q = q.Where(n => !n.IsRead);
        var page = await q.OrderByDescending(n => n.CreatedAt).ToPagedAsync(query, ct);
        return new PagedResult<NotificationDto>(page.Items.Select(NotificationDto.From).ToList(), page.Page, page.PageSize, page.TotalCount);
    }

    public Task<int> UnreadCountAsync(CancellationToken ct)
    {
        var me = currentUser.UserId;
        return db.Notifications.CountAsync(n => n.UserId == me && !n.IsRead, ct);
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct)
    {
        var me = currentUser.UserId;
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == me, ct)
                           ?? throw new NotFoundException("Notificação não encontrada.", ErrorCodes.NotificationNotFound);
        if (notification.IsRead) return;
        notification.IsRead = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> MarkAllReadAsync(CancellationToken ct)
    {
        var me = currentUser.UserId;
        var unread = await db.Notifications.Where(n => n.UserId == me && !n.IsRead).ToListAsync(ct);
        foreach (var n in unread) n.IsRead = true;
        await db.SaveChangesAsync(ct);
        return unread.Count;
    }

    /// <summary>
    /// Verifica tarefas com prazo próximo ou atrasadas e gera notificações para os responsáveis.
    /// Usa DedupKey para não repetir a notificação do mesmo evento (tarefa + data de vencimento).
    /// </summary>
    public async Task<int> CheckDeadlinesAsync(CancellationToken ct)
    {
        var today = clock.Today;
        var limit = today.AddDays(DueSoonDays);

        var candidates = await db.Tasks.AsNoTracking()
            .Where(t => t.Status != WorkTaskStatus.Concluido
                        && t.AssignedToId != null
                        && t.AssignedTo!.Active
                        && t.DueDate != null
                        && t.DueDate <= limit)
            .Select(t => new { t.Id, t.Title, t.DueDate, AssignedToId = t.AssignedToId!.Value })
            .ToListAsync(ct);

        if (candidates.Count == 0) return 0;

        var generated = candidates.Select(c => c.DueDate!.Value < today
                ? NotificationFactory.Overdue(c.AssignedToId, c.Id, c.Title, c.DueDate.Value)
                : NotificationFactory.DueSoon(c.AssignedToId, c.Id, c.Title, c.DueDate.Value, today))
            .ToList();

        var keys = generated.Select(n => n.DedupKey!).ToList();
        var existing = (await db.Notifications.AsNoTracking()
                .Where(n => n.DedupKey != null && keys.Contains(n.DedupKey))
                .Select(n => new { n.UserId, n.DedupKey })
                .ToListAsync(ct))
            .Select(x => (x.UserId, x.DedupKey))
            .ToHashSet();

        var toCreate = generated.Where(n => !existing.Contains((n.UserId, n.DedupKey))).ToList();
        if (toCreate.Count == 0) return 0;

        db.Notifications.AddRange(toCreate);
        await db.SaveChangesAsync(ct);
        await realtime.SendNotificationsAsync(toCreate, ct);
        logger.LogInformation("Verificação de prazos gerou {Count} notificações", toCreate.Count);
        return toCreate.Count;
    }
}

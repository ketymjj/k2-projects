using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Application.Security;
using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Comments;

public record CommentDto(Guid Id, Guid TaskId, Guid UserId, string UserName, string Content, DateTime CreatedAt, DateTime? UpdatedAt, bool IsMine);

public record CommentRequest(string Content);

public class CommentRequestValidator : AbstractValidator<CommentRequest>
{
    public CommentRequestValidator()
    {
        RuleFor(x => x.Content).NotEmpty().WithMessage("Escreva o comentário.").WithErrorCode(ErrorCodes.CommentRequired)
            .MaximumLength(2000).WithMessage("O comentário deve ter no máximo 2000 caracteres.").WithErrorCode(ErrorCodes.CommentMaxLength);
    }
}

public class CommentService(
    IAppDbContext db,
    AccessService access,
    IRealtimeNotifier realtime,
    IValidator<CommentRequest> validator,
    ILogger<CommentService> logger)
{
    /// <summary>Comentários da tarefa em ordem cronológica. Exige que o usuário possa visualizar a tarefa.</summary>
    public async Task<IReadOnlyList<CommentDto>> ListAsync(Guid taskId, CancellationToken ct)
    {
        await access.GetVisibleTaskAsync(taskId, ct);
        var me = access.UserId;
        return await db.TaskComments.AsNoTracking()
            .Where(c => c.TaskId == taskId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto(c.Id, c.TaskId, c.UserId, c.User!.Name, c.Content, c.CreatedAt, c.UpdatedAt, c.UserId == me))
            .ToListAsync(ct);
    }

    public async Task<CommentDto> AddAsync(Guid taskId, CommentRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var task = await access.GetVisibleTaskAsync(taskId, ct);
        var author = await db.Users.AsNoTracking().FirstAsync(u => u.Id == access.UserId, ct);

        var comment = new TaskComment { TaskId = task.Id, UserId = author.Id, Content = request.Content.Trim() };
        db.TaskComments.Add(comment);

        // Acompanham a tarefa: responsável, criador e quem já comentou nela.
        var previousCommenters = await db.TaskComments.Where(c => c.TaskId == task.Id).Select(c => c.UserId).Distinct().ToListAsync(ct);
        var followers = previousCommenters
            .Append(task.CreatedById)
            .Concat(task.AssignedToId.HasValue ? [task.AssignedToId.Value] : Array.Empty<Guid>())
            .Where(id => id != author.Id)
            .Distinct()
            .ToList();
        var activeFollowers = await db.Users.Where(u => followers.Contains(u.Id) && u.Active).Select(u => u.Id).ToListAsync(ct);
        var notifications = activeFollowers.Select(id => NotificationFactory.NewComment(id, task, author.Name)).ToList();
        db.Notifications.AddRange(notifications);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Comentário {CommentId} adicionado à tarefa {TaskId} por {UserId}", comment.Id, task.Id, author.Id);

        if (notifications.Count > 0) await realtime.SendNotificationsAsync(notifications, ct);
        await realtime.BroadcastDataChangedAsync("comment", task.ProjectId, ct);
        return new CommentDto(comment.Id, comment.TaskId, author.Id, author.Name, comment.Content, comment.CreatedAt, comment.UpdatedAt, true);
    }

    public async Task<CommentDto> UpdateAsync(Guid commentId, CommentRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var comment = await LoadOwnAsync(commentId, ct);
        comment.Content = request.Content.Trim();
        await db.SaveChangesAsync(ct);
        var authorName = await db.Users.Where(u => u.Id == comment.UserId).Select(u => u.Name).FirstAsync(ct);
        return new CommentDto(comment.Id, comment.TaskId, comment.UserId, authorName, comment.Content, comment.CreatedAt, comment.UpdatedAt, true);
    }

    public async Task DeleteAsync(Guid commentId, CancellationToken ct)
    {
        var comment = await LoadOwnAsync(commentId, ct);
        db.TaskComments.Remove(comment);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Comentário {CommentId} excluído por {UserId}", commentId, access.UserId);
    }

    private async Task<TaskComment> LoadOwnAsync(Guid commentId, CancellationToken ct)
    {
        var comment = await db.TaskComments.FirstOrDefaultAsync(c => c.Id == commentId, ct)
                      ?? throw new NotFoundException("Comentário não encontrado.", ErrorCodes.CommentNotFound);
        await access.GetVisibleTaskAsync(comment.TaskId, ct);
        if (comment.UserId != access.UserId)
            throw new ForbiddenException("Você só pode editar ou excluir seus próprios comentários.", ErrorCodes.OwnCommentOnly);
        return comment;
    }
}

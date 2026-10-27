using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Domain.Enums;

namespace K2Projects.Application.Tasks;

public record TaskListItemDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string Title,
    WorkTaskStatus Status,
    TaskPriority Priority,
    Guid? AssignedToId,
    string? AssignedToName,
    DateOnly? StartDate,
    DateOnly? DueDate,
    Guid? ParentTaskId,
    string? ParentTaskTitle,
    int SubtaskCount,
    int CompletedSubtaskCount,
    int CommentCount,
    bool IsOverdue,
    int SortOrder,
    DateTime? CompletedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool CanEdit,
    bool CanChangeStatus);

public record TaskDetailDto(
    TaskListItemDto Task,
    string? Description,
    Guid CreatedById,
    string CreatedByName,
    IReadOnlyList<TaskListItemDto> Subtasks);

public record MyTasksDto(
    IReadOnlyList<TaskListItemDto> Todo,
    IReadOnlyList<TaskListItemDto> InProgress,
    IReadOnlyList<TaskListItemDto> Done,
    IReadOnlyList<TaskListItemDto> Overdue);

public record CreateTaskRequest(
    Guid ProjectId,
    string Title,
    string? Description,
    WorkTaskStatus Status,
    TaskPriority Priority,
    Guid? AssignedToId,
    DateOnly? StartDate,
    DateOnly? DueDate,
    Guid? ParentTaskId);

public record UpdateTaskRequest(
    string Title,
    string? Description,
    WorkTaskStatus Status,
    TaskPriority Priority,
    Guid? AssignedToId,
    DateOnly? StartDate,
    DateOnly? DueDate,
    Guid? ParentTaskId);

public record ChangeStatusRequest(WorkTaskStatus Status);

/// <summary>Movimentação no Kanban: coluna de destino e posição (índice 0) dentro dela.</summary>
public record MoveTaskRequest(WorkTaskStatus Status, int Position);

public class TaskQuery : PageQuery
{
    public Guid? ProjectId { get; set; }
    public Guid? AssignedToId { get; set; }
    public WorkTaskStatus? Status { get; set; }
    public TaskPriority? Priority { get; set; }
    public string? Search { get; set; }
    public DateOnly? DueFrom { get; set; }
    public DateOnly? DueTo { get; set; }
    public bool? Overdue { get; set; }
    public Guid? ParentTaskId { get; set; }

    /// <summary>"dueDate" (padrão), "priority", "title", "createdAt", "board".</summary>
    public string? SortBy { get; set; }
}

internal static class TaskRules
{
    public static void Apply<T>(AbstractValidator<T> v,
        System.Linq.Expressions.Expression<Func<T, string>> title,
        System.Linq.Expressions.Expression<Func<T, string?>> description,
        System.Linq.Expressions.Expression<Func<T, WorkTaskStatus>> status,
        System.Linq.Expressions.Expression<Func<T, TaskPriority>> priority,
        Func<T, DateOnly?> start,
        System.Linq.Expressions.Expression<Func<T, DateOnly?>> due)
    {
        v.RuleFor(title).NotEmpty().WithMessage("Informe o título da tarefa.").WithErrorCode(ErrorCodes.TaskTitleRequired)
            .MaximumLength(200).WithMessage("O título deve ter no máximo 200 caracteres.").WithErrorCode(ErrorCodes.TaskTitleMaxLength);
        v.RuleFor(description).MaximumLength(4000).WithMessage("A descrição deve ter no máximo 4000 caracteres.").WithErrorCode(ErrorCodes.DescriptionMaxLength);
        v.RuleFor(status).IsInEnum().WithMessage("Status inválido.").WithErrorCode(ErrorCodes.StatusInvalid);
        v.RuleFor(priority).IsInEnum().WithMessage("Prioridade inválida.").WithErrorCode(ErrorCodes.PriorityInvalid);
        v.RuleFor(due)
            .Must((x, d) => !d.HasValue || !start(x).HasValue || d.Value >= start(x)!.Value)
            .WithMessage("O prazo deve ser igual ou posterior à data de início.").WithErrorCode(ErrorCodes.TaskDatesOrder);
    }
}

public class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty().WithMessage("Toda tarefa deve pertencer a um projeto.").WithErrorCode(ErrorCodes.TaskProjectRequired);
        TaskRules.Apply(this, x => x.Title, x => x.Description, x => x.Status, x => x.Priority, x => x.StartDate, x => x.DueDate);
    }
}

public class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        TaskRules.Apply(this, x => x.Title, x => x.Description, x => x.Status, x => x.Priority, x => x.StartDate, x => x.DueDate);
    }
}

public class MoveTaskRequestValidator : AbstractValidator<MoveTaskRequest>
{
    public MoveTaskRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum().WithMessage("Status inválido.").WithErrorCode(ErrorCodes.StatusInvalid);
        RuleFor(x => x.Position).GreaterThanOrEqualTo(0).WithMessage("Posição inválida.").WithErrorCode(ErrorCodes.PositionInvalid);
    }
}

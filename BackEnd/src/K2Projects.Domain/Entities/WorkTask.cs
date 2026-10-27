using K2Projects.Domain.Common;
using K2Projects.Domain.Enums;

namespace K2Projects.Domain.Entities;

/// <summary>Tarefa de um projeto. Nomeada WorkTask para não conflitar com System.Threading.Tasks.Task.</summary>
public class WorkTask : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public WorkTaskStatus Status { get; private set; } = WorkTaskStatus.AFazer;
    public TaskPriority Priority { get; set; } = TaskPriority.Media;
    public Guid? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? DueDate { get; set; }
    public Guid? ParentTaskId { get; set; }
    public WorkTask? ParentTask { get; set; }
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime? CompletedAt { get; private set; }

    /// <summary>Posição do cartão dentro da coluna do Kanban.</summary>
    public int SortOrder { get; set; }

    public ICollection<WorkTask> Subtasks { get; set; } = new List<WorkTask>();
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();

    /// <summary>
    /// Altera o status. Concluir registra a data de conclusão; reabrir a remove.
    /// </summary>
    public void ChangeStatus(WorkTaskStatus newStatus, DateTime utcNow)
    {
        if (!Enum.IsDefined(newStatus))
            throw new DomainException("Status de tarefa inválido.", "STATUS_INVALID");

        if (newStatus == WorkTaskStatus.Concluido && Status != WorkTaskStatus.Concluido)
            CompletedAt = utcNow;
        else if (newStatus != WorkTaskStatus.Concluido)
            CompletedAt = null;

        Status = newStatus;
    }

    /// <summary>Atrasada: vencimento anterior à data de hoje (no fuso do sistema) e não concluída.</summary>
    public bool IsOverdue(DateOnly today) => IsOverdue(Status, DueDate, today);

    public static bool IsOverdue(WorkTaskStatus status, DateOnly? dueDate, DateOnly today) =>
        status != WorkTaskStatus.Concluido && dueDate.HasValue && dueDate.Value < today;
}

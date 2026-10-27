using K2Projects.Domain.Common;
using K2Projects.Domain.Enums;

namespace K2Projects.Domain.Entities;

public class Project : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? DueDate { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Planejado;
    public Guid OwnerId { get; set; }
    public User? Owner { get; set; }

    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
    public ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();

    /// <summary>Percentual de conclusão (0-100) calculado a partir das tarefas.</summary>
    public static int CalculateProgress(int totalTasks, int completedTasks)
    {
        if (totalTasks <= 0) return 0;
        return (int)Math.Round(completedTasks * 100.0 / totalTasks, MidpointRounding.AwayFromZero);
    }
}

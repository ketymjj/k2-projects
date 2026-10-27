using K2Projects.Domain.Common;

namespace K2Projects.Domain.Entities;

public class TaskComment : AuditableEntity
{
    public Guid TaskId { get; set; }
    public WorkTask? Task { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Content { get; set; } = string.Empty;
}

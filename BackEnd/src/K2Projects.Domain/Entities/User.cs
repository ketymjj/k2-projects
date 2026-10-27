using K2Projects.Domain.Enums;

namespace K2Projects.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Colaborador;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public ICollection<ProjectMember> Memberships { get; set; } = new List<ProjectMember>();
}

using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.Application.Common;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Project> Projects { get; }
    DbSet<ProjectMember> ProjectMembers { get; }
    DbSet<WorkTask> Tasks { get; }
    DbSet<TaskComment> TaskComments { get; }
    DbSet<Notification> Notifications { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface ICurrentUser
{
    Guid UserId { get; }
    Domain.Enums.UserRole Role { get; }
    bool IsAuthenticated { get; }
}

public interface IClock
{
    DateTime UtcNow { get; }

    /// <summary>Data de hoje no fuso horário configurado do sistema (usado para prazos/atrasos).</summary>
    DateOnly Today { get; }
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) CreateToken(User user);
}

/// <summary>Envio de eventos em tempo real (SignalR) para os clientes conectados.</summary>
public interface IRealtimeNotifier
{
    Task SendNotificationsAsync(IEnumerable<Notification> notifications, CancellationToken ct = default);

    /// <summary>Avisa os clientes que dados mudaram, para que listagens e Dashboard se atualizem.</summary>
    Task BroadcastDataChangedAsync(string entity, Guid? projectId, CancellationToken ct = default);
}

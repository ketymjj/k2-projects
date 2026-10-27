using K2Projects.Application.Common;
using K2Projects.Domain.Common;
using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, IClock clock) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<WorkTask> Tasks => Set<WorkTask>();
    public DbSet<TaskComment> TaskComments => Set<TaskComment>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAudit();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAudit();
        return base.SaveChanges();
    }

    /// <summary>Preenche os campos de auditoria. A reordenação de cartões (SortOrder) não altera UpdatedAt.</summary>
    private void ApplyAudit()
    {
        var now = clock.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            switch (entry.Entity)
            {
                case AuditableEntity e when entry.State == EntityState.Added:
                    if (e.CreatedAt == default) e.CreatedAt = now;
                    break;
                case AuditableEntity e when entry.State == EntityState.Modified:
                    var meaningful = entry.Properties.Any(p => p.IsModified && p.Metadata.Name != nameof(WorkTask.SortOrder));
                    if (meaningful) e.UpdatedAt = now;
                    break;
                case User u when entry.State == EntityState.Added && u.CreatedAt == default:
                    u.CreatedAt = now;
                    break;
                case Notification n when entry.State == EntityState.Added && n.CreatedAt == default:
                    n.CreatedAt = now;
                    break;
                case ProjectMember m when entry.State == EntityState.Added && m.AddedAt == default:
                    m.AddedAt = now;
                    break;
            }
        }
    }
}

using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace K2Projects.Infrastructure.Persistence;

// Tabelas em snake_case (EFCore.NamingConventions). Nomes escolhidos para não conflitar com palavras reservadas
// (ex.: "users" e "work_tasks" em vez de "user" e "task").

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Email).HasMaxLength(160).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(200).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
    }
}

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.ToTable("projects", t => t.HasCheckConstraint("ck_projects_dates", "due_date IS NULL OR start_date IS NULL OR due_date >= start_date"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.OwnerId);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.Name);
    }
}

public class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> b)
    {
        b.ToTable("project_members");
        b.HasKey(x => new { x.ProjectId, x.UserId });
        b.HasOne(x => x.Project).WithMany(p => p.Members).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany(u => u.Memberships).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.UserId);
    }
}

public class WorkTaskConfiguration : IEntityTypeConfiguration<WorkTask>
{
    public void Configure(EntityTypeBuilder<WorkTask> b)
    {
        b.ToTable("work_tasks", t => t.HasCheckConstraint("ck_work_tasks_dates", "due_date IS NULL OR start_date IS NULL OR due_date >= start_date"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(4000);
        b.Property(x => x.Status).IsRequired();
        b.Property(x => x.CompletedAt);

        b.HasOne(x => x.Project).WithMany(p => p.Tasks).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.AssignedTo).WithMany().HasForeignKey(x => x.AssignedToId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ParentTask).WithMany(x => x.Subtasks).HasForeignKey(x => x.ParentTaskId).OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => new { x.ProjectId, x.Status, x.SortOrder });
        b.HasIndex(x => x.AssignedToId);
        b.HasIndex(x => x.DueDate);
        b.HasIndex(x => x.ParentTaskId);
    }
}

public class TaskCommentConfiguration : IEntityTypeConfiguration<TaskComment>
{
    public void Configure(EntityTypeBuilder<TaskComment> b)
    {
        b.ToTable("task_comments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Content).HasMaxLength(2000).IsRequired();
        b.HasOne(x => x.Task).WithMany(t => t.Comments).HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.TaskId, x.CreatedAt });
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("notifications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(150).IsRequired();
        b.Property(x => x.Message).HasMaxLength(500).IsRequired();
        b.Property(x => x.DedupKey).HasMaxLength(120);
        b.Property(x => x.Args).HasMaxLength(1000);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.RelatedTask).WithMany().HasForeignKey(x => x.RelatedTaskId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
        b.HasIndex(x => new { x.UserId, x.DedupKey }).IsUnique().HasFilter("dedup_key IS NOT NULL");
    }
}

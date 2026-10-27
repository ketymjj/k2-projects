using FluentValidation;
using K2Projects.Application.Comments;
using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Application.Projects;
using K2Projects.Application.Security;
using K2Projects.Application.Tasks;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using K2Projects.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace K2Projects.UnitTests;

public class FakeClock : IClock
{
    public DateTime UtcNow { get; set; } = new(2026, 10, 24, 15, 0, 0, DateTimeKind.Utc);
    public DateOnly Today { get; set; } = new(2026, 10, 24);
}

public class FakeCurrentUser : ICurrentUser
{
    public Guid UserId { get; set; }
    public UserRole Role { get; set; }
    public bool IsAuthenticated => UserId != Guid.Empty;
}

public class FakeRealtime : IRealtimeNotifier
{
    public List<Notification> Sent { get; } = [];
    public List<string> Changes { get; } = [];

    public Task SendNotificationsAsync(IEnumerable<Notification> notifications, CancellationToken ct = default)
    {
        Sent.AddRange(notifications);
        return Task.CompletedTask;
    }

    public Task BroadcastDataChangedAsync(string entity, Guid? projectId, CancellationToken ct = default)
    {
        Changes.Add(entity);
        return Task.CompletedTask;
    }
}

/// <summary>Monta os serviços reais sobre um banco InMemory isolado por teste.</summary>
public class TestFixture
{
    public FakeClock Clock { get; } = new();
    public FakeCurrentUser CurrentUser { get; } = new();
    public FakeRealtime Realtime { get; } = new();
    public AppDbContext Db { get; }

    public User Admin { get; }
    public User Manager { get; }
    public User OtherManager { get; }
    public User Collaborator { get; }
    public User OtherCollaborator { get; }

    public TestFixture()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        Db = new AppDbContext(options, Clock);

        Admin = AddUser("Admin", UserRole.Administrador);
        Manager = AddUser("Gerente", UserRole.Gerente);
        OtherManager = AddUser("Outro Gerente", UserRole.Gerente);
        Collaborator = AddUser("Colaborador", UserRole.Colaborador);
        OtherCollaborator = AddUser("Outro Colaborador", UserRole.Colaborador);
        Db.SaveChanges();
        LoginAs(Admin);
    }

    private User AddUser(string name, UserRole role)
    {
        var user = new User { Name = name, Email = $"{name.Replace(" ", ".").ToLower()}@test.local", Role = role, PasswordHash = "x" };
        Db.Users.Add(user);
        return user;
    }

    public void LoginAs(User user)
    {
        CurrentUser.UserId = user.Id;
        CurrentUser.Role = user.Role;
        Db.ChangeTracker.Clear();
    }

    public AccessService Access => new(Db, CurrentUser);

    public ProjectService Projects => new(Db, Access, Clock, Realtime, new ProjectRequestValidator(), NullLogger<ProjectService>.Instance);

    public TaskService Tasks => new(Db, Access, Clock, Realtime,
        new CreateTaskRequestValidator(), new UpdateTaskRequestValidator(), new MoveTaskRequestValidator(),
        NullLogger<TaskService>.Instance);

    public CommentService Comments => new(Db, Access, Realtime, new CommentRequestValidator(), NullLogger<CommentService>.Instance);

    public NotificationService Notifications => new(Db, CurrentUser, Clock, Realtime, NullLogger<NotificationService>.Instance);

    /// <summary>Cria um projeto do gerente com o colaborador como membro.</summary>
    public Project SeedProject(User? owner = null, params User[] members)
    {
        var project = new Project { Name = "Projeto Teste", Status = ProjectStatus.EmAndamento, OwnerId = (owner ?? Manager).Id };
        foreach (var m in members.Length > 0 ? members : [Collaborator])
            project.Members.Add(new ProjectMember { UserId = m.Id });
        Db.Projects.Add(project);
        Db.SaveChanges();
        Db.ChangeTracker.Clear();
        return project;
    }

    public WorkTask SeedTask(Project project, string title = "Tarefa", WorkTaskStatus status = WorkTaskStatus.AFazer,
        User? assignee = null, DateOnly? due = null, Guid? parentId = null, int sortOrder = 0)
    {
        var task = new WorkTask
        {
            ProjectId = project.Id,
            Title = title,
            AssignedToId = assignee?.Id,
            DueDate = due,
            ParentTaskId = parentId,
            CreatedById = project.OwnerId,
            SortOrder = sortOrder
        };
        task.ChangeStatus(status, Clock.UtcNow);
        Db.Tasks.Add(task);
        Db.SaveChanges();
        Db.ChangeTracker.Clear();
        return task;
    }

    public static async Task<T> ThrowsAsync<T>(Func<Task> action) where T : Exception => await Assert.ThrowsAsync<T>(action);
}

public static class ValidationAssert
{
    public static async Task FailsAsync(Func<Task> action, string property)
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(action);
        Assert.Contains(ex.Errors, e => e.PropertyName == property);
    }
}

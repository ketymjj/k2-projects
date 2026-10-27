using K2Projects.Application.Common;
using K2Projects.Application.Projects;
using K2Projects.Application.Security;
using K2Projects.Application.Tasks;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.Application.Dashboard;

public record ChartItemDto(string Key, int Count);

public record ProjectProgressDto(Guid Id, string Name, ProjectStatus Status, int TaskCount, int CompletedTaskCount, int Progress);

public record DashboardDto(
    int TotalProjects,
    int ProjectsInProgress,
    int TotalTasks,
    int PendingTasks,
    int InProgressTasks,
    int CompletedTasks,
    int OverdueTasks,
    IReadOnlyList<ChartItemDto> TasksByStatus,
    IReadOnlyList<ChartItemDto> TasksByPriority,
    IReadOnlyList<ProjectProgressDto> ProjectProgress,
    IReadOnlyList<TaskListItemDto> MyUpcomingTasks,
    IReadOnlyList<TaskListItemDto> OverdueTaskList,
    IReadOnlyList<ProjectListItemDto> RecentProjects);

/// <summary>
/// Indicadores calculados a partir do banco, considerando somente os projetos e tarefas
/// que o usuário pode visualizar (o administrador vê o Dashboard completo).
/// </summary>
public class DashboardService(AccessService access, IClock clock, TaskService tasks, ProjectService projects)
{
    public async Task<DashboardDto> GetAsync(CancellationToken ct)
    {
        var today = clock.Today;
        var visibleProjects = access.VisibleProjects().AsNoTracking();
        var visibleTasks = access.VisibleTasks().AsNoTracking();

        var totalProjects = await visibleProjects.CountAsync(ct);
        var projectsInProgress = await visibleProjects.CountAsync(p => p.Status == ProjectStatus.EmAndamento, ct);

        var byStatus = await visibleTasks.GroupBy(t => t.Status)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var byPriority = await visibleTasks.GroupBy(t => t.Priority)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var overdue = await visibleTasks.CountAsync(t => t.Status != WorkTaskStatus.Concluido && t.DueDate != null && t.DueDate < today, ct);

        int StatusCount(WorkTaskStatus s) => byStatus.FirstOrDefault(x => x.Key == s)?.Count ?? 0;

        var progress = (await visibleProjects
                .Where(p => p.Status != ProjectStatus.Cancelado)
                .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
                .Take(8)
                .Select(p => new
                {
                    p.Id, p.Name, p.Status,
                    Total = p.Tasks.Count(),
                    Completed = p.Tasks.Count(t => t.Status == WorkTaskStatus.Concluido)
                })
                .ToListAsync(ct))
            .Select(p => new ProjectProgressDto(p.Id, p.Name, p.Status, p.Total, p.Completed, Project.CalculateProgress(p.Total, p.Completed)))
            .ToList();

        var myUpcoming = (await tasks.MyTasksAsync(ct));
        var upcoming = myUpcoming.Overdue.Concat(myUpcoming.InProgress).Concat(myUpcoming.Todo)
            .OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).Take(6).ToList();

        var overdueList = await tasks.ListAsync(new TaskQuery { Overdue = true, PageSize = 6 }, ct);
        var recent = await projects.ListAsync(new ProjectQuery { PageSize = 5 }, ct);

        return new DashboardDto(
            totalProjects,
            projectsInProgress,
            byStatus.Sum(x => x.Count),
            StatusCount(WorkTaskStatus.AFazer),
            StatusCount(WorkTaskStatus.EmAndamento),
            StatusCount(WorkTaskStatus.Concluido),
            overdue,
            Enum.GetValues<WorkTaskStatus>().Select(s => new ChartItemDto(s.ToString(), StatusCount(s))).ToList(),
            Enum.GetValues<TaskPriority>().Select(p => new ChartItemDto(p.ToString(), byPriority.FirstOrDefault(x => x.Key == p)?.Count ?? 0)).ToList(),
            progress,
            upcoming,
            overdueList.Items,
            recent.Items);
    }
}

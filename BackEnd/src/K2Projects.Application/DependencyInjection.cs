using FluentValidation;
using K2Projects.Application.Auth;
using K2Projects.Application.Comments;
using K2Projects.Application.Dashboard;
using K2Projects.Application.Notifications;
using K2Projects.Application.Profile;
using K2Projects.Application.Projects;
using K2Projects.Application.Security;
using K2Projects.Application.Tasks;
using K2Projects.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace K2Projects.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);

        services.AddScoped<AccessService>();
        services.AddScoped<AuthService>();
        services.AddScoped<UserService>();
        services.AddScoped<ProfileService>();
        services.AddScoped<ProjectService>();
        services.AddScoped<TaskService>();
        services.AddScoped<CommentService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<DashboardService>();
        return services;
    }
}

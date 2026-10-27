using System.IdentityModel.Tokens.Jwt;
using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Application.Notifications;
using K2Projects.Domain.Common;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace K2Projects.Api.Infrastructure;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public bool IsAuthenticated => accessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public Guid UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : Guid.Empty;

    public UserRole Role =>
        Enum.TryParse<UserRole>(accessor.HttpContext?.User.FindFirst("role")?.Value, out var role) ? role : UserRole.Colaborador;
}

/// <summary>Hub de notificações em tempo real. Cada usuário entra em um grupo próprio.</summary>
[Authorize]
public class NotificationsHub : Hub
{
    public const string Path = "/hubs/notifications";

    public static string UserGroup(Guid userId) => $"user:{userId}";

    public override async Task OnConnectedAsync()
    {
        var sub = Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (Guid.TryParse(sub, out var userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        await base.OnConnectedAsync();
    }
}

public class SignalRRealtimeNotifier(IHubContext<NotificationsHub> hub, ILogger<SignalRRealtimeNotifier> logger) : IRealtimeNotifier
{
    public async Task SendNotificationsAsync(IEnumerable<Notification> notifications, CancellationToken ct = default)
    {
        foreach (var n in notifications)
        {
            try
            {
                await hub.Clients.Group(NotificationsHub.UserGroup(n.UserId)).SendAsync("notification", NotificationDto.From(n), ct);
            }
            catch (Exception ex)
            {
                // Falha no envio em tempo real não deve desfazer a operação: a notificação já está persistida.
                logger.LogWarning(ex, "Falha ao enviar notificação {NotificationId} via SignalR", n.Id);
            }
        }
    }

    public async Task BroadcastDataChangedAsync(string entity, Guid? projectId, CancellationToken ct = default)
    {
        try
        {
            await hub.Clients.All.SendAsync("dataChanged", new { entity, projectId }, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falha ao enviar evento dataChanged via SignalR");
        }
    }
}

/// <summary>Converte exceções em respostas ProblemDetails padronizadas.</summary>
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment env) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            ValidationException => (StatusCodes.Status400BadRequest, "Dados inválidos."),
            DomainException => (StatusCodes.Status400BadRequest, exception.Message),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, exception.Message),
            ForbiddenException => (StatusCodes.Status403Forbidden, exception.Message),
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, exception.Message),
            OperationCanceledException => (499, "Requisição cancelada."),
            _ => (StatusCodes.Status500InternalServerError, "Ocorreu um erro inesperado. Tente novamente.")
        };

        if (status >= 500) logger.LogError(exception, "Erro não tratado em {Method} {Path}", context.Request.Method, context.Request.Path);
        else logger.LogInformation("Requisição {Method} {Path} retornou {Status}: {Message}", context.Request.Method, context.Request.Path, status, exception.Message);

        var problem = new ProblemDetails { Status = status, Title = title, Instance = context.Request.Path };

        // Código estável para o frontend traduzir a mensagem (o "title" em português fica como reserva).
        problem.Extensions["code"] = exception switch
        {
            AppException app => app.Code,
            DomainException domain => domain.Code,
            ValidationException => ErrorCodes.ValidationFailed,
            _ => status >= 500 ? ErrorCodes.Unexpected : null
        };
        if (exception is AppException { Args: not null } withArgs) problem.Extensions["args"] = withArgs.Args;

        if (exception is ValidationException ve)
        {
            var byField = ve.Errors.GroupBy(e => string.IsNullOrEmpty(e.PropertyName) ? "general" : char.ToLowerInvariant(e.PropertyName[0]) + e.PropertyName[1..]);
            problem.Extensions["errors"] = byField.ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());
            problem.Extensions["errorCodes"] = byField.ToDictionary(g => g.Key, g => g.Select(e => e.ErrorCode).Distinct().ToArray());
        }
        if (exception is ConflictException { Details: not null } ce) problem.Extensions["details"] = ce.Details;
        if (status >= 500 && env.IsDevelopment()) problem.Detail = exception.Message;

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}

using K2Projects.Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace K2Projects.Infrastructure.Services;

/// <summary>Processo em segundo plano que verifica periodicamente prazos próximos e tarefas atrasadas.</summary>
public class DeadlineNotificationWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<AppOptions> options,
    ILogger<DeadlineNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.DeadlineCheckIntervalMinutes));
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            using var timer = new PeriodicTimer(interval);
            do
            {
                await RunOnceAsync(stoppingToken);
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // encerramento da aplicação
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<NotificationService>();
            await service.CheckDeadlinesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Falha ao verificar prazos das tarefas");
        }
    }
}

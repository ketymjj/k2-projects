using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;
using K2Projects.Infrastructure.Services;
using Microsoft.Extensions.Options;

namespace K2Projects.UnitTests;

public class DomainTests
{
    private static readonly DateTime Now = new(2026, 10, 24, 15, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Concluir_tarefa_registra_data_de_conclusao()
    {
        var task = new WorkTask();
        task.ChangeStatus(WorkTaskStatus.Concluido, Now);

        Assert.Equal(WorkTaskStatus.Concluido, task.Status);
        Assert.Equal(Now, task.CompletedAt);
    }

    [Fact]
    public void Reabrir_tarefa_limpa_data_de_conclusao()
    {
        var task = new WorkTask();
        task.ChangeStatus(WorkTaskStatus.Concluido, Now);
        task.ChangeStatus(WorkTaskStatus.EmAndamento, Now.AddHours(1));

        Assert.Equal(WorkTaskStatus.EmAndamento, task.Status);
        Assert.Null(task.CompletedAt);
    }

    [Fact]
    public void Concluir_novamente_mantem_data_original_de_conclusao()
    {
        var task = new WorkTask();
        task.ChangeStatus(WorkTaskStatus.Concluido, Now);
        task.ChangeStatus(WorkTaskStatus.Concluido, Now.AddDays(1));

        Assert.Equal(Now, task.CompletedAt);
    }

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(4, 1, 25)]
    [InlineData(3, 1, 33)]
    [InlineData(3, 2, 67)]
    [InlineData(8, 8, 100)]
    public void Calculo_de_progresso(int total, int completed, int expected)
    {
        Assert.Equal(expected, Project.CalculateProgress(total, completed));
    }

    [Theory]
    [InlineData(WorkTaskStatus.AFazer, -1, true)]
    [InlineData(WorkTaskStatus.EmAndamento, -10, true)]
    [InlineData(WorkTaskStatus.AFazer, 0, false)]     // vence hoje: ainda não está atrasada
    [InlineData(WorkTaskStatus.AFazer, 3, false)]
    [InlineData(WorkTaskStatus.Concluido, -5, false)] // concluída nunca está atrasada
    public void Identificacao_de_atraso(WorkTaskStatus status, int dueOffset, bool expected)
    {
        var today = new DateOnly(2026, 10, 24);
        Assert.Equal(expected, WorkTask.IsOverdue(status, today.AddDays(dueOffset), today));
    }

    [Fact]
    public void Tarefa_sem_prazo_nunca_esta_atrasada()
    {
        Assert.False(WorkTask.IsOverdue(WorkTaskStatus.AFazer, null, new DateOnly(2026, 10, 24)));
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    [Fact]
    public void Hoje_considera_o_fuso_horario_configurado()
    {
        // 25/10 01:30 UTC ainda é 24/10 22:30 em São Paulo (UTC-3)
        var utc = new DateTimeOffset(2026, 10, 25, 1, 30, 0, TimeSpan.Zero);
        var clock = new SystemClock(Options.Create(new AppOptions { TimeZone = "America/Sao_Paulo" }), new FixedTimeProvider(utc));

        Assert.Equal(new DateOnly(2026, 10, 24), clock.Today);

        // Uma tarefa que vence em 24/10 ainda NÃO está atrasada nesse instante, no fuso local
        Assert.False(WorkTask.IsOverdue(WorkTaskStatus.AFazer, new DateOnly(2026, 10, 24), clock.Today));
    }
}

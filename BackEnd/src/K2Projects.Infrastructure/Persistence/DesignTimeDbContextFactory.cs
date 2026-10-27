using K2Projects.Application.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace K2Projects.Infrastructure.Persistence;

/// <summary>Usada apenas pelas ferramentas do EF Core (dotnet ef migrations).</summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("K2_CONNECTION_STRING")
                         ?? "Host=localhost;Port=5433;Database=k2projects;Username=k2;Password=k2_local_dev";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection)
            .UseSnakeCaseNamingConvention()
            .Options;
        return new AppDbContext(options, new DesignTimeClock());
    }

    private sealed class DesignTimeClock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
        public DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    }
}

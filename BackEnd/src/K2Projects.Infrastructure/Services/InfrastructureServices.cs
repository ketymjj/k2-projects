using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using K2Projects.Application.Common;
using K2Projects.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace K2Projects.Infrastructure.Services;

public class JwtOptions
{
    public const string Section = "Jwt";
    public string Issuer { get; set; } = "K2Projects";
    public string Audience { get; set; } = "K2Projects";
    public string Key { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 480;
}

public class AppOptions
{
    public const string Section = "App";

    /// <summary>Fuso horário usado para definir "hoje" ao calcular prazos e atrasos.</summary>
    public string TimeZone { get; set; } = "America/Sao_Paulo";

    public int DeadlineCheckIntervalMinutes { get; set; } = 10;
}

public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 11;
    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    public bool Verify(string password, string hash)
    {
        try { return BCrypt.Net.BCrypt.Verify(password, hash); }
        catch (BCrypt.Net.SaltParseException) { return false; }
    }
}

public class SystemClock(IOptions<AppOptions> options, TimeProvider timeProvider) : IClock
{
    private readonly TimeZoneInfo _timeZone =
        TimeZoneInfo.TryFindSystemTimeZoneById(options.Value.TimeZone, out var tz) ? tz : TimeZoneInfo.Utc;

    public DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(UtcNow, _timeZone));
}

public class JwtTokenService(IOptions<JwtOptions> options, IClock clock) : ITokenService
{
    public (string Token, DateTime ExpiresAt) CreateToken(User user)
    {
        var o = options.Value;
        var expires = clock.UtcNow.AddMinutes(o.ExpirationMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("name", user.Name),
            new Claim("role", user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(o.Issuer, o.Audience, claims, clock.UtcNow, expires, credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}

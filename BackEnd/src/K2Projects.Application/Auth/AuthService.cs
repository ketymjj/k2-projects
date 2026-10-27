using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Application.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Auth;

public record LoginRequest(string Email, string Password);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Informe o e-mail.").WithErrorCode(ErrorCodes.EmailRequired)
            .EmailAddress().WithMessage("E-mail inválido.").WithErrorCode(ErrorCodes.EmailInvalid);
        RuleFor(x => x.Password).NotEmpty().WithMessage("Informe a senha.").WithErrorCode(ErrorCodes.PasswordRequired);
    }
}

public class AuthService(
    IAppDbContext db,
    IPasswordHasher hasher,
    ITokenService tokens,
    IValidator<LoginRequest> validator,
    ILogger<AuthService> logger)
{
    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var email = UserService.NormalizeEmail(request.Email);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null || !hasher.Verify(request.Password, user.PasswordHash))
        {
            logger.LogWarning("Falha de login para {Email}", email);
            throw new UnauthorizedException("E-mail ou senha inválidos.", ErrorCodes.InvalidCredentials);
        }
        if (!user.Active)
            throw new UnauthorizedException("Usuário inativo. Procure um administrador.", ErrorCodes.InactiveUser);

        var (token, expiresAt) = tokens.CreateToken(user);
        logger.LogInformation("Login realizado pelo usuário {UserId}", user.Id);
        return new AuthResponse(token, expiresAt, UserDto.From(user));
    }

    public async Task<UserDto> MeAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.Active, ct)
                   ?? throw new UnauthorizedException("Sessão inválida.", ErrorCodes.InvalidSession);
        return UserDto.From(user);
    }
}

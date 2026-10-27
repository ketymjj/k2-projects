using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Application.Security;
using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace K2Projects.Application.Users;

public class UserService(
    IAppDbContext db,
    AccessService access,
    IPasswordHasher hasher,
    IValidator<CreateUserRequest> createValidator,
    IValidator<UpdateUserRequest> updateValidator,
    ILogger<UserService> logger)
{
    public async Task<PagedResult<UserDto>> ListAsync(UserQuery query, CancellationToken ct)
    {
        EnsureAdmin();
        var q = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(u => u.Name.ToLower().Contains(term) || u.Email.ToLower().Contains(term));
        }
        if (query.Role.HasValue) q = q.Where(u => u.Role == query.Role);
        if (query.Active.HasValue) q = q.Where(u => u.Active == query.Active);

        return await q.OrderBy(u => u.Name)
            .Select(u => new UserDto(u.Id, u.Name, u.Email, u.Role, u.Active, u.CreatedAt))
            .ToPagedAsync(query, ct);
    }

    /// <summary>Lista de usuários ativos para seleção de responsáveis e filtros.</summary>
    public async Task<IReadOnlyList<UserLookupDto>> LookupAsync(CancellationToken ct) =>
        await db.Users.AsNoTracking().Where(u => u.Active).OrderBy(u => u.Name)
            .Select(u => new UserLookupDto(u.Id, u.Name, u.Email, u.Role)).ToListAsync(ct);

    public async Task<UserDto> GetAsync(Guid id, CancellationToken ct)
    {
        EnsureAdmin();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new NotFoundException("Usuário não encontrado.", ErrorCodes.UserNotFound);
        return UserDto.From(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        await createValidator.ValidateAndThrowAsync(request, ct);
        var email = NormalizeEmail(request.Email);
        await EnsureEmailAvailable(email, null, ct);

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = hasher.Hash(request.Password),
            Role = request.Role,
            Active = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Usuário {UserId} criado por {AdminId} com perfil {Role}", user.Id, access.UserId, user.Role);
        return UserDto.From(user);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct)
    {
        EnsureAdmin();
        await updateValidator.ValidateAndThrowAsync(request, ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new NotFoundException("Usuário não encontrado.", ErrorCodes.UserNotFound);

        if (user.Id == access.UserId && (!request.Active || request.Role != user.Role))
            throw new ConflictException("Você não pode desativar nem alterar o perfil do seu próprio usuário.", ErrorCodes.SelfRoleOrStatusChange);

        var email = NormalizeEmail(request.Email);
        await EnsureEmailAvailable(email, id, ct);

        user.Name = request.Name.Trim();
        user.Email = email;
        user.Role = request.Role;
        user.Active = request.Active;
        if (!string.IsNullOrEmpty(request.NewPassword))
            user.PasswordHash = hasher.Hash(request.NewPassword);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Usuário {UserId} atualizado por {AdminId}", user.Id, access.UserId);
        return UserDto.From(user);
    }

    public async Task<UserDto> SetActiveAsync(Guid id, bool active, CancellationToken ct)
    {
        EnsureAdmin();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                   ?? throw new NotFoundException("Usuário não encontrado.", ErrorCodes.UserNotFound);
        if (user.Id == access.UserId && !active)
            throw new ConflictException("Você não pode desativar o seu próprio usuário.", ErrorCodes.SelfDeactivate);
        user.Active = active;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Usuário {UserId} marcado como {Status} por {AdminId}", user.Id, active ? "ativo" : "inativo", access.UserId);
        return UserDto.From(user);
    }

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    internal async Task EnsureEmailAvailable(string email, Guid? exceptId, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.Email == email && u.Id != exceptId, ct))
            throw new ConflictException("Já existe um usuário com este e-mail.", ErrorCodes.EmailInUse);
    }

    private void EnsureAdmin()
    {
        if (!access.IsAdmin) throw new ForbiddenException("Somente administradores podem gerenciar usuários.", ErrorCodes.ManageUsersForbidden);
    }
}

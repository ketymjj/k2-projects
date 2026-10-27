using FluentValidation;
using FluentValidation.Results;
using K2Projects.Application.Common;
using K2Projects.Application.Users;
using K2Projects.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace K2Projects.Application.Profile;

public record UpdateProfileRequest(string Name, string Email);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Name).PersonName();
        RuleFor(x => x.Email).Email();
    }
}

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Informe a senha atual.").WithErrorCode(ErrorCodes.CurrentPasswordRequired);
        RuleFor(x => x.NewPassword).StrongPassword()
            .NotEqual(x => x.CurrentPassword).WithMessage("A nova senha deve ser diferente da atual.").WithErrorCode(ErrorCodes.PasswordSameAsCurrent);
    }
}

public class ProfileService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPasswordHasher hasher,
    UserService users,
    IValidator<UpdateProfileRequest> profileValidator,
    IValidator<ChangePasswordRequest> passwordValidator)
{
    public async Task<UserDto> GetAsync(CancellationToken ct) => UserDto.From(await LoadAsync(ct));

    public async Task<UserDto> UpdateAsync(UpdateProfileRequest request, CancellationToken ct)
    {
        await profileValidator.ValidateAndThrowAsync(request, ct);
        var user = await LoadAsync(ct);
        var email = UserService.NormalizeEmail(request.Email);
        await users.EnsureEmailAvailable(email, user.Id, ct);
        user.Name = request.Name.Trim();
        user.Email = email;
        await db.SaveChangesAsync(ct);
        return UserDto.From(user);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        await passwordValidator.ValidateAndThrowAsync(request, ct);
        var user = await LoadAsync(ct);
        if (!hasher.Verify(request.CurrentPassword, user.PasswordHash))
            throw Validation.Fail(nameof(request.CurrentPassword), ErrorCodes.CurrentPasswordIncorrect, "Senha atual incorreta.");
        user.PasswordHash = hasher.Hash(request.NewPassword);
        await db.SaveChangesAsync(ct);
    }

    private async Task<User> LoadAsync(CancellationToken ct) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct)
        ?? throw new NotFoundException("Usuário não encontrado.", ErrorCodes.UserNotFound);
}

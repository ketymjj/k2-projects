using FluentValidation;
using K2Projects.Application.Common;

namespace K2Projects.Application.Users;

public static class PasswordRules
{
    public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe a senha.").WithErrorCode(ErrorCodes.PasswordRequired)
            .MinimumLength(8).WithMessage("A senha deve ter pelo menos 8 caracteres.").WithErrorCode(ErrorCodes.PasswordMinLength)
            .MaximumLength(100).WithErrorCode(ErrorCodes.MaxLength)
            .Matches("[A-Za-z]").WithMessage("A senha deve conter letras.").WithErrorCode(ErrorCodes.PasswordLetters)
            .Matches("[0-9]").WithMessage("A senha deve conter números.").WithErrorCode(ErrorCodes.PasswordNumbers);

    public static IRuleBuilderOptions<T, string> PersonName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe o nome.").WithErrorCode(ErrorCodes.NameRequired)
            .MaximumLength(120).WithErrorCode(ErrorCodes.MaxLength);

    public static IRuleBuilderOptions<T, string> Email<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Informe o e-mail.").WithErrorCode(ErrorCodes.EmailRequired)
            .EmailAddress().WithMessage("E-mail inválido.").WithErrorCode(ErrorCodes.EmailInvalid)
            .MaximumLength(160).WithErrorCode(ErrorCodes.MaxLength);
}

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Name).PersonName();
        RuleFor(x => x.Email).Email();
        RuleFor(x => x.Password).StrongPassword();
        RuleFor(x => x.Role).IsInEnum().WithMessage("Perfil inválido.").WithErrorCode(ErrorCodes.RoleInvalid);
    }
}

public class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.Name).PersonName();
        RuleFor(x => x.Email).Email();
        RuleFor(x => x.Role).IsInEnum().WithMessage("Perfil inválido.").WithErrorCode(ErrorCodes.RoleInvalid);
        When(x => !string.IsNullOrEmpty(x.NewPassword), () => RuleFor(x => x.NewPassword!).StrongPassword());
    }
}
